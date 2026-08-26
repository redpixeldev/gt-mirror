/*
 * Apply scripts/ghost/fixture.json to a Ghost install through the Admin API.
 *
 * Idempotent, keyed on slug: a second run updates rather than duplicates, so
 * fixture → import → import leaves the publication in the same state. That property is what
 * makes it safe to re-run against a install someone has been clicking around in, and it is
 * asserted by the demo-publication ticket's gate rather than assumed.
 *
 * Auth is an Admin API key, not the session cookie: a key is what a CI run or a fresh clone
 * can use, and it never puts a password in a script. GHOST_ADMIN_API_KEY lives in .env, which
 * is gitignored.
 *
 *   node --env-file=.env scripts/ghost/import.mjs
 */
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';

const FIXTURE = 'scripts/ghost/fixture.json';
const SUPPORTED_VERSION = 1;

const base = (process.env.GHOST_URL ?? 'http://localhost:2368').replace(/\/$/, '');
const key = process.env.GHOST_ADMIN_API_KEY;

if (!key || !key.includes(':')) {
	throw new Error('GHOST_ADMIN_API_KEY must be set to an Admin API key of the form <id>:<hex secret>.');
}

/**
 * Ghost's Admin API takes a short-lived JWT signed with the key's secret. Hand-rolled rather
 * than pulling in a JWT library for three fields: the audience must be the versioned admin
 * path or Ghost rejects the token.
 */
function token() {
	const [id, secret] = key.split(':');
	const now = Math.floor(Date.now() / 1000);

	const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
	const header = b64({ alg: 'HS256', typ: 'JWT', kid: id });
	const payload = b64({ iat: now, exp: now + 300, aud: '/admin/' });

	const signature = createHmac('sha256', Buffer.from(secret, 'hex')).update(`${header}.${payload}`).digest('base64url');

	return `${header}.${payload}.${signature}`;
}

async function api(method, path, body) {
	const response = await fetch(`${base}/ghost/api/admin${path}`, {
		method,
		headers: {
			Authorization: `Ghost ${token()}`,
			'Content-Type': 'application/json',
			'Accept-Version': 'v6.0',
		},
		body: body ? JSON.stringify(body) : undefined,
	});

	const text = await response.text();
	const payload = text ? JSON.parse(text) : {};

	if (!response.ok) {
		const detail = payload.errors?.[0];
		throw new Error(`${method} ${path} → ${response.status} ${detail?.message ?? text.slice(0, 200)}`);
	}

	return payload;
}

const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));

if (fixture.version !== SUPPORTED_VERSION) {
	throw new Error(
		`${FIXTURE} is version ${fixture.version}; this importer understands ${SUPPORTED_VERSION}. ` +
			`Re-run scripts/ghost/build-fixture.mjs.`,
	);
}

/**
 * Ghost rejects an update without the record's current `updated_at` — it is the collision
 * check. So an idempotent upsert has to read before it writes.
 */
async function upsertPage(page) {
	const existing = await api('GET', `/pages/slug/${page.slug}/?formats=html`).catch((error) => {
		if (String(error).includes('404')) {
			return null;
		}
		throw error;
	});

	const payload = {
		title: page.title,
		slug: page.slug,
		html: page.body,
		custom_template: page.template,
		status: 'published',
	};

	if (!existing) {
		await api('POST', '/pages/?source=html', { pages: [payload] });
		return 'created';
	}

	const current = existing.pages[0];
	await api('PUT', `/pages/${current.id}/?source=html`, {
		pages: [{ ...payload, updated_at: current.updated_at }],
	});
	return 'updated';
}

const counts = { created: 0, updated: 0 };

for (const page of fixture.pages) {
	const action = await upsertPage(page);
	counts[action] += 1;
	console.log(`  ${action.padEnd(7)} /${page.slug}/ → ${page.template}`);
}

console.log(`pages: ${counts.created} created, ${counts.updated} updated`);

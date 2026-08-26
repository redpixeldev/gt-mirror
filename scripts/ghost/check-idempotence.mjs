/*
 * Prove that re-importing the fixture changes nothing.
 *
 *   node --env-file=.env scripts/ghost/check-idempotence.mjs
 *
 * Snapshot the publication, run the import again, snapshot again, diff. The importer reporting
 * "0 created, 104 updated" is not the same claim: an update that rewrote a date, dropped a tag
 * relation or re-uploaded an image would report exactly that too.
 *
 * This is what lets "safe to re-run against an existing install" be a documented fact rather than
 * a hope, which the demo-publication ticket asks for explicitly.
 */
import { execSync } from 'node:child_process';

const base = (process.env.GHOST_URL ?? 'http://localhost:2368').replace(/\/$/, '');

const login = await fetch(`${base}/ghost/api/admin/session/`, {
	method: 'POST',
	headers: { 'Content-Type': 'application/json', 'Accept-Version': 'v6.0', Origin: base },
	body: JSON.stringify({ username: process.env.GHOST_ADMIN_EMAIL, password: process.env.GHOST_ADMIN_PASSWORD }),
});
if (!login.ok) {
	throw new Error(`session → ${login.status}`);
}
const cookie = login.headers
	.getSetCookie()
	.map((c) => c.split(';')[0])
	.join('; ');

const get = async (path) => {
	const response = await fetch(`${base}/ghost/api/admin${path}`, {
		headers: { Cookie: cookie, 'Accept-Version': 'v6.0' },
	});
	if (!response.ok) {
		throw new Error(`GET ${path} → ${response.status}`);
	}
	return await response.json();
};

/**
 * Page through a browse endpoint.
 *
 * `limit=all` is a trap on Ghost 6: applyLimitCap silently caps every browse at 100
 * (core/shared/max-limit-cap.js), so asking for "all" of a 104-post publication returns 100 and
 * reports success. An earlier version of this check compared 100 posts and called it identical.
 */
async function all(resource, query = '') {
	const rows = [];
	for (let page = 1; ; page += 1) {
		const payload = await get(`/${resource}/?limit=100&page=${page}${query}`);
		rows.push(...payload[resource]);
		if (page >= (payload.meta?.pagination?.pages ?? 1)) {
			return rows;
		}
	}
}

async function snapshot() {
	const [posts, pages, tags, users, recs] = await Promise.all([
		all('posts', '&include=tags,authors'),
		all('pages'),
		all('tags'),
		all('users'),
		all('recommendations'),
	]);
	const sort = (rows, key) => rows.sort((a, b) => String(a[key]).localeCompare(String(b[key])));
	return JSON.stringify(
		{
			posts: sort(
				posts.map((p) => ({
					slug: p.slug,
					title: p.title,
					visibility: p.visibility,
					featured: p.featured,
					published_at: p.published_at,
					excerpt: p.custom_excerpt,
					image: p.feature_image,
					tags: (p.tags ?? []).map((t) => t.slug),
					authors: (p.authors ?? []).map((a) => a.email),
				})),
				'slug',
			),
			pages: sort(
				pages.map((p) => ({ slug: p.slug, title: p.title, template: p.custom_template })),
				'slug',
			),
			tags: sort(
				tags.map((t) => ({ slug: t.slug, name: t.name, description: t.description, image: t.feature_image })),
				'slug',
			),
			users: sort(
				users.map((u) => ({ email: u.email, name: u.name, bio: u.bio, location: u.location, image: u.profile_image })),
				'email',
			),
			recs: sort(
				recs.map((r) => ({ url: r.url, title: r.title })),
				'url',
			),
		},
		null,
		1,
	);
}

const before = await snapshot();
console.log('snapshot taken, re-importing…');
execSync('node --env-file=.env scripts/ghost/import.mjs --prune', { stdio: 'pipe' });
const after = await snapshot();

const counts = JSON.parse(before);
const summary =
	`${counts.posts.length} posts, ${counts.pages.length} pages, ${counts.tags.length} tags, ` +
	`${counts.users.length} users, ${counts.recs.length} recommendations`;

if (before === after) {
	console.log(`identical after a repeat import: ${summary}`);
} else {
	const b = before.split('\n');
	const a = after.split('\n');
	const diffs = b.map((line, i) => (line === a[i] ? null : `- ${line}\n+ ${a[i]}`)).filter(Boolean);
	console.error(`the publication CHANGED on a repeat import — ${diffs.length} differing line(s):`);
	console.error(diffs.slice(0, 12).join('\n'));
	process.exit(1);
}

/*
 * Prove the Gate reads the reader's ACCESS and not the post's visibility.
 *
 *   node --env-file=.env scripts/ghost/check-access.mjs
 *
 * Every other check in this repo fetches pages signed out, which is exactly the blind spot on this
 * Surface: swap `{{#if access}}` for a test on `visibility` and the whole suite stays green while
 * every paying member is shown a paywall they already bought. That regression costs a publication
 * money and nothing else here can see it, so this script signs in.
 *
 * Three readers against three posts. The members are created through the Admin API, signed in with
 * real magic-link tokens, and deleted again — including when an assertion fails, because a probe
 * member left behind is a member the publication now has.
 *
 *   reader                     public   members-only   paid
 *   signed out                 article  Gate           Gate
 *   free member                article  article        Gate
 *   comped on a paid tier      article  article        article
 *
 * "Article" is not the absence of a Gate: a template that rendered nothing would pass that. It is
 * the presence of the things the Gate replaces — the headings the contents list is built from, and
 * the tag chips that close the body.
 */
import { api, base } from './admin.mjs';

const GATE = 'data-gate=';
const HEADING = /<h2 id="/g;
const CHIPS = 'Filed under';
const CORE_PANEL = 'class="gh-post-upgrade-cta';

const PROBES = [
	{ email: 'access-probe-free@mirror.test', name: 'Access Probe (free)', tier: null },
	{ email: 'access-probe-paid@mirror.test', name: 'Access Probe (paid)', tier: 'Basic' },
];

const problems = [];

/** The designed posts this checks, chosen from the fixture rather than named here. */
function posts(fixture) {
	const designed = fixture.posts.filter((post) => post.designed);
	const pick = (visibility) => designed.find((post) => post.visibility === visibility);
	const chosen = { public: pick('public'), members: pick('members'), paid: pick('paid') };
	for (const [visibility, post] of Object.entries(chosen)) {
		if (!post) {
			throw new Error(`no designed ${visibility} post in the fixture — this check has nothing to read`);
		}
	}
	return chosen;
}

/** Sign a member in and keep the cookie Ghost sets, the way a browser would. */
async function signIn(id) {
	const { member_signin_urls: urls } = await api('GET', `/members/${id}/signin_urls/`);
	const response = await fetch(urls[0].url, { redirect: 'manual' });
	const cookie = response.headers
		.getSetCookie()
		.map((line) => line.split(';')[0])
		.join('; ');
	if (!cookie.includes('ghost-members-ssr')) {
		throw new Error(`signing in member ${id} set no members cookie — got ${cookie || '(nothing)'}`);
	}
	return cookie;
}

async function read(slug, cookie) {
	const response = await fetch(`${base}/${slug}/`, { headers: cookie ? { cookie } : {} });
	if (!response.ok) {
		throw new Error(`/${slug}/ answered ${response.status}`);
	}
	return await response.text();
}

function assert(reader, slug, html, expected) {
	const gated = html.includes(GATE);
	const headings = (html.match(HEADING) ?? []).length;
	const chips = html.includes(CHIPS + '</span>');

	if (expected === 'gate') {
		if (!gated) {
			problems.push(`${reader} sees no Gate on /${slug}/ — the paywall is open`);
		}
		if (headings) {
			problems.push(`${reader} sees ${headings} body heading(s) on /${slug}/ behind the Gate`);
		}
		if (chips) {
			problems.push(`${reader} sees the tag chips on /${slug}/, which close the body the Gate replaced`);
		}
	} else {
		if (gated) {
			problems.push(`${reader} sees the Gate on /${slug}/, which this reader is entitled to`);
		}
		if (!headings) {
			problems.push(`${reader} sees no body headings on /${slug}/ — the article did not render`);
		}
		if (!chips) {
			problems.push(`${reader} sees no tag chips on /${slug}/ — the body did not close`);
		}
	}

	if (html.includes(CORE_PANEL)) {
		problems.push(
			`${reader} sees Ghost core's own upgrade panel on /${slug}/ — a template called {{content}} on a gated post`,
		);
	}
}

async function ensure(probe, tiers) {
	const filter = encodeURIComponent(`email:'${probe.email}'`);
	const found = await api('GET', `/members/?filter=${filter}`);
	if (found.members?.[0]) {
		return found.members[0];
	}
	const member = { email: probe.email, name: probe.name };
	if (probe.tier) {
		const tier = tiers.find((candidate) => candidate.name === probe.tier);
		if (!tier) {
			throw new Error(`no "${probe.tier}" tier on this publication — this check needs one to comp`);
		}
		member.status = 'comped';
		member.tiers = [{ id: tier.id }];
	}
	const created = await api('POST', '/members/', { members: [member] });
	return created.members[0];
}

async function remove(ids) {
	for (const id of ids) {
		await api('DELETE', `/members/${id}/`);
	}
}

const fixture = JSON.parse(await (await import('node:fs/promises')).readFile('scripts/ghost/fixture.json', 'utf8'));
const chosen = posts(fixture);
const created = [];

try {
	const { tiers } = await api('GET', '/tiers/?limit=all');

	assert('signed out', chosen.public.slug, await read(chosen.public.slug, null), 'article');
	assert('signed out', chosen.members.slug, await read(chosen.members.slug, null), 'gate');
	assert('signed out', chosen.paid.slug, await read(chosen.paid.slug, null), 'gate');

	for (const probe of PROBES) {
		const member = await ensure(probe, tiers);
		created.push(member.id);
		const cookie = await signIn(member.id);
		const reader = probe.tier ? `member comped on ${probe.tier}` : 'free member';

		assert(reader, chosen.public.slug, await read(chosen.public.slug, cookie), 'article');
		assert(reader, chosen.members.slug, await read(chosen.members.slug, cookie), 'article');
		assert(reader, chosen.paid.slug, await read(chosen.paid.slug, cookie), probe.tier ? 'article' : 'gate');
	}
} finally {
	await remove(created);
}

if (problems.length) {
	console.error('the Gate is not reading the reader:');
	for (const problem of problems) {
		console.error(`  ${problem}`);
	}
	process.exit(1);
}

console.log(
	`access: 9 reads over 3 readers and 3 posts — the Gate stands for a reader without access to ` +
		`/${chosen.members.slug}/ or /${chosen.paid.slug}/ and for nobody else`,
);

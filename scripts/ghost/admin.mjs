/*
 * The Ghost Admin API, as an owner session.
 *
 * AUTH IS AN OWNER SESSION, NOT AN API KEY. An Admin API key looks like the right answer and is
 * not: integrations are refused by every endpoint these scripts need beyond content — importing db
 * content, editing a staff user, writing settings, tiers and recommendations all answer 403
 * (`API tokens do not have permission to access this endpoint`). Since the owner credentials are
 * required regardless, a key would be a second credential that only covers the easy half.
 * GHOST_ADMIN_EMAIL and GHOST_ADMIN_PASSWORD live in .env, which is gitignored.
 *
 * `ownerSession()` returns the headers rather than a fetch wrapper because one caller — the
 * importer's multipart upload — must send them *without* a Content-Type of its own, or Ghost
 * answers 415.
 */
const base = (process.env.GHOST_URL ?? 'http://localhost:2368').replace(/\/$/, '');

/** The owner session, memoised. One login per run. */
let sessionAuth;

export async function ownerSession() {
	if (sessionAuth) {
		return sessionAuth;
	}
	const email = process.env.GHOST_ADMIN_EMAIL;
	const password = process.env.GHOST_ADMIN_PASSWORD;
	if (!email || !password) {
		throw new Error('GHOST_ADMIN_EMAIL and GHOST_ADMIN_PASSWORD are required: the Admin API needs an owner login.');
	}
	const response = await fetch(`${base}/ghost/api/admin/session/`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'Accept-Version': 'v6.0', Origin: base },
		body: JSON.stringify({ username: email, password }),
	});
	if (!response.ok) {
		throw new Error(`session → ${response.status} ${(await response.text()).slice(0, 200)}`);
	}
	sessionAuth = {
		Cookie: response.headers
			.getSetCookie()
			.map((cookie) => cookie.split(';')[0])
			.join('; '),
		Origin: base,
	};
	return sessionAuth;
}

/**
 * One Admin API call, with Ghost's own error message rather than a slice of raw JSON.
 *
 * `body === undefined` rather than `body ?` on purpose: a falsy body that is not undefined is still
 * a body.
 */
export async function api(method, path, body) {
	const auth = await ownerSession();
	const response = await fetch(`${base}/ghost/api/admin${path}`, {
		method,
		headers: { ...auth, 'Content-Type': 'application/json', 'Accept-Version': 'v6.0' },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const text = await response.text();
	const payload = text ? JSON.parse(text) : {};
	if (!response.ok) {
		const detail = payload.errors?.[0];
		throw new Error(
			`${method} ${path} → ${response.status} ${detail?.context ?? detail?.message ?? text.slice(0, 200)}`,
		);
	}
	return payload;
}

export { base };

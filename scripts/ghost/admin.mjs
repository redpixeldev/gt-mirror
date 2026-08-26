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

/*
 * One request, retried past a dead keep-alive socket.
 *
 * Node's fetch pools connections and Ghost closes an idle one, so a call made after a pause —
 * which is exactly what the scoring run does, between one settings group's screenshots and the
 * next group's write — lands on a socket the server has already dropped and throws
 * `TypeError: fetch failed` with `cause.code === 'ECONNRESET'`. Nothing about the request was
 * wrong, so the run must not end there: it failed a twenty-minute capture run at the handover
 * between groups.
 *
 * TWO conditions, and the second one is the load-bearing one. A transport failure is not proof
 * that Ghost never saw the request: ECONNREFUSED is, but a reset or a timeout can land on a
 * request the server already processed. So only a method that can be repeated without creating
 * anything is retried — GET, HEAD and the settings PUTs the scoring run makes. A POST that
 * creates a post, a tag or a tier is never retried (a duplicate is worse than a failed run) and
 * neither is a DELETE (a second one answers 404, which reads as a failure that did not happen).
 *
 * A response — any response, including a 500 — is returned untouched, because retrying a request
 * Ghost answered would hide a real result.
 */
const TRANSPORT = new Set(['ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ETIMEDOUT', 'UND_ERR_SOCKET']);
const REPEATABLE = new Set(['GET', 'HEAD', 'PUT']);

export async function request(url, init, attempts = 3) {
	const repeatable = REPEATABLE.has((init?.method ?? 'GET').toUpperCase());
	for (let attempt = 1; ; attempt += 1) {
		try {
			return await fetch(url, init);
		} catch (error) {
			const code = error.cause?.code;
			if (!repeatable || attempt >= attempts || !TRANSPORT.has(code)) {
				throw error;
			}
			await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
		}
	}
}

/**
 * One Admin API call, with Ghost's own error message rather than a slice of raw JSON.
 *
 * `body === undefined` rather than `body ?` on purpose: a falsy body that is not undefined is still
 * a body.
 */
export async function api(method, path, body) {
	const auth = await ownerSession();
	const response = await request(`${base}/ghost/api/admin${path}`, {
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

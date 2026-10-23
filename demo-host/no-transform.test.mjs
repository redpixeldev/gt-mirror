import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';

import { installNoTransform } from './no-transform.mjs';

/* A real server, because the bug this guards against is the header not reaching the wire: Express and
 * Ghost's static middleware never call writeHead themselves, they set headers and end, and Node writes
 * the head implicitly. */
const routes = {
	'/post/': { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' },
	'/members/': { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache, private, no-store' },
	'/bare/': { 'content-type': 'text/html' },
	'/already/': { 'content-type': 'text/html', 'cache-control': 'public, No-Transform' },
	'/screen.css': { 'content-type': 'text/css; charset=UTF-8', 'cache-control': 'public, max-age=31536000' },
};

let server;
let base;

before(async () => {
	installNoTransform();
	server = createServer((req, res) => {
		for (const [name, value] of Object.entries(routes[req.url])) res.setHeader(name, value);
		res.end('body');
	});
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const cacheControl = async (path) => (await fetch(base + path)).headers.get('cache-control');

test('an HTML page keeps its caching and adds no-transform, so Cloudflare injects no script', async () => {
	assert.equal(await cacheControl('/post/'), 'public, max-age=3600, no-transform');
	assert.equal(await cacheControl('/members/'), 'no-cache, private, no-store, no-transform');
});

test('an HTML page with no Cache-Control of its own still gets no-transform', async () => {
	assert.equal(await cacheControl('/bare/'), 'no-transform');
});

test('a directive already present is not repeated', async () => {
	assert.equal(await cacheControl('/already/'), 'public, No-Transform');
});

test('assets are left alone, so Cloudflare may still compress them', async () => {
	assert.equal(await cacheControl('/screen.css'), 'public, max-age=31536000');
});

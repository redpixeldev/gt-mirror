import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isSource, originalOf, variantKey, variants } from './presize.mjs';

/* A key that does not match the URL Ghost writes is a 404 on the Demo site, silently: the browser
 * shows a broken image and nothing logs. These are Ghost's own spellings, from
 * frontend/utils/images.js getImageWithSize and core/server/lib/image/blog-icon.js. */
const KEY = 'content/images/2026/10/pexels-1.jpg';

test('a theme size in WebP lands where img_url format="webp" points', () => {
	assert.equal(
		variantKey(KEY, { dir: 'w800', format: 'webp' }),
		'content/images/size/w800/format/webp/2026/10/pexels-1.jpg',
	);
});

test('a size in the original format has no format segment', () => {
	assert.equal(variantKey(KEY, { dir: 'w600', format: null }), 'content/images/size/w600/2026/10/pexels-1.jpg');
});

const theme = { s: { width: 320 }, ml: { width: 800 }, xl: { width: 1200 } };
const ghost = { 'social-image': { width: 1200 }, icon: { width: 256, height: 256 }, w1600: { width: 1600 } };
const ids = variants(theme, ghost).map(({ dir, format }) => `${dir}${format ? `/${format}` : ''}`);

test('theme sizes come in the original format and in WebP, because the srcset asks for WebP', () => {
	for (const id of ['w320', 'w320/webp', 'w800', 'w800/webp']) assert.ok(ids.includes(id), id);
});

test('the publication icon’s 256×256 size is made, as blog-icon.js names it', () => {
	assert.ok(ids.includes('w256h256'));
});

test('Ghost-only sizes come in the original format only, which is all Ghost links them as', () => {
	assert.ok(ids.includes('w1600'));
	assert.ok(!ids.includes('w1600/webp'));
});

test('a dimension named twice is made once', () => {
	assert.equal(ids.filter((id) => id === 'w1200').length, 1);
});

test('sizes and the _o originals Ghost keeps are not themselves sized', () => {
	assert.ok(isSource(KEY));
	assert.ok(!isSource('content/images/size/w600/2026/10/pexels-1.jpg'));
	assert.ok(!isSource('content/images/2026/10/pexels-1_o.jpg'));
	assert.ok(!isSource('images/2026/10/pexels-1.jpg'));
});

test('the unoptimised original sits beside the upload with an _o suffix', () => {
	assert.equal(originalOf(KEY), 'content/images/2026/10/pexels-1_o.jpg');
});

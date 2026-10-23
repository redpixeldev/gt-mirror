/*
 * Put every image size Ghost will link to into the bucket, so the Demo site serves responsive images.
 *
 *   node presize.mjs        (on the Cloud environment: `cloud command:run <env> --cmd "node presize.mjs"`)
 *
 * On a buyer's Ghost a `/content/images/size/w800/format/webp/…` URL is answered by Ghost itself,
 * which resizes the original on first request (frontend/web/middleware/handle-image-sizes.js). On
 * the Demo site those URLs point at the bucket (`urls.image`, ghost-config.mjs), which cannot
 * resize. Routing them through Ghost instead is no answer: S3Storage.serve() answers every image
 * with a 301 to the bucket, and saveRaw() stores sizes with no Content-Type. So this uploads, ahead
 * of time, every size Ghost can name — the theme's image_sizes in the original format and in WebP
 * (partials/image-srcset.hbs), Ghost's content sizes (Koenig's srcset) and its internal sizes (the
 * publication icon's w256h256 above all) — made by Ghost's own transform, with Ghost's own options,
 * from the `_o` original Ghost keeps beside each upload. A file Ghost would not resize (an .ico, an
 * .svg without a format) is copied unchanged, because Ghost would redirect to the original.
 *
 * Every size and every original gets a year-long Cache-Control: an image key never changes content
 * (Ghost uploads a renamed file rather than overwrite one), and the bucket otherwise sends none.
 *
 * Idempotent: a size already in the bucket is skipped, and an original whose Cache-Control is
 * already right is not rewritten. It runs where Ghost and the bucket credentials already are — the
 * deploy's own `current/` supplies the S3 client and the transform, so nothing is installed for it.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join } from 'node:path';

export const PREFIX = 'content/images/';
export const CACHE_CONTROL = 'public, max-age=31536000, immutable';

/* Ghost's size directory name for a dimension config: `w800`, `w256h256` (images.js getImageWithSize). */
const dirName = ({ width, height }) => (width ? `w${width}` : '') + (height ? `h${height}` : '');

/*
 * Every variant a key can be asked for. Theme sizes come in the original format and in WebP; Ghost's
 * own sizes only in the original, which is all Ghost ever links them as. Duplicate dimensions (the
 * theme's 1200 and Ghost's social image) collapse to one directory, as they do in Ghost's lookup.
 */
export function variants(themeSizes, ghostSizes) {
	const seen = new Map();
	const add = (dims, format) => {
		const dir = dirName(dims);
		if (!dir) return;
		const id = `${dir}|${format ?? ''}`;
		if (!seen.has(id)) seen.set(id, { dir, width: dims.width, height: dims.height, format });
	};
	for (const dims of Object.values(themeSizes)) {
		add(dims, null);
		add(dims, 'webp');
	}
	for (const dims of Object.values(ghostSizes)) add(dims, null);
	return [...seen.values()];
}

/* `content/images/2026/10/x.jpg` + a variant → `content/images/size/w800/format/webp/2026/10/x.jpg`. */
export function variantKey(key, { dir, format }) {
	const rest = key.slice(PREFIX.length);
	return `${PREFIX}size/${dir}/${format ? `format/${format}/` : ''}${rest}`;
}

/* The uploads Ghost links to: not a size, not the `_o` original kept beside an optimised upload. */
export const isSource = (key) =>
	key.startsWith(PREFIX) && !key.startsWith(`${PREFIX}size/`) && !/_o\.[^./]+$/.test(key);

export const originalOf = (key) => key.replace(/(\.[^./]+)$/, '_o$1');

async function main() {
	const here = import.meta.dirname;
	const ghostRequire = createRequire(join(here, 'current/package.json'));
	const s3 = ghostRequire('@aws-sdk/client-s3');
	const transform = ghostRequire('@tryghost/image-transform');

	const missing = ['AWS_BUCKET', 'AWS_ENDPOINT_URL', 'AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'].filter(
		(name) => !process.env[name],
	);
	if (missing.length) throw new Error(`missing environment variables: ${missing.join(', ')}`);

	const Bucket = process.env.AWS_BUCKET;
	const client = new s3.S3Client({
		endpoint: process.env.AWS_ENDPOINT_URL,
		region: process.env.AWS_REGION,
		forcePathStyle: true,
		credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY },
	});

	const themeSizes = JSON.parse(readFileSync(join(here, 'content/themes/mirror/package.json'), 'utf8')).config
		.image_sizes;
	const { contentImageSizes, internalImageSizes } = JSON.parse(
		readFileSync(join(here, 'current/core/shared/config/overrides.json'), 'utf8'),
	).imageOptimization;
	const wanted = variants(themeSizes, { ...contentImageSizes, ...internalImageSizes });

	const keys = new Set();
	let ContinuationToken;
	do {
		const page = await client.send(new s3.ListObjectsV2Command({ Bucket, Prefix: PREFIX, ContinuationToken }));
		for (const object of page.Contents ?? []) keys.add(object.Key);
		ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
	} while (ContinuationToken);

	const read = async (Key) => {
		const object = await client.send(new s3.GetObjectCommand({ Bucket, Key }));
		return { body: Buffer.from(await object.Body.transformToByteArray()), type: object.ContentType };
	};

	const counts = { made: 0, copied: 0, present: 0, recached: 0 };
	for (const key of [...keys].filter(isSource).sort()) {
		const ext = extname(key).toLowerCase();
		const missing = wanted.filter((variant) => !keys.has(variantKey(key, variant)));
		counts.present += wanted.length - missing.length;
		const source = missing.length ? await read(keys.has(originalOf(key)) ? originalOf(key) : key) : null;

		await Promise.all(
			missing.map(async (variant) => {
				const Key = variantKey(key, variant);
				const resize =
					transform.canTransformFileExtension(ext) &&
					(variant.format ? transform.canTransformToFormat(variant.format) : transform.shouldResizeFileExtension(ext));
				const Body = resize
					? await transform.resizeFromBuffer(source.body, {
							withoutEnlargement: ext !== '.svg',
							width: variant.width,
							height: variant.height,
							format: variant.format,
							timeout: 10,
						})
					: source.body;
				await client.send(
					new s3.PutObjectCommand({
						Bucket,
						Key,
						Body,
						ContentType: resize && variant.format ? `image/${variant.format}` : source.type,
						CacheControl: CACHE_CONTROL,
					}),
				);
				counts[resize ? 'made' : 'copied'] += 1;
			}),
		);

		for (const Key of [key, originalOf(key)].filter((k) => keys.has(k))) {
			const head = await client.send(new s3.HeadObjectCommand({ Bucket, Key }));
			if (head.CacheControl === CACHE_CONTROL) continue;
			await client.send(
				new s3.CopyObjectCommand({
					Bucket,
					Key,
					CopySource: `${Bucket}/${encodeURIComponent(Key).replace(/%2F/g, '/')}`,
					MetadataDirective: 'REPLACE',
					ContentType: head.ContentType,
					CacheControl: CACHE_CONTROL,
				}),
			);
			counts.recached += 1;
		}
	}

	console.log(
		`presize: ${[...keys].filter(isSource).length} images × ${wanted.length} sizes — ` +
			`${counts.made} made, ${counts.copied} copied unresized, ${counts.present} already present; ` +
			`${counts.recached} originals given a cache lifetime`,
	);
}

if (process.argv[1] === import.meta.filename) {
	await main();
}

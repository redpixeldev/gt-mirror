/*
 * Laravel Cloud's environment, as Ghost configuration.
 *
 * Cloud injects its own names (PORT, DATABASE_URL, AWS_*, APP_URL); Ghost reads only its own nested keys
 * and falls back without a word when one is absent — to SQLite, to local disk, to 127.0.0.1. On a
 * Cloud instance every one of those fallbacks is a silent failure: the disk is wiped on each deploy,
 * reboot and wake, and the startup probe arrives over IPv6. So the mapping is explicit and a
 * missing variable stops the boot (docs/adr/0007-the-demo-site-runs-on-laravel-cloud.md).
 *
 * Everything Ghost writes goes to the attached bucket through the S3 adapters Ghost itself ships:
 * uploads, routes.yaml and redirects. The theme is the one thing with no S3 store, so build.mjs
 * bakes it into the deploy. AWS_URL is the bucket's public base URL, which Cloud shows on the
 * bucket's settings page but does not inject; it has to be added to the environment by hand.
 */
const REQUIRED = [
	'PORT',
	'APP_URL',
	'DATABASE_URL',
	'AWS_BUCKET',
	'AWS_ENDPOINT_URL',
	'AWS_REGION',
	'AWS_ACCESS_KEY_ID',
	'AWS_SECRET_ACCESS_KEY',
	'AWS_URL',
];

export function ghostConfig(env, { contentPath }) {
	const missing = REQUIRED.filter((name) => !env[name]);
	if (missing.length) {
		throw new Error(`missing environment variables: ${missing.join(', ')}`);
	}

	const bucket = {
		bucket: env.AWS_BUCKET,
		endpoint: env.AWS_ENDPOINT_URL,
		region: env.AWS_REGION,
		forcePathStyle: true,
		accessKeyId: env.AWS_ACCESS_KEY_ID,
		secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
	};

	/* A Node app gets its database as one `mysql://user:pass@host:port/name` (the DB_HOST family
	 * is a Laravel app's). Credentials are percent-encoded in a URL; Ghost wants them raw. */
	const db = new URL(env.DATABASE_URL);

	return {
		url: env.APP_URL,
		server: { host: '::', port: Number(env.PORT) },
		paths: { contentPath },
		caching: { frontend: { maxAge: 3600 } },
		security: { staffDeviceVerification: false },
		logging: { transports: ['stdout'] },
		/* Bucket URLs count as Ghost's own images only under `urls.image` (storage/utils.js
		 * isInternalImage); anything else is external, and `img_url` returns it unsized. */
		urls: { image: env.AWS_URL.replace(/\/+$/, '') },
		database: {
			client: 'mysql',
			connection: {
				host: db.hostname,
				port: Number(db.port || 3306),
				user: decodeURIComponent(db.username),
				password: decodeURIComponent(db.password),
				database: decodeURIComponent(db.pathname.slice(1)),
			},
		},
		/* Images live under `content/images/` because that segment is what Ghost splits on to insert
		 * `/size/w…/` (frontend/utils/images.js getImageWithSize) — without it no size URL can be
		 * built. The bucket has no resizer, so presize.mjs uploads every size those URLs name,
		 * including the publication icon's `/size/w256h256/` (core/server/lib/image/blog-icon.js). */
		storage: {
			active: 'S3Storage',
			media: { adapter: 'S3Storage', staticFileURLPrefix: 'media' },
			files: { adapter: 'S3Storage', staticFileURLPrefix: 'files' },
			S3Storage: {
				...bucket,
				staticFileURLPrefix: 'content/images',
				cdnUrl: env.AWS_URL,
				multipartUploadThresholdBytes: 50 * 1024 * 1024,
				multipartChunkSizeBytes: 10 * 1024 * 1024,
			},
		},
		adapters: {
			'route-settings': {
				active: 'S3RouteSettingsStore',
				S3RouteSettingsStore: { ...bucket, staticFileURLPrefix: 'settings' },
			},
			redirects: {
				active: 'S3RedirectsStore',
				S3RedirectsStore: { ...bucket, staticFileURLPrefix: 'data' },
			},
		},
	};
}

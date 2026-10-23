/*
 * Laravel Cloud's environment, as Ghost configuration.
 *
 * Cloud injects its own names (PORT, DB_*, AWS_*, APP_URL); Ghost reads only its own nested keys
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
	'DB_HOST',
	'DB_USERNAME',
	'DB_PASSWORD',
	'DB_DATABASE',
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

	return {
		url: env.APP_URL,
		server: { host: '::', port: Number(env.PORT) },
		paths: { contentPath },
		caching: { frontend: { maxAge: 3600 } },
		security: { staffDeviceVerification: false },
		logging: { transports: ['stdout'] },
		database: {
			client: 'mysql',
			connection: {
				host: env.DB_HOST,
				port: Number(env.DB_PORT || 3306),
				user: env.DB_USERNAME,
				password: env.DB_PASSWORD,
				database: env.DB_DATABASE,
			},
		},
		/* Keys carry no `content/` segment: Ghost rewrites `/content/images/` in the publication
		 * icon's URL into a `/size/w256h256/` path (core/server/lib/image/blog-icon.js) that only its
		 * local, on-demand resizer can serve. The bucket has no resizer, so that would be a 404. */
		storage: {
			active: 'S3Storage',
			media: { adapter: 'S3Storage', staticFileURLPrefix: 'media' },
			files: { adapter: 'S3Storage', staticFileURLPrefix: 'files' },
			S3Storage: {
				...bucket,
				staticFileURLPrefix: 'images',
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

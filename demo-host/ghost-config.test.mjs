import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ghostConfig } from './ghost-config.mjs';

/* What Laravel Cloud injects into a Node environment with a MySQL database and a public bucket
 * attached, plus the AWS_URL the operator copies in by hand (Cloud does not inject it). */
const cloud = {
	PORT: '8080',
	APP_URL: 'https://mirror-demo-main-abc123.laravel.cloud',
	DB_HOST: 'db-123.us-east-2.public.db.laravel.cloud',
	DB_PORT: '3306',
	DB_USERNAME: 'ghost',
	DB_PASSWORD: '01234',
	DB_DATABASE: 'main',
	AWS_BUCKET: 'fls-mirror-demo',
	AWS_ENDPOINT_URL: 'https://acct.r2.cloudflarestorage.com',
	AWS_REGION: 'auto',
	AWS_ACCESS_KEY_ID: 'key',
	AWS_SECRET_ACCESS_KEY: 'secret',
	AWS_URL: 'https://fls-mirror-demo.laravel.cloud/',
};

const CONTENT = '/app/content';

test('Ghost talks to the attached MySQL database, not its default SQLite file', () => {
	assert.deepEqual(ghostConfig(cloud, { contentPath: CONTENT }).database, {
		client: 'mysql',
		connection: {
			host: 'db-123.us-east-2.public.db.laravel.cloud',
			port: 3306,
			user: 'ghost',
			password: '01234',
			database: 'main',
		},
	});
});

test('Ghost listens on every interface at Cloud’s port, because Cloud probes over IPv6', () => {
	assert.deepEqual(ghostConfig(cloud, { contentPath: CONTENT }).server, { host: '::', port: 8080 });
});

test('the public URL is the one Cloud assigned to the environment', () => {
	assert.equal(ghostConfig(cloud, { contentPath: CONTENT }).url, 'https://mirror-demo-main-abc123.laravel.cloud');
});

/* The connection every S3 adapter gets: an explicit endpoint, because the AWS SDK for JavaScript
 * does not read AWS_ENDPOINT_URL, and path-style addressing, which R2 and MinIO both accept. */
const bucket = {
	bucket: 'fls-mirror-demo',
	endpoint: 'https://acct.r2.cloudflarestorage.com',
	region: 'auto',
	forcePathStyle: true,
	accessKeyId: 'key',
	secretAccessKey: 'secret',
};

/* No `content/` in the keys. Ghost rewrites a `/content/images/` segment into `/size/w256h256/`
 * for the publication icon (core/server/lib/image/blog-icon.js), a path only Ghost's own
 * on-demand resizer can answer; on the bucket it is a 404 favicon on every page. */
test('uploads land in the bucket under keys Ghost will not rewrite into resize paths', () => {
	assert.deepEqual(ghostConfig(cloud, { contentPath: CONTENT }).storage, {
		active: 'S3Storage',
		media: { adapter: 'S3Storage', staticFileURLPrefix: 'media' },
		files: { adapter: 'S3Storage', staticFileURLPrefix: 'files' },
		S3Storage: {
			...bucket,
			staticFileURLPrefix: 'images',
			cdnUrl: 'https://fls-mirror-demo.laravel.cloud/',
			multipartUploadThresholdBytes: 52428800,
			multipartChunkSizeBytes: 10485760,
		},
	});
});

test('routes.yaml and redirects survive a reboot because they live in the bucket too', () => {
	const { adapters } = ghostConfig(cloud, { contentPath: CONTENT });
	assert.deepEqual(adapters['route-settings'], {
		active: 'S3RouteSettingsStore',
		S3RouteSettingsStore: { ...bucket, staticFileURLPrefix: 'settings' },
	});
	assert.deepEqual(adapters.redirects, {
		active: 'S3RedirectsStore',
		S3RedirectsStore: { ...bucket, staticFileURLPrefix: 'data' },
	});
});

test('a missing variable stops the boot and names every one that is missing', () => {
	const { AWS_URL, DB_PASSWORD, ...partial } = cloud;
	assert.throws(() => ghostConfig(partial, { contentPath: CONTENT }), {
		message: 'missing environment variables: DB_PASSWORD, AWS_URL',
	});
});

test('MySQL’s standard port is assumed when Cloud injects no DB_PORT', () => {
	const { DB_PORT, ...withoutPort } = cloud;
	assert.equal(ghostConfig(withoutPort, { contentPath: CONTENT }).database.connection.port, 3306);
});

test('themes come from the deploy’s own content directory, not the one inside node_modules/ghost', () => {
	assert.deepEqual(ghostConfig(cloud, { contentPath: CONTENT }).paths, { contentPath: '/app/content' });
});

test('pages may sit in Cloud’s edge cache for an hour, so a sleeping instance is not woken per visit', () => {
	assert.equal(ghostConfig(cloud, { contentPath: CONTENT }).caching.frontend.maxAge, 3600);
});

test('the seeding script can sign in as the owner without an emailed verification code', () => {
	assert.equal(ghostConfig(cloud, { contentPath: CONTENT }).security.staffDeviceVerification, false);
});

test('logs go to stdout, where Cloud’s log viewer reads them, not to a file on a wiped disk', () => {
	assert.deepEqual(ghostConfig(cloud, { contentPath: CONTENT }).logging.transports, ['stdout']);
});

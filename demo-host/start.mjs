/*
 * Boot Ghost with configuration derived from Laravel Cloud's environment.
 *
 * The derived values are written to config.<NODE_ENV>.json rather than into process.env, because
 * Ghost ranks environment variables above that file: anything set by hand on the Cloud environment
 * in Ghost's own spelling (`url`, `mail__transport`, `mail__options__host`, …) still wins over
 * what is derived here. Ghost reads the file from the working directory, hence the chdir.
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { ghostConfig } from './ghost-config.mjs';

const here = import.meta.dirname;
const env = process.env.NODE_ENV ?? 'production';
process.env.NODE_ENV = env;

const config = ghostConfig(process.env, { contentPath: join(here, 'content') });
writeFileSync(join(here, `config.${env}.json`), JSON.stringify(config, null, '\t') + '\n');

process.chdir(here);
createRequire(import.meta.url)('./current/index.js');

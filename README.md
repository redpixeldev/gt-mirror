# Astro Tailwind CSS Starter

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                    | Action                                      |
| :------------------------- | :------------------------------------------ |
| `pnpm install`             | Installs dependencies                       |
| `pnpm dev or pnpm develop` | Starts local dev server at `localhost:3000` |
| `pnpm build`               | Build your production site to `./dist/`     |


## Cloudflare Deployment

Change the name property on `wrangler.jsonc` to the name of the project since its using the default one from the astro starter repo template. The deploy command to set on Cloudflare is `npx wrangler deploy`

import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  compressHTML: false,

  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Inter',
      cssVariable: '--font-inter',
      weights: [400, 500, 600, 700],
      styles: ['normal'],
    },
  ],

  build: {
      assets: 'assets',
      format: 'file',
	},

  vite: {
      plugins: [tailwindcss()],
      build: {
          assetsInlineLimit: 0,
          rollupOptions: {
              output: {
                  entryFileNames: 'assets/main.js',
                  assetFileNames: 'assets/main[extname]',
              },
          },
      },
	},

  output: 'static',
});

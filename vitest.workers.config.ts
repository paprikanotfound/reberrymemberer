import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite'
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
	plugins: [
		paraglideVitePlugin({ project: './project.inlang', outdir: './src/lib/paraglide', disableAsyncLocalStorage: true }),
		tailwindcss(), 
		sveltekit(),
    svelteTesting(),
	],
  test: {
    include: ['tests/integration/**/*.test.ts'],
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
      },
    },
  },
});
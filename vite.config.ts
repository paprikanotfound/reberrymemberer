import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite'
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		paraglideVitePlugin({ project: './project.inlang', outdir: './src/lib/paraglide', disableAsyncLocalStorage: true }),
		tailwindcss(), 
		sveltekit(),
    svelteTesting(),
	],
  test: {
    environment: 'jsdom',
    globals: true,
    // environment: 'browser',
    // browser: {
    //   enabled: true,
    //   provider: 'playwright',
    //   instances: [{ browser: 'chromium' }]
    // },
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['./vitest-setup-client.ts']
  }
});

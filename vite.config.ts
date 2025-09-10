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
    environment: 'jsdom', // ← for @testing-library/svelte
    globals: true, // ← this is crucial
    // environment: 'browser',
    // browser: {
    //   enabled: true,
    //   provider: 'playwright',
    //   instances: [{ browser: 'chromium' }]
    // },
    include: ['tests/unit/**/*.test.ts'],
    // include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
    // exclude: ['src/lib/server/**'],
    setupFiles: ['./vitest-setup-client.ts']
  }
	// test: {
	// 	projects: [
	// 		{
	// 			extends: './vite.config.ts',
	// 			test: {
	// 				name: 'client',
	// 				environment: 'browser',
	// 				browser: {
	// 					enabled: true,
	// 					provider: 'playwright',
	// 					instances: [{ browser: 'chromium' }]
	// 				},
	// 				include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
	// 				exclude: ['src/lib/server/**'],
	// 				setupFiles: ['./vitest-setup-client.ts']
	// 			}
	// 		},
	// 		{
	// 			extends: './vite.config.ts',
	// 			test: {
	// 				name: 'server',
	// 				environment: 'node',
	// 				include: ['src/**/*.{test,spec}.{js,ts}'],
	// 				exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
	// 			}
	// 		}
	// 	]
	// }
});

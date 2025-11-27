import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.{test,spec}.{js,ts,svelte}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,svelte}'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/routes/**/*.svelte' // Exclude page components for now
      ]
    }
  },
  resolve: {
    alias: {
      '$lib': resolve('./src/lib'),
      '$app': resolve('./node_modules/@sveltejs/kit'),
      '$env/static/public': resolve('./tests/mocks/env.ts')
    }
  }
});

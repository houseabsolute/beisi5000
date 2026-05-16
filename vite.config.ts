/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { alphaTab } from '@coderline/alphatab-vite';

export default defineConfig({
  plugins: [svelte(), alphaTab()],
  server: {
    host: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

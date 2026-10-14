/// <reference types="vitest" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Served from https://<user>.github.io/langbang/ on GitHub Pages.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/langbang/',
  plugins: [preact()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

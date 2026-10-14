/// <reference types="vitest" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Cache-buster for public/data/*.json: changes whenever the data are rebuilt.
let dataVersion = 'dev';
try {
  dataVersion = createHash('sha1').update(readFileSync('public/data/meta.json')).update(readFileSync('public/data/core.json')).digest('hex').slice(0, 10);
} catch {
  /* data not built yet */
}

// Served from https://<user>.github.io/langbang/ on GitHub Pages.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/langbang/',
  plugins: [preact()],
  define: { __DATA_VERSION__: JSON.stringify(dataVersion) },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

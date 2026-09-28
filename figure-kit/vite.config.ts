import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // Babylon.js is one big chunk. That is fine here.
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
  server: { port: 5174 },
});

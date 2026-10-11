import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: {
      // Only the game page. Old pages (diorama, valley.html) live in legacy/valley-v1/.
      input: { main: 'index.html' },
    },
    chunkSizeWarningLimit: 4000,
  },
  server: { port: 5173, strictPort: true },
});

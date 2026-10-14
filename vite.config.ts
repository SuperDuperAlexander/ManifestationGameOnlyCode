import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: {
      input: { main: 'index.html', villagers: 'villager-kit/index.html' },
    },
    chunkSizeWarningLimit: 4000,
  },
  server: { port: 5173, strictPort: true },
});

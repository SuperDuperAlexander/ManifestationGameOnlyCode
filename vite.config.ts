import { readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/** PNG files are the art originals. Only the WebP copies go online. */
function stripPngFromDist(): Plugin {
  let outDir = 'dist';
  return {
    name: 'strip-png-from-dist',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      let removed = 0;
      const walk = (dir: string): void => {
        for (const name of readdirSync(dir)) {
          const path = join(dir, name);
          if (statSync(path).isDirectory()) walk(path);
          else if (name.toLowerCase().endsWith('.png')) {
            rmSync(path);
            removed++;
          }
        }
      };
      walk(outDir);
      console.log(`strip-png-from-dist: removed ${removed} PNG file(s) from ${outDir}`);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [stripPngFromDist()],
  build: {
    target: 'es2022',
    rollupOptions: {
      // index.html = the game, valley.html = the code-only test valley.
      input: { main: 'index.html', valley: 'valley.html' },
    },
    chunkSizeWarningLimit: 4000,
  },
  server: { port: 5173, strictPort: true },
});

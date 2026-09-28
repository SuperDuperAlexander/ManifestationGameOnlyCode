import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

/**
 * A build stamp shown on the start screen.
 *
 * Three times in a row a change was reported as done and the game on the other
 * screen was an older build. A version you can read off the start screen ends
 * that argument in one second: if the stamp does not match, the build is old,
 * whatever anyone believes.
 */
function buildStamp(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim().length > 0;
    return `${sha}${dirty ? '+' : ''}`;
  } catch {
    return 'local';
  }
}

const STAMP = `${buildStamp()} ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

export default defineConfig({
  define: { __BUILD_STAMP__: JSON.stringify(STAMP) },
  base: './',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});

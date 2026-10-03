import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Both apps import shared UI and bundled fonts from the frontend workspace.
export default defineConfig({
  server: { fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
});

// Vite build for the static SPA (AD-3): emits packages/web/dist, served by nginx.
//
// Dev proxy (Story 2.4): the SPA runs on :5173 and the backend on :3000 — different
// origins, so the `sid` session cookie set by :3000 would not ride along on the
// SPA's fetches, and SameSite=Lax blocks cross-origin cookies. Proxying /api and
// /health to the backend makes the whole dev flow same-origin, so the cookie is
// scoped to :5173 and sent automatically. In prod nginx fronts /api the same way.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/health': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});

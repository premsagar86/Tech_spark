import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Mirrors the Amplify rewrite rule used in production (Console →
    // Rewrites and redirects, /api/<*> → the Railway backend) — without
    // this, VITE_API_URL being a relative path (see frontend/.env) would
    // resolve to the Vite dev server itself, which doesn't serve the API.
    proxy: {
      '/api': {
        target: 'https://acceptable-commitment-production-d2e1.up.railway.app',
        changeOrigin: true,
      },
    },
  },
})

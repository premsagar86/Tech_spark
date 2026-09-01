import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Vite doesn't populate process.env from .env inside the config file, so load
  // it explicitly. VITE_API_PROXY_TARGET is dev-only — it's the Railway backend
  // the dev server proxies /api/* to, mirroring the vercel.json rewrite used in
  // production. VITE_API_URL itself stays empty (see frontend/.env) so the app
  // always makes same-origin /api/* requests.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET,
          changeOrigin: true,
        },
      },
    },
  }
})

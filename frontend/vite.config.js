import { fileURLToPath } from 'node:url'
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
    resolve: {
      alias: {
        // The proctoring SDK lives in the sibling proctor/ workspace so it stays
        // reusable by other sites. It's dependency-free plain ESM, so aliasing
        // straight at the source (rather than a published package) works for
        // both `vite dev` and `vite build` — the full repo is present at build
        // time on Amplify too. If you ever move proctor/ out of this repo,
        // publish @techspark/proctor-sdk and swap this alias for the package.
        '@techspark/proctor-sdk': fileURLToPath(
          new URL('../proctor/sdk/src/index.js', import.meta.url)
        ),
      },
    },
    server: {
      // Allow importing the SDK from outside the frontend/ root in dev.
      fs: { allow: ['..'] },
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET,
          changeOrigin: true,
        },
      },
    },
  }
})

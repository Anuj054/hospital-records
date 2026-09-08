import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // listen on 0.0.0.0 so other devices on the same network can reach the dev server
    proxy: {
      // Mirrors the production setup (frontend/vercel.json): the app always
      // talks to /api on its own origin, so the auth cookie stays
      // first-party and there are no CORS preflights. It also means opening
      // the dev server from a phone on the same wifi just works, without
      // that device needing to reach port 5050 itself.
      '/api': { target: 'http://localhost:5050', changeOrigin: false },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Keep the big, rarely-changing libraries in their own chunk so an
        // app-code change doesn't force everyone to re-download React.
        // (Vite 8 runs rolldown, which wants a function here, not a map.)
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) {
            return 'react'
          }
        },
      },
    },
  },
})

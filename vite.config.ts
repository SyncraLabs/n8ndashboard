import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/n8n-proxy': {
        target: 'https://n8n.srv1256702.hstgr.cloud',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/n8n-proxy/, '')
      }
    }
  }
})

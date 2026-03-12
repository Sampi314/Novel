import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/Novel/' : '/',
  plugins: [
    react(),
  ],
  server: {
    proxy: {
      '/fmg': {
        target: 'http://localhost:5174',
        rewrite: path => path.replace(/^\/fmg/, ''),
      },
    },
  },
})

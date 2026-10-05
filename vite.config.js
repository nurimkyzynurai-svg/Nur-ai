import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Browser calls /api/... and Vite forwards them to the backend, which holds the API key.
    proxy: { '/api': 'http://localhost:8787' },
  },
})

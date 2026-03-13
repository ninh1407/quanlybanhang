import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.DESKTOP === 'true' ? './' : '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react'],
          'charts-vendor': ['recharts'],
          'utils-vendor': ['xlsx', 'date-fns']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})

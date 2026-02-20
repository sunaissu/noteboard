import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@sunaissu/noteboard': path.resolve(__dirname, '../src/index.tsx'),
    },
  },
})

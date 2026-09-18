import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  server: {
    host: true,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
})

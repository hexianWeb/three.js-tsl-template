import { defineConfig } from 'vite'
import { cp } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  plugins: [{
    name: 'public-assets-without-local-roms',
    apply: 'build',
    async writeBundle() {
      const publicRoot = resolve(projectRoot, 'public')
      // public/nds 仅用于本地验证；其余公共资源维持 Vite 的原样复制行为。
      await cp(publicRoot, resolve(projectRoot, 'dist'), {
        recursive: true,
        filter: source => source !== resolve(publicRoot, 'nds'),
      })
    },
  }],
  server: {
    host: true,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    copyPublicDir: false,
    rolldownOptions: {
      input: {
        main: resolve(projectRoot, 'src/index.html'),
        ndsTest: resolve(projectRoot, 'src/nds-test.html'),
      },
    },
  },
})

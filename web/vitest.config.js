import { defineConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

export default defineConfig({
  ...viteConfig,
  resolve: {
    ...viteConfig.resolve,
    conditions: ['browser']
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: { url: 'http://localhost' }
    },
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/store.test.ts'],
    setupFiles: './tests/setup.ts'
  }
})

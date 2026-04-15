import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'test-mocks': fileURLToPath(
        new URL('./tests/support/module-mocks.ts', import.meta.url),
      ),
    },
  },
})

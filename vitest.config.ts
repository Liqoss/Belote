import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './'),
      '@': path.resolve(__dirname, './')
    }
  },
  test: {
    globals: true,
    environment: 'node', // Changed from happy-dom to node since we test logic
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['server/utils/belote.ts'], // Focus on the engine
      exclude: ['**/*.spec.ts', '**/*.test.ts']
    }
  }
})

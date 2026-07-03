/* v8 ignore file -- @preserve */

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Integration tests share one Redis (and flush it); files must not run
    // concurrently.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'test/', 'dist/', '**/*.test.ts', '**/*.d.ts'],
    },
  },
})

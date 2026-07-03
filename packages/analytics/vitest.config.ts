/* v8 ignore file -- @preserve */

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Tests mutate shared process.env and global OTEL providers; files must
    // not run concurrently in the same process group.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'test/', 'dist/', '**/*.test.ts', '**/*.d.ts'],
    },
  },
})

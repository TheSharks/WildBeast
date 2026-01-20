import type { Config } from 'drizzle-kit'

export default {
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: globalThis.process?.env.DATABASE_URL ?? '',
  },
} satisfies Config

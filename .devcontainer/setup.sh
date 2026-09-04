#!/bin/bash

echo "🚀 Setting up devcontainer..."

# Wait for PostgreSQL to accept connections
echo "🔍 Checking PostgreSQL..."
until pg_isready -h db -p 5432 -U postgres > /dev/null 2>&1; do
  echo "⏳ Waiting for PostgreSQL to be ready..."
  sleep 3
done
echo "✅ PostgreSQL is ready"

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

# Apply the Drizzle migrations so the dev database has the current schema.
# Idempotent: a migrated database is a no-op.
echo "🗄️ Applying database migrations..."
pnpm --filter @thesharks/drizzle migrate

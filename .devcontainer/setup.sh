#!/bin/bash

echo "🚀 Setting up analytics for devcontainer..."

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check TimescaleDB
echo "🔍 Checking TimescaleDB..."
until pg_isready -h db -p 5432 -U postgres > /dev/null 2>&1; do
  echo "⏳ Waiting for TimescaleDB to be ready..."
  sleep 3
done
echo "✅ TimescaleDB is ready"

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

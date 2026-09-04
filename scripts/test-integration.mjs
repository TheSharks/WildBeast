#!/usr/bin/env node
// Full test run including the docker-gated integration suites: provisions a
// disposable Postgres, Redis and an OpenTelemetry collector, applies the
// Drizzle migrations, points the test env at them, runs `turbo run test`,
// and tears everything down.
import { execFile, spawn } from 'node:child_process'
import { chmod, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const REDIS_CONTAINER = 'wildbeast-it-redis'
const OTEL_CONTAINER = 'wildbeast-it-otel'
const POSTGRES_CONTAINER = 'wildbeast-it-postgres'
const REDIS_PORT = 16379
const OTEL_GRPC_PORT = 14317
const OTEL_HTTP_PORT = 14318
const POSTGRES_PORT = 15432
const POSTGRES_PASSWORD = 'postgres'
const POSTGRES_DB = 'wildbeast'
const DATABASE_URL = `postgresql://postgres:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}`

async function docker(...args) {
  return execFileAsync('docker', args)
}

async function removeContainers() {
  for (const name of [REDIS_CONTAINER, OTEL_CONTAINER, POSTGRES_CONTAINER]) {
    await docker('rm', '-f', name).catch(() => undefined)
  }
}

async function waitFor(check, what, attempts = 40) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (await check().catch(() => false)) return
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 500))
  }
  throw new Error(`${what} did not become ready`)
}

async function main() {
  await docker('info').catch(() => {
    throw new Error('docker is required for integration tests')
  })

  await removeContainers()

  const otelOut = await mkdtemp(join(tmpdir(), 'wildbeast-otel-'))
  // The collector runs as an unprivileged user and must write here.
  await chmod(otelOut, 0o777)

  console.log('Starting Postgres, Redis and OpenTelemetry collector containers...')
  await docker(
    'run', '--rm', '-d',
    '--name', POSTGRES_CONTAINER,
    '-p', `${POSTGRES_PORT}:5432`,
    '-e', `POSTGRES_PASSWORD=${POSTGRES_PASSWORD}`,
    '-e', 'POSTGRES_USER=postgres',
    '-e', `POSTGRES_DB=${POSTGRES_DB}`,
    'postgres:17',
  )
  await docker(
    'run', '--rm', '-d',
    '--name', REDIS_CONTAINER,
    '-p', `${REDIS_PORT}:6379`,
    'redis:7-alpine',
  )
  await docker(
    'run', '--rm', '-d',
    '--name', OTEL_CONTAINER,
    '-p', `${OTEL_GRPC_PORT}:4317`,
    '-p', `${OTEL_HTTP_PORT}:4318`,
    '-v', `${join(root, 'packages/analytics/test/fixtures/otel-collector.yaml')}:/etc/otelcol-contrib/config.yaml`,
    '-v', `${otelOut}:/out`,
    // Pinned to match the devcontainer collector version.
    'otel/opentelemetry-collector-contrib:0.143.1',
  )

  await waitFor(async () => {
    const { stdout } = await docker('exec', REDIS_CONTAINER, 'redis-cli', 'ping')
    return stdout.includes('PONG')
  }, 'redis')
  await waitFor(async () => {
    await docker('exec', POSTGRES_CONTAINER, 'pg_isready', '-U', 'postgres')
    return true
  }, 'postgres')
  await waitFor(async () => {
    const { stdout, stderr } = await docker('logs', OTEL_CONTAINER)
    return `${stdout}${stderr}`.includes('Everything is ready')
  }, 'otel collector')

  // The DB suites assume the schema already exists, so migrate the
  // ephemeral database before running anything (mirrors the CI migrate step).
  console.log('Applying Drizzle migrations...')
  await execFileAsync('pnpm', ['--filter', '@thesharks/drizzle', 'migrate'], {
    cwd: root,
    env: { ...process.env, DATABASE_URL },
  })

  console.log('Infrastructure ready; running the test suite.')
  const exitCode = await new Promise((resolveExit) => {
    const child = spawn('pnpm', ['turbo', 'run', 'test'], {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL,
        REDIS_URL: `redis://localhost:${REDIS_PORT}`,
        OTEL_E2E_OUTPUT: join(otelOut, 'telemetry.json'),
      },
    })
    child.on('exit', (code) => resolveExit(code ?? 1))
  })

  process.exitCode = exitCode
}

try {
  await main()
} finally {
  await removeContainers()
}

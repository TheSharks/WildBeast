import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import { DURATION_SECONDS_BOUNDARIES } from '../src/utils/metrics.js'

/**
 * End-to-end test against a real OpenTelemetry collector. Runs only when
 * OTEL_E2E_OUTPUT points at the collector's file-exporter output, e.g.:
 *
 *   mkdir -p /tmp/otel-e2e && chmod 777 /tmp/otel-e2e
 *   docker run --rm -d --name otel-e2e \
 *     -p 14317:4317 -p 14318:4318 \
 *     -v $PWD/test/fixtures/otel-collector.yaml:/etc/otelcol-contrib/config.yaml \
 *     -v /tmp/otel-e2e:/out \
 *     otel/opentelemetry-collector-contrib:latest
 *   pnpm build
 *   OTEL_E2E_OUTPUT=/tmp/otel-e2e/telemetry.json pnpm test
 *
 * Requires a prior `pnpm build`: scenarios boot the real pipeline from dist
 * in child processes, so each one gets fresh global providers.
 */
const outputFile = process.env.OTEL_E2E_OUTPUT

const HTTP_ENDPOINT = process.env.OTEL_E2E_HTTP ?? 'http://localhost:14318'
const GRPC_ENDPOINT = process.env.OTEL_E2E_GRPC ?? 'grpc://localhost:14317'

const emitter = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'emit-telemetry.mjs',
)

const execFileAsync = promisify(execFile)

async function emit(serviceName: string, endpoint: string): Promise<void> {
  // Strip ambient OTEL_* configuration so only the scenario's endpoint
  // applies inside the child.
  const env: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith('OTEL_') && !key.startsWith('SENTRY_')) {
      env[key] = value
    }
  }
  env.E2E_SERVICE_NAME = serviceName
  env.OTEL_EXPORTER_OTLP_ENDPOINT = endpoint

  await execFileAsync('node', [emitter], { env, timeout: 60_000 })
}

type OtlpAttribute = {
  key: string
  value: Record<string, unknown>
}

function attributeMap(
  attributes: OtlpAttribute[] | undefined,
): Record<string, unknown> {
  const map: Record<string, unknown> = {}
  for (const attribute of attributes ?? []) {
    map[attribute.key] = Object.values(attribute.value)[0]
  }
  return map
}

interface CollectedTelemetry {
  spans: Array<Record<string, unknown> & { resource: Record<string, unknown> }>
  metrics: Array<
    Record<string, unknown> & { resource: Record<string, unknown> }
  >
  logRecords: Array<
    Record<string, unknown> & { resource: Record<string, unknown> }
  >
}

async function collectFor(serviceName: string): Promise<CollectedTelemetry> {
  const raw = await readFile(outputFile as string, 'utf8')
  const collected: CollectedTelemetry = {
    spans: [],
    metrics: [],
    logRecords: [],
  }

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    const envelope = JSON.parse(line)

    type OtlpRecord = Record<string, unknown>
    const groups = (
      key: string,
      scopeKey: string,
      itemKey: string,
    ): Array<OtlpRecord & { resource: Record<string, unknown> }> =>
      ((envelope[key] ?? []) as OtlpRecord[]).flatMap((resourceGroup) => {
        const resource = attributeMap(
          (
            resourceGroup.resource as
              | { attributes?: OtlpAttribute[] }
              | undefined
          )?.attributes,
        )
        if (resource['service.name'] !== serviceName) return []
        return ((resourceGroup[scopeKey] ?? []) as OtlpRecord[]).flatMap(
          (scope) =>
            ((scope[itemKey] ?? []) as OtlpRecord[]).map((item) => ({
              ...item,
              resource,
            })),
        )
      })

    collected.spans.push(...groups('resourceSpans', 'scopeSpans', 'spans'))
    collected.metrics.push(
      ...groups('resourceMetrics', 'scopeMetrics', 'metrics'),
    )
    collected.logRecords.push(
      ...groups('resourceLogs', 'scopeLogs', 'logRecords'),
    )
  }

  return collected
}

async function waitForTelemetry(
  serviceName: string,
  timeoutMillis = 15_000,
): Promise<CollectedTelemetry> {
  const deadline = Date.now() + timeoutMillis
  for (;;) {
    const collected = await collectFor(serviceName).catch(
      () => ({ spans: [], metrics: [], logRecords: [] }) as CollectedTelemetry,
    )
    if (
      collected.spans.length > 0 &&
      collected.metrics.length > 0 &&
      collected.logRecords.length > 0
    ) {
      return collected
    }
    if (Date.now() > deadline) {
      throw new Error(
        `Telemetry for ${serviceName} did not arrive at the collector in time`,
      )
    }
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 250))
  }
}

function assertScenario(
  serviceName: string,
  collected: CollectedTelemetry,
): void {
  // --- Traces ---
  const span = collected.spans.find((item) => item.name === 'e2e.operation')
  expect(span, 'span should reach the collector').toBeDefined()
  expect(attributeMap(span!.attributes as OtlpAttribute[])).toMatchObject({
    'e2e.marker': serviceName,
  })
  expect(
    (span!.events as Array<{ name: string }>).map((event) => event.name),
  ).toContain('e2e.event')

  // Resource attributes flow through on every signal.
  expect(span!.resource).toMatchObject({
    'service.name': serviceName,
    'service.namespace': 'e2e',
    'service.instance.id': '7',
    'cluster.id': 'e2e-cluster',
    'deployment.environment.name': 'e2e-test',
  })

  // --- Metrics ---
  const counter = collected.metrics.find(
    (metric) => metric.name === 'e2e_operations_total',
  )
  expect(counter, 'counter should reach the collector').toBeDefined()
  // biome-ignore lint/suspicious/noExplicitAny: raw OTLP JSON
  const counterPoint = (counter as any).sum.dataPoints[0]
  expect(Number(counterPoint.asInt ?? counterPoint.asDouble)).toBe(3)
  expect(attributeMap(counterPoint.attributes)).toMatchObject({
    scenario: serviceName,
  })

  const histogram = collected.metrics.find(
    (metric) => metric.name === 'e2e_duration_seconds',
  )
  expect(histogram, 'histogram should reach the collector').toBeDefined()
  // biome-ignore lint/suspicious/noExplicitAny: raw OTLP JSON
  const histogramPoint = (histogram as any).histogram.dataPoints[0]
  // The bucket advice must survive the whole pipeline.
  expect(histogramPoint.explicitBounds).toEqual(DURATION_SECONDS_BOUNDARIES)
  expect(Number(histogramPoint.count)).toBe(1)
  expect(histogramPoint.sum).toBeCloseTo(0.3)

  // --- Logs ---
  const bodies = collected.logRecords.map(
    // biome-ignore lint/suspicious/noExplicitAny: raw OTLP JSON
    (record: any) => record.body?.stringValue,
  )

  const info = collected.logRecords.find(
    // biome-ignore lint/suspicious/noExplicitAny: raw OTLP JSON
    (record: any) => record.body?.stringValue === `e2e info ${serviceName}`,
  )
  expect(info, 'bridge log should reach the collector').toBeDefined()
  // biome-ignore lint/suspicious/noExplicitAny: raw OTLP JSON
  expect((info as any).severityText).toBe('Info')
  // biome-ignore lint/suspicious/noExplicitAny: raw OTLP JSON
  expect(attributeMap((info as any).attributes)).toMatchObject({
    source: 'sapphire-logger',
  })

  const warn = collected.logRecords.find(
    // biome-ignore lint/suspicious/noExplicitAny: raw OTLP JSON
    (record: any) => record.body?.stringValue === `e2e raw ${serviceName}`,
  )
  expect(warn, 'raw OTEL log should reach the collector').toBeDefined()

  // Level gating: the debug line is below the configured level and must
  // never have left the process.
  expect(bodies).not.toContain(`e2e debug ${serviceName}`)
}

describe.skipIf(!outputFile)('OTLP collector end-to-end', () => {
  it('delivers traces, metrics and logs over OTLP/HTTP', async () => {
    const serviceName = `e2e-http-${Date.now()}`
    await emit(serviceName, HTTP_ENDPOINT)
    assertScenario(serviceName, await waitForTelemetry(serviceName))
  }, 90_000)

  it('delivers traces, metrics and logs over OTLP/gRPC', async () => {
    const serviceName = `e2e-grpc-${Date.now()}`
    await emit(serviceName, GRPC_ENDPOINT)
    assertScenario(serviceName, await waitForTelemetry(serviceName))
  }, 90_000)
})

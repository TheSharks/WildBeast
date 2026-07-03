// Boots the real telemetry pipeline (from dist), emits one of each signal,
// flushes and exits. Spawned as a child process by the e2e test so every
// scenario gets a fresh set of global providers.
import { LogLevel } from '@sapphire/framework'
import {
  AnalyticsLogger,
  DURATION_SECONDS_BOUNDARIES,
  initOpenTelemetry,
  logs,
  metrics,
  trace,
} from '../../dist/index.js'

const serviceName = process.env.E2E_SERVICE_NAME
if (!serviceName) {
  console.error('E2E_SERVICE_NAME is required')
  process.exit(2)
}

const telemetry = initOpenTelemetry({
  serviceName,
  namespace: 'e2e',
  shardId: '7',
  environment: 'e2e-test',
  resourceAttributes: { 'cluster.id': 'e2e-cluster' },
})

// Trace: one span with an attribute and an event.
const tracer = trace.getTracer('e2e')
await tracer.startActiveSpan(
  'e2e.operation',
  { attributes: { 'e2e.marker': serviceName } },
  async (span) => {
    span.addEvent('e2e.event')
    span.end()
  },
)

// Metrics: a counter and a histogram carrying the bucket advice.
const meter = metrics.getMeter('e2e')
meter.createCounter('e2e_operations_total').add(3, { scenario: serviceName })
meter
  .createHistogram('e2e_duration_seconds', {
    unit: 's',
    advice: { explicitBucketBoundaries: DURATION_SECONDS_BOUNDARIES },
  })
  .record(0.3, { scenario: serviceName })

// Logs: through the Sapphire bridge, so severity mapping and level gating
// are exercised too. The debug line must NOT reach the collector.
const logger = new AnalyticsLogger({ level: LogLevel.Info })
logger.info(`e2e info ${serviceName}`)
logger.debug(`e2e debug ${serviceName}`)

// Raw OTEL logs API as well.
logs.getLogger('e2e').emit({
  body: `e2e raw ${serviceName}`,
  severityNumber: 13, // WARN
  severityText: 'WARN',
})

await telemetry.shutdown()
process.exit(0)

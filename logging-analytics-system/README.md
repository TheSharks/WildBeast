# Logging Analytics System

A lightweight, self-hosted logging and analytics system that provides the flexibility of the LGTM stack without the enterprise overhead. Features deep Sentry integration, powerful analytics with ClickHouse, and efficient log collection with Vector.

## Features

- **Lightweight Alternative to LGTM Stack**: Get the power without the complexity
- **Deep Sentry Integration**: Bidirectional sync with Sentry for error tracking
- **High-Performance Storage**: ClickHouse for fast log queries and analytics
- **Flexible Log Collection**: Vector.dev for efficient log routing and transformation
- **Prometheus-Compatible Metrics**: Export metrics to any Prometheus-compatible system
- **Real-Time Log Streaming**: SSE-based log tailing
- **Powerful Analytics API**: Aggregate and analyze logs with SQL-like queries
- **Grafana Integration**: Pre-built dashboards for visualization
- **Distributed Tracing**: Optional Jaeger integration for trace analysis

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Application │────▶│   Vector    │────▶│ ClickHouse  │
│    Logs     │     │ (Collector) │     │  (Storage)  │
└─────────────┘     └─────────────┘     └─────────────┘
                            │                    │
                            ▼                    ▼
                    ┌─────────────┐     ┌─────────────┐
                    │   API       │◀────│  Grafana    │
                    │  Server     │     │(Dashboards) │
                    └─────────────┘     └─────────────┘
                            │
                            ▼
                    ┌─────────────┐
                    │   Sentry    │
                    │(Integration)│
                    └─────────────┘
```

## Quick Start

### Using Docker Compose (Recommended)

1. Clone the repository:
```bash
git clone https://github.com/youruser/logging-analytics-system.git
cd logging-analytics-system
```

2. Copy environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start the stack:
```bash
docker-compose up -d
```

4. Access the services:
- API: http://localhost:3000
- Grafana: http://localhost:3001 (admin/admin)
- ClickHouse: http://localhost:8123
- Vector API: http://localhost:8686
- Jaeger UI: http://localhost:16686

### Manual Installation

1. Install dependencies:
```bash
npm install
```

2. Set up ClickHouse:
```bash
docker run -d \
  --name clickhouse \
  -p 8123:8123 \
  -p 9000:9000 \
  clickhouse/clickhouse-server
```

3. Set up Vector:
```bash
# Install Vector
curl --proto '=https' --tlsv1.2 -sSf https://sh.vector.dev | bash

# Copy configuration
cp config/vector.toml /etc/vector/vector.toml

# Start Vector
vector --config /etc/vector/vector.toml
```

4. Start the API server:
```bash
npm run build
npm start
```

## Usage

### Using the Logger Library

Install the logger in your application:

```typescript
import { createLogger } from 'logging-analytics-system';

const logger = createLogger({
  service: 'my-app',
  environment: 'production',
  apiEndpoint: 'http://localhost:3000',
  apiToken: 'your-api-token',
  sentryDsn: 'https://your-sentry-dsn@sentry.io/project',
});

// Basic logging
logger.info('Application started');
logger.warn('Low memory', { memory: process.memoryUsage() });
logger.error('Failed to connect', new Error('Connection timeout'));

// Set context for all logs
logger.setContext({
  userId: 'user123',
  requestId: 'req-456',
});

// HTTP request logging
app.use(logger.expressMiddleware());

// Performance tracking
const timer = logger.startTimer('database-query');
// ... perform operation
timer(); // Logs duration automatically

// Async operation wrapper
const result = await logger.wrapAsync('fetch-user', async () => {
  return await fetchUser(userId);
});
```

### Sending Logs via Vector

Configure your application to send logs to Vector:

```yaml
# For Docker containers
logging:
  driver: "syslog"
  options:
    syslog-address: "udp://localhost:514"
    tag: "{{.Name}}"
```

Or send logs via HTTP:

```bash
curl -X POST http://localhost:8080 \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2024-01-01T12:00:00Z",
    "level": "info",
    "message": "User logged in",
    "service": "auth-service",
    "user_id": "user123"
  }'
```

### Querying Logs

Query logs via the API:

```bash
# Search logs
curl -X POST http://localhost:3000/api/logs/query \
  -H "Content-Type: application/json" \
  -d '{
    "startTime": "2024-01-01T00:00:00Z",
    "endTime": "2024-01-01T23:59:59Z",
    "service": "auth-service",
    "level": "error",
    "searchText": "timeout"
  }'

# Stream logs in real-time
curl -N http://localhost:3000/api/logs/stream?service=api&level=error

# Get aggregated metrics
curl -X POST http://localhost:3000/api/analytics/aggregate \
  -H "Content-Type: application/json" \
  -d '{
    "groupBy": ["service", "level"],
    "aggregation": {
      "function": "count",
      "field": "*"
    },
    "timeRange": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-01-01T23:59:59Z"
    }
  }'
```

### Sentry Integration

1. Configure Sentry webhook in your Sentry project:
   - URL: `http://your-api-host:3000/api/sentry/webhook`
   - Events: All events

2. Set environment variables:
```bash
SENTRY_DSN=https://your-key@sentry.io/project
SENTRY_WEBHOOK_SECRET=your-webhook-secret
```

3. Logs will automatically correlate with Sentry events using `sentry_event_id`

### Metrics Integration

Access Prometheus metrics:

```bash
# Scrape metrics endpoint
curl http://localhost:3000/metrics

# Or get JSON format
curl http://localhost:3000/api/metrics/json
```

Configure Prometheus to scrape:

```yaml
scrape_configs:
  - job_name: 'logging-analytics'
    static_configs:
      - targets: ['localhost:3000']
```

## API Reference

### Log Ingestion

`POST /api/logs/ingest`

```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "level": "error",
  "message": "Database connection failed",
  "service": "api",
  "environment": "production",
  "trace_id": "abc123",
  "user_id": "user456",
  "metadata": {
    "error_type": "DatabaseError",
    "retry_count": 3
  }
}
```

### Log Query

`POST /api/logs/query`

```json
{
  "startTime": "2024-01-01T00:00:00Z",
  "endTime": "2024-01-01T23:59:59Z",
  "service": "api",
  "level": "error",
  "environment": "production",
  "searchText": "timeout",
  "limit": 100
}
```

### Analytics Aggregation

`POST /api/analytics/aggregate`

```json
{
  "groupBy": ["service", "level"],
  "aggregation": {
    "function": "count",
    "field": "*"
  },
  "filters": {
    "environment": "production"
  },
  "timeRange": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-01T23:59:59Z"
  }
}
```

## Configuration

### Vector Configuration

The Vector configuration (`config/vector.toml`) includes:

- Multiple input sources (files, syslog, HTTP, Docker)
- Log parsing and enrichment
- Routing based on log level
- Multiple sinks (ClickHouse, API, Sentry)
- Sampling and filtering for high-volume scenarios

### ClickHouse Schema

The system automatically creates optimized tables:

- `logs.entries`: Main log storage with TTL
- `logs.metrics_mv`: Materialized view for fast metric queries
- Indexes on trace_id, sentry_event_id, and message fields

### Environment Variables

See `.env.example` for all configuration options:

- `CLICKHOUSE_*`: Database connection settings
- `SENTRY_*`: Sentry integration configuration
- `PROMETHEUS_*`: Metrics export settings
- `VECTOR_*`: Log collection settings

## Performance Tuning

### ClickHouse Optimization

1. Adjust partition strategy based on volume:
```sql
-- For high-volume logs, partition by day
ALTER TABLE logs.entries 
MODIFY PARTITION BY toYYYYMMDD(date);
```

2. Configure memory limits in ClickHouse config

### Vector Optimization

1. Adjust batch sizes in `vector.toml`:
```toml
[sinks.clickhouse_all]
batch.max_bytes = 52428800  # 50MB for high volume
batch.timeout_secs = 30
```

2. Enable sampling for high-volume services

### API Performance

1. Use environment variables to tune:
```bash
NODE_OPTIONS="--max-old-space-size=4096"  # Increase memory
```

2. Enable clustering for multi-core systems

## Monitoring

### Health Checks

- API: `GET /health`
- Vector: `GET http://localhost:8686/health`
- ClickHouse: `GET http://localhost:8123/ping`

### Metrics

Monitor these key metrics:

- `logging_analytics_log_events_total`: Total logs ingested
- `logging_analytics_storage_operation_duration_seconds`: Storage latency
- `logging_analytics_http_request_duration_seconds`: API latency
- `logging_analytics_errors_total`: Error rate

## Troubleshooting

### Common Issues

1. **Logs not appearing**: Check Vector logs at `/var/log/vector/`
2. **High memory usage**: Enable sampling in Vector config
3. **Slow queries**: Check ClickHouse table partitions
4. **Sentry events missing**: Verify webhook configuration

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm start
```

## Development

### Running Tests

```bash
npm test
```

### Building from Source

```bash
npm run build
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- GitHub Issues: [Report bugs or request features]
- Documentation: [Full documentation]
- Community: [Join our Discord]
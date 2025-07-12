# WildBeast Analytics System

A robust, self-hosted logging and analytics system designed for the WildBeast Discord bot. This system provides LGTM-like capabilities (Logs, Grafana, Tempo, Metrics) with a focus on simplicity and powerful insights.

## 🚀 Features

- **Comprehensive Logging**: Enhanced logging with structured data, context, and Sentry integration
- **Real-time Analytics**: ClickHouse for fast, scalable analytics queries
- **Metrics Collection**: Prometheus metrics with automatic instrumentation
- **Event Tracking**: Session management and user behavior analytics
- **Performance Monitoring**: Automatic performance tracking and alerting
- **Visualization**: Grafana dashboards for insights and monitoring
- **Self-hosted**: Complete control over your data with no external dependencies

## 📊 Architecture

```
Discord Bot → Enhanced Logger → Vector → ClickHouse
                               ↓
                        Prometheus ← Grafana
                               ↓
                           Sentry
```

### Components

- **Vector**: Lightweight log router and processor (replaces Loki)
- **ClickHouse**: Fast analytical database for storing logs and events
- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **Redis**: Queue management for async processing
- **Sentry**: Error tracking and monitoring (integrated)

## 🛠️ Setup

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ and pnpm
- Redis instance
- ClickHouse instance

### Installation

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Build the analytics package**:
   ```bash
   pnpm build
   ```

3. **Start the analytics stack**:
   ```bash
   docker-compose -f docker-compose.analytics.yml up -d
   ```

4. **Environment variables**:
   ```env
   # ClickHouse
   CLICKHOUSE_HOST=localhost
   CLICKHOUSE_PORT=8123
   CLICKHOUSE_USERNAME=wildbeast
   CLICKHOUSE_PASSWORD=wildbeast_password
   CLICKHOUSE_DATABASE=wildbeast
   
   # Redis
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=redis_password
   
   # Sentry
   SENTRY_DSN=your_sentry_dsn
   ENVIRONMENT=production
   
   # Prometheus
   PROMETHEUS_PORT=9090
   PROMETHEUS_PATH=/metrics
   ```

## 💻 Usage

### Basic Setup

```typescript
import { initializeAnalytics, getAnalytics } from '@thesharks/analytics';
import { EnhancedLogger } from '@thesharks/logger';

// Initialize analytics
const analytics = await initializeAnalytics({
  clickhouse: {
    host: 'localhost',
    port: 8123,
    username: 'wildbeast',
    password: 'wildbeast_password',
    database: 'wildbeast',
  },
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'redis_password',
  },
  sentry: {
    dsn: 'your_sentry_dsn',
    environment: 'production',
  },
  prometheus: {
    port: 9090,
    path: '/metrics',
  },
});

// Enhanced logging
const logger = new EnhancedLogger({ level: 'info' });
```

### Discord Bot Integration

```typescript
// Track commands
logger.logCommandStart('ping', userId, guildId, channelId);
logger.logCommandSuccess('ping', userId, guildId, channelId, duration);

// Track events
analytics.track({
  event_type: 'command_executed',
  user_id: userId,
  guild_id: guildId,
  properties: { command: 'ping', duration, success: true },
  timestamp: new Date(),
});

// Track errors
logger.logCommandError('ping', userId, error, guildId, channelId, duration);
```

### Analytics Queries

```typescript
// User activity analysis
const userActivity = await analytics.getUserActivity(userId, 30);

// Guild statistics
const guildStats = await analytics.getGuildStats(guildId, 30);

// Error rate monitoring
const errorRate = await analytics.getErrorRate(24);

// Performance metrics
const performance = await analytics.getPerformanceMetrics('command_execution', 24);
```

## 📈 Metrics

The system automatically tracks:

- **Discord Metrics**: Commands, messages, guild events, member activity
- **Performance Metrics**: Command duration, API response times, database queries
- **Error Metrics**: Error rates, types, and frequencies
- **System Metrics**: Memory, CPU, queue sizes, processing times

### Available Metrics

- `discord_commands_total`: Total commands executed
- `discord_messages_total`: Total messages processed
- `discord_command_duration_seconds`: Command execution time
- `errors_total`: Total errors by type and source
- `analytics_events_processed_total`: Events processed
- `database_query_duration_seconds`: Database query performance

## 🔍 Logging

### Log Levels

- `trace`: Detailed debugging information
- `debug`: Debug information (filtered in production)
- `info`: General information
- `warn`: Warning conditions
- `error`: Error conditions
- `fatal`: Critical errors

### Structured Logging

```typescript
logger.logWithContext('info', 'User action', {
  user_id: '123456',
  guild_id: '789012',
  command: 'ping',
  metadata: { extra_data: 'value' },
});
```

## 🎯 Analytics Events

Track user behavior and system events:

```typescript
// Command execution
analytics.track({
  event_type: 'command_executed',
  user_id: '123456',
  guild_id: '789012',
  properties: { command: 'ping', duration: 150 },
  timestamp: new Date(),
});

// Feature usage
analytics.track({
  event_type: 'feature_used',
  user_id: '123456',
  properties: { feature: 'music_player', action: 'play' },
  timestamp: new Date(),
});
```

## 📊 Dashboards

### Grafana Dashboards

Access Grafana at `http://localhost:3000` (admin/admin)

Available dashboards:
- **Discord Bot Overview**: General bot statistics and health
- **Command Analytics**: Command usage and performance
- **Error Monitoring**: Error rates and troubleshooting
- **User Activity**: User behavior and engagement
- **System Performance**: Resource usage and bottlenecks

### ClickHouse Queries

Common analytics queries:

```sql
-- Top commands by usage
SELECT command, count() as executions
FROM events
WHERE event_type = 'command_executed'
  AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY command
ORDER BY executions DESC
LIMIT 10;

-- Guild activity over time
SELECT 
  toStartOfHour(timestamp) as hour,
  guild_id,
  count() as events
FROM events
WHERE timestamp >= now() - INTERVAL 24 HOUR
GROUP BY hour, guild_id
ORDER BY hour DESC;

-- Error rates by hour
SELECT 
  toStartOfHour(timestamp) as hour,
  level,
  count() as errors
FROM logs
WHERE level IN ('error', 'fatal')
  AND timestamp >= now() - INTERVAL 24 HOUR
GROUP BY hour, level
ORDER BY hour DESC;
```

## 🔧 Configuration

### Vector Configuration

Located at `config/vector.toml`, handles:
- Log collection from multiple sources
- Data transformation and enrichment
- Routing to different destinations
- Metrics extraction from logs

### Prometheus Configuration

Located at `config/prometheus.yml`, scrapes:
- Application metrics
- Vector metrics
- System metrics
- Custom metrics

## 🚨 Monitoring & Alerting

### Health Checks

The system includes health checks for:
- ClickHouse connectivity
- Redis connectivity
- Vector processing
- Prometheus scraping

### Alerting Rules

Set up alerts for:
- High error rates
- Slow command execution
- System resource exhaustion
- Database connection issues

## 🔒 Security

- **Authentication**: Secure ClickHouse and Redis with passwords
- **Network**: Use Docker networks for service isolation
- **Data**: Encrypt sensitive data in logs
- **Access**: Restrict Grafana access with authentication

## 📝 Best Practices

1. **Sampling**: Use sampling for high-volume events to reduce storage
2. **Retention**: Configure appropriate data retention policies
3. **Indexing**: Index commonly queried fields in ClickHouse
4. **Monitoring**: Monitor the monitoring system itself
5. **Backup**: Regular backups of ClickHouse and Grafana data

## 🐛 Troubleshooting

### Common Issues

1. **ClickHouse Connection Issues**:
   - Check network connectivity
   - Verify credentials
   - Check ClickHouse logs

2. **High Memory Usage**:
   - Adjust Vector batch sizes
   - Implement log sampling
   - Review retention policies

3. **Slow Queries**:
   - Add appropriate indexes
   - Optimize query patterns
   - Consider data partitioning

### Debugging

```typescript
// Enable debug logging
const logger = new EnhancedLogger({ level: 'debug' });

// Check analytics status
console.log('Analytics initialized:', isAnalyticsInitialized());

// Monitor queue sizes
const stats = eventTracker.getSessionStats();
console.log('Session stats:', stats);
```

## 📚 API Reference

### AnalyticsService

- `log(event: LogEvent)`: Log structured events
- `metric(event: MetricEvent)`: Record metrics
- `track(event: AnalyticsEvent)`: Track user events
- `getUserActivity(userId, days)`: Get user activity
- `getGuildStats(guildId, days)`: Get guild statistics
- `getErrorRate(hours)`: Get error rates

### EnhancedLogger

- `logWithContext(level, message, context, error?)`: Context-aware logging
- `logCommandStart/Success/Error()`: Command-specific logging
- `logPerformance()`: Performance logging
- `logDatabaseQuery()`: Database query logging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MPL-2.0 License.
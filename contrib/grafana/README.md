# Grafana dashboards

Premade dashboards for WildBeast's OpenTelemetry metrics, plus a ready-to-run
local stack (collector, Prometheus, Grafana).

## Quick start

```bash
cd contrib/grafana
docker compose up -d
```

Point the bot at the collector and start it:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 pnpm start
```

Grafana runs at http://localhost:3000 (anonymous admin, no login) with the
dashboards provisioned into the WildBeast folder.

## Dashboards

| Dashboard | Answers |
| --- | --- |
| Fleet & clustering | Are all shards owned and connected? Are handoffs graceful (resumed) or crashes (lost leases)? Is identify pacing healthy? |
| Commands & interactions | Command throughput, latency percentiles, error and denial rates, component and autocomplete health, gateway and REST pressure. |
| Runtime health | Event loop, heap against the V8 limit, GC pauses, CPU, websocket latency, BullMQ queue depth. |

## Using an existing Grafana

Import the JSON files from `dashboards/` (Dashboards → New → Import) and pick
your Prometheus data source in the `datasource` variable; nothing is
hardcoded to the bundled stack.

The queries expect OTel resource attributes as metric labels (`cluster_id`,
`service_instance_id`, ...). If you run your own collector, enable the
conversion on the Prometheus exporter:

```yaml
exporters:
  prometheus:
    resource_to_telemetry_conversion:
      enabled: true
```

The same option exists on `prometheusremotewrite` if you push to Mimir,
Thanos or Grafana Cloud instead of scraping.

## Regenerating

The JSON is generated, not hand-edited; series names and labels were
verified against a live collector. Tweak panels in the Grafana UI and export,
or edit the JSON directly. Keep the `datasource` template variable if you
change queries, so the dashboards stay portable.

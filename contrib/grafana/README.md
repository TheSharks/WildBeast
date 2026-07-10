# Grafana dashboards

Premade dashboards and alert rules for WildBeast's OpenTelemetry output,
plus a ready-to-run local stack: collector, Prometheus (metrics and
alerting), Tempo (traces), Loki (logs) and a provisioned Grafana. The
[dashboards page](https://wildbeast.guide/self-hosting/dashboards/)
describes what each dashboard shows and how the alert rules map to
failure modes.

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
dashboards provisioned into the WildBeast folder. All three signals flow:
metrics into the dashboards, traces into Tempo and logs into Loki (Explore).
Traces link to their logs and logs back to their trace via the provisioned
datasource correlation.

## Alert rules

The bundled Prometheus loads `alerts.yaml` automatically; for your own
setup, add the file to `rule_files` and point Prometheus at your
Alertmanager for routing. Validate changes with:

```bash
docker run --rm --entrypoint promtool \
  -v "$PWD/alerts.yaml:/alerts.yaml:ro" prom/prometheus check rules /alerts.yaml
```

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

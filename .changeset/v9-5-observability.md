---
'@thesharks/discord': minor
---

Added [OpenTelemetry](https://wildbeast.guide/self-hosting/telemetry/) traces, metrics, and logs, exported over OTLP (HTTP or gRPC) when `OTEL_EXPORTER_OTLP_ENDPOINT` is set.

- Commands, scheduled tasks, and the cluster manager are traced, with metrics for shard lifecycle, guild churn, and rate limits.
- Ships premade Grafana dashboards and alert rules, plus a runnable local stack with Tempo and Loki.
- Deeper Sentry integration: profiling, cron monitoring, and event-loop block detection, with the release baked into Docker images.
- Added a terminal dashboard with live metrics and logs, shown when the cluster manager runs in an interactive terminal. Control it with `WILDBEAST_TUI`.

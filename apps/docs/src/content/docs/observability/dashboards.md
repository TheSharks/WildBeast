---
title: Grafana dashboards
description: Premade dashboards for WildBeast's metrics, with a local stack to run them.
sidebar:
  order: 3
---

WildBeast ships three premade Grafana dashboards and 14 Prometheus alert
rules in
[`contrib/grafana`](https://github.com/TheSharks/WildBeast/tree/master/contrib/grafana),
covering the fleet, the commands and the runtime. Every query was validated
against a live collector, so the panels light up as soon as metrics flow.

## Try them locally

The directory doubles as a runnable observability stack: an OpenTelemetry
collector, Prometheus with the alert rules loaded, Tempo for traces, Loki
for logs and a provisioned Grafana. Traces and logs are cross-linked, so a
slow span jumps to its log lines and a log line jumps to its trace.

```bash
cd contrib/grafana
docker compose up -d
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 pnpm start
```

Open http://localhost:3000 and the WildBeast folder holds all three
dashboards, no login needed.

## What each dashboard shows

**Fleet & clustering** is the operator's view of
[autonomous sharding](/scaling/clustering/): shards up against desired,
handoffs split by graceful releases versus lost leases, identify pacing
against Discord's rate limit, and how often shards resume sessions instead
of paying for a fresh identify.

**Commands & interactions** tracks throughput, latency percentiles, error
and denial rates for application commands, plus component interactions,
gateway event pressure and REST rate limits.

**Runtime health** watches each worker's Node.js runtime: event loop delay
and utilization, heap growth against the V8 limit, GC pauses, CPU,
websocket latency and the BullMQ task queue.

## Alerting

The alert rules encode the failure semantics of
[autonomous sharding](/scaling/clustering/) and the runtime: a fenced
cluster, shards assigned but not connected, leases lost without a graceful
release, crash-looping workers, command error rates above 5%, event loops
blocked long enough to threaten heartbeats, and heap growth approaching the
V8 limit. The bundled Prometheus evaluates them out of the box; notification
routing needs an Alertmanager, which stays environment-specific on purpose.

## Using your own Grafana

Import the JSON files from `contrib/grafana/dashboards/` and select your
Prometheus data source; the dashboards bind to a `datasource` variable
rather than a fixed backend. One collector setting is required: the
dashboards expect resource attributes (`cluster_id`, `service_instance_id`)
as metric labels, which the Prometheus exporters emit with
`resource_to_telemetry_conversion: enabled: true`. The
[contrib README](https://github.com/TheSharks/WildBeast/tree/master/contrib/grafana)
has the exact snippet.

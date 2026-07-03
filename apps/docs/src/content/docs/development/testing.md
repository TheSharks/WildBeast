---
title: Testing
description: Running and writing tests for the WildBeast framework.
sidebar:
  order: 1
---

WildBeast's suite tests the framework's own infrastructure (piece loading,
sharding coordination, telemetry plumbing) against minimal fakes or real
backing services, and leaves library behavior to the libraries. Actual
Discord command behavior is out of scope: it isn't feasible to test without
a live bot, and Sapphire already covers the dispatch machinery.

## Running tests

There are two entry points, depending on whether you have docker available:

```bash
# Unit tests only — no external services needed
pnpm test

# Everything, including the Redis and OpenTelemetry integration suites.
# Provisions disposable docker containers and tears them down afterwards.
pnpm test:integration
```

Integration suites are gated on environment variables (`REDIS_URL`,
`OTEL_E2E_OUTPUT`) and skip cleanly when the services aren't available, so
a plain `pnpm test` always works. CI runs the full integration suite.

## What's covered

The suite concentrates on the places where a silent failure would be
expensive:

- Piece loading: the compiled listeners, commands and scheduled tasks are
  loaded through real Sapphire stores against a stubbed container. The
  tests assert that every exported piece registers exactly once (Sapphire
  silently unloads name collisions), resolves its emitter, and carries its
  tracing wrapper.
- Sharding coordination: the identify throttler, rendezvous assignment,
  shard leases, the reconciler lifecycle (join, graceful leave, crash
  recovery) and epoch migrations all run against a real Redis.
- Telemetry: the analytics pipeline is verified end to end against a real
  OpenTelemetry collector over both OTLP/HTTP and OTLP/gRPC. Unit tests
  cover the logger bridge and metric helpers with in-memory exporters.
- Environment validation: the zod schema, including the legacy `BOT_TOKEN`
  alias and coercion rules.

## Writing tests

The `@thesharks/test-utils` workspace package provides the shared toolkit:

- `captureSpans()`, `captureLogRecords()` and `captureMetrics()` install
  in-memory OpenTelemetry providers and return what the code under test
  emitted. Create captures *before* the code under test acquires its
  tracers or meters.
- `silentLogger` is an `ILogger` stub for constructing pieces.
- `waitUntil(condition)` polls with a timeout, for integration tests.
- `snapshotEnv(prefixes)` removes and later restores environment variables.
- `connectionPool(factory)` tracks connections for one-call teardown.

Integration test files share one Redis and flush it between tests, so
vitest is configured to run test files serially — don't move suites to
parallel execution without also isolating their state.

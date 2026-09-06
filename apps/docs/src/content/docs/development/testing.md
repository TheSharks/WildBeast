---
title: Testing
description: Running and writing tests for the WildBeast framework.
sidebar:
  order: 7
---

WildBeast's suite tests the bot's own logic against fakes or real backing
services, and leaves library behavior to the libraries. Services take their
collaborators as constructor arguments, so a service test needs no Discord,
no framework, and no environment; a command test needs a fake `container.app`
and a fake interaction.

## Running tests

There are two entry points, depending on whether you have Docker available:

```bash
# Unit tests only, no external services needed
pnpm test

# Everything, including the PostgreSQL, Redis, and OpenTelemetry suites.
# Provisions disposable Docker containers and tears them down afterwards.
pnpm test:integration
```

Integration suites are gated on environment variables (`DATABASE_URL`,
`REDIS_URL`, `OTEL_E2E_OUTPUT`) and skip cleanly when the services aren't
available, so a plain `pnpm test` always works. The PostgreSQL suites
replace whole tables, so `DATABASE_URL` must point at a disposable database
with every migration applied. CI runs the full integration suite.

## What's covered

The suite concentrates on the guarantees a silent failure would break:

- Runtime lifecycle: startup order, unwinding after a failed resource,
  draining before teardown, joined stop requests, drain deadlines, and the
  difference between a shutdown and a handoff close, all against fake
  resources (`runtime.test.ts`, `composition.test.ts`).
- Fleet management: static spawning, parked clusters, resumable handoff
  stops, stale-epoch detection, and grace-period termination
  (`fleet.test.ts`), plus the identify throttler, rendezvous assignment,
  leases, the reconciler, and epoch migrations against a real Redis.
- Tags and premium: concurrent caps, authorization, guild isolation, durable
  promotion intents across lost REST responses and failed commits, deferred
  revocation, snapshot races, and freshness rules, against a real PostgreSQL
  (`tags.integration.test.ts`, `premium.integration.test.ts`).
- Commands and gates: the tag command's replies and upsells, autocomplete
  gating, draining behavior, the shared gate evaluation, and the
  preconditions, against fake services (`tagCommand.test.ts`,
  `gates.test.ts`).
- Scheduled tasks and operator commands: admission, gating, shard ownership
  deferral, and per-guild placement (`tasks.test.ts`,
  `operatorCommands.test.ts`).
- Piece loading: the compiled pieces are loaded through real Sapphire stores
  against a stubbed container. The test asserts that every exported piece
  registers exactly once, resolves its emitter, has its gate, and carries
  its base-class wrapper (`structure.test.ts`).
- Telemetry: the analytics pipeline is verified end to end against a real
  OpenTelemetry collector over both OTLP/HTTP and OTLP/gRPC. Unit tests
  cover the logger bridge, the metrics listeners, and the metric helpers
  with in-memory exporters. `scripts/check-metrics.mjs` keeps the emitted
  metrics, the contract, the dashboards, and the docs in agreement.
- Environment validation: the zod schema, including the legacy `BOT_TOKEN`
  alias and coercion rules, and the locale files against every key the
  source resolves.

## Writing tests

The `@thesharks/test-utils` workspace package provides the shared toolkit:

- `captureSpans()`, `captureLogRecords()`, and `captureMetrics()` install
  in-memory OpenTelemetry providers and return what the code under test
  emitted. Create captures *before* the code under test acquires its
  tracers or meters.
- `silentLogger` is an `ILogger` stub for constructing pieces.
- `waitUntil(condition)` polls with a timeout, for integration tests.
- `snapshotEnv(prefixes)` removes and later restores environment variables.
- `connectionPool(factory)` tracks connections for one-call teardown.

To test a command, construct the piece with a minimal loader context, set
`container.app` to fake services, and call its handler with a fake
interaction whose `reply` is a spy. To test a service, pass fake
repositories and gateways; the tag integration suite shows how to combine
a real repository with a fake Discord gateway.

Integration test files share one Redis and flush it between tests, so
vitest runs test files serially. Don't move suites to parallel execution
without also isolating their state.

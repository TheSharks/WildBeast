---
title: Sentry
description: How the package sets up Sentry, what it scrubs from events, and the options you can change.
sidebar:
  order: 5
---

`initOpenTelemetry` also initializes Sentry, and connects it to the same
tracer so errors link to the trace they happened in. You don't call
`Sentry.init` yourself. Set `SENTRY_DSN`, or pass `sentry.dsn`, and
`hello-bot` starts reporting. Without a DSN, Sentry sends nothing.

```ts title="src/main.ts"
const telemetry = initOpenTelemetry({
  serviceName: 'hello-bot',
  namespace: 'hello',
  sentry: {
    dsn: 'https://key@o0.ingest.sentry.io/0',
    tags: { region: 'eu' },
  },
})
```

Sentry doesn't depend on OTLP export. It reports with or without a
collector endpoint.

## Use the same Sentry instance

To call Sentry yourself, import it from this package instead of installing
`@sentry/node`:

```ts title="src/greet.ts"
import { Sentry } from '@thesharks/analytics'

Sentry.captureException(new Error('Greeting failed'))
```

Sentry keeps its state per installed copy, and all `@sentry/*` packages must
be the same version. A second `@sentry/node` in your own dependencies can
resolve to a different version, and calls made through it never reach the
client that `initOpenTelemetry` set up. The re-export is always the right
one.

## Defaults worth knowing

- **Sampling**: 20% of traces when the environment is `production`, and all
  of them otherwise. Set `tracesSampleRate`, or pass a `tracesSampler`
  function, which takes precedence.
- **Environment**: `sentry.environment`, then the top-level `environment`
  option, then `NODE_ENV`, then `development`.
- **Release**: `sentry.release`, then `SENTRY_RELEASE`, then the
  `package.json` version when started through a package manager, then
  `GIT_COMMIT`, then `dev`.
- **Logs and metrics**: both on. Keep Sentry metrics for low-volume signals;
  don't mirror busy OpenTelemetry counters into them.
- **Local variables** in stack frames: on.
- **Event loop blocks** longer than 1,000 ms are reported. Change the
  threshold with `eventLoopBlockThreshold`, or set it to `false`.
- **Profiling**: off. Set `profileSessionSampleRate` above `0` to profile
  while a sampled trace is active.
- **Trace propagation**: `tracePropagationTargets` is empty, so Sentry adds
  its trace headers to no outbound requests.

Set `SENTRY_SPOTLIGHT=true`, or `sentry.spotlight`, to forward events to a
local [Spotlight](https://spotlightjs.com/) sidecar during development.

## What gets scrubbed

Every event passes through a scrubber before it's sent, so reports identify
users and servers by ID only:

- The `user` object is reduced to its `id`.
- In contexts, extra data, and breadcrumb data, values under the keys
  `username`, `tag`, `globalName`, `displayName`, `email`, `token`,
  `authorization`, `password`, `secret`, `guild_name`, and `channel_name`
  become `[Redacted]`. Keys ending in `_` and one of those names match too.
- The `guild` and `channel` contexts lose their `name`.
- Strings shaped like a Discord bot token, and credentials after `Bearer`,
  are replaced wherever they appear.

Your own `sentry.beforeSend` runs after the scrubber and receives the
scrubbed event. Return `null` from it to drop an event.

:::caution[Scrubbing is best effort]
The scrubber matches key names and token shapes. It can't find personal
data in free text, such as an error message that quotes a username. Keep
names out of error messages and attach IDs instead.
:::

The scrubber and its key list are exported as `scrubSentryEvent` and
`SENTRY_PII_DENYLIST`, which is useful for testing your own `beforeSend`.

## Check the wiring

Set `SENTRY_VALIDATE_OTEL_SETUP=true` to have Sentry verify at boot that
its OpenTelemetry integration is complete. It's meant for development and
CI, not production.

The [configuration reference](/analytics/reference/#sentry-options) lists
every Sentry option.

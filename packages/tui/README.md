# WildBeast terminal dashboard

`@thesharks/tui` owns terminal rendering, keyboard interaction, bounded metric
history, and log capture. The Discord app owns fleet status and worker transport;
`@thesharks/analytics` owns the OpenTelemetry reader. The UI uses Node's readline
and terminal APIs, with `string-width` for Unicode column measurement.

## Try it without a bot

From the repository root:

```sh
pnpm exec turbo run build --filter=@thesharks/tui
pnpm --filter @thesharks/tui demo
```

The demo uses clearly marked simulated data. It needs no Discord token,
Redis, database, or telemetry collector.

## Run with WildBeast

Build the Discord app, then run `pnpm --filter @thesharks/discord start` in an
interactive terminal. `WILDBEAST_TUI=auto` is the default. Use `off` for ordinary
logs or `on` to opt in even when `CI` is set. Piped output, non-TTY stdin, and
`TERM=dumb` always use ordinary logs. The cluster manager owns the dashboard;
`start:worker` remains a plain worker console.

| Key | Action |
| --- | --- |
| `1`, `2`, `3` / `Tab` | Overview, metrics, logs |
| Arrows / `j`, `k` | Select a metric or scroll logs |
| `PageUp`, `PageDown` | Move ten rows |
| `Home`, `End` | First/last metric; oldest/live logs |
| `/` | Search metric names, meters, labels, or log text |
| `Enter`, `Esc` | Finish search, clear filter |
| `s` | Cycle metric source (manager or local shard) |
| `e` | Show only warnings/errors in the log view |
| `Space` | Pause/resume incoming display data |
| `?` | Help |
| `q` | Detach the dashboard; bot continues with plain logs |
| `Ctrl+C` | Graceful bot shutdown |

## What the numbers mean

The local cumulative OpenTelemetry reader collects every two seconds, independently
of OTLP export. A collector is not required. It includes registered instruments
once they have emitted data, including runtime and queue metrics. Collection does
not change how often the underlying bot updates a gauge (some run every minute).
Only this manager and its shard workers are shown, not remote fleet members.

Counters show cumulative totals and per-second changes between samples, with
restart detection. Histograms show cumulative count, mean, minimum, and maximum.
Their trend follows the mean; counter trends follow the rate. Trends auto-scale
and retain 60 samples. There are no invented percentile estimates. Missing values
show `--`; samples older than ten seconds are marked stale and excluded from the
overview totals. Departed workers are removed. Shared queue gauges use the latest
collected observation per queue name in the overview, avoiding duplicate counts
from shard workers.

Each reader limits cardinality to 200 label sets per instrument and sends at most
2,000 series per snapshot. OpenTelemetry may emit an overflow series at its limit.
Partial collections and snapshot truncation are indicated in the footer. Logs
retain the last 1,000 lines, capped at 4,096 characters per line. Pause discards
incoming display samples and logs; it does not pause the bot or OTLP exporters.
Logs are filtered by text severity, with stderr treated as at least a warning.
Terminal control sequences are stripped; Unicode text is clipped by display width.

`q`, shutdown, and uncaught exceptions restore the cursor, terminal buffer, input
mode, and original output streams. The last 20 captured log lines are replayed on
detach. No dashboard key restarts shards or mutates bot configuration.

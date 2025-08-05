import * as Sentry from "@sentry/node";
import { ShardingManager } from "discord.js";
import dotEnvExtended from "dotenv-extended";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  environment: process.env.NODE_ENV || "development",
  release: process.env.npm_package_version || "dev",
  integrations: [
    Sentry.rewriteFramesIntegration({
      root: process.cwd(),
      iteratee: (frame) => {
        frame.filename = frame.filename?.replace(/^.*?\/dist\//, "app:///");
        return frame;
      },
    }),
    Sentry.prismaIntegration(),
    Sentry.httpIntegration(),
  ],
  skipOpenTelemetrySetup: false,
});

const __dirname = dirname(fileURLToPath(import.meta.url));
dotEnvExtended.load({
  errorOnMissing: true,
  path: resolve(__dirname, "../.env"),
  schema: resolve(__dirname, "../.env.schema"),
  defaults: resolve(__dirname, "../.env.defaults"),
});

const manager = new ShardingManager(
  join(dirname(fileURLToPath(import.meta.url)), "./index.mjs"),
  {
    token: process.env.DISCORD_TOKEN,
    totalShards: 2,
    mode: "worker",
  },
);

manager.on("shardCreate", (shard) => console.log(`Launched shard ${shard.id}`));

manager.spawn();

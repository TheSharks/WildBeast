import client from "@prisma/client";
import { RewriteFrames } from "@sentry/integrations";
import * as Sentry from "@sentry/node";
import { ShardingManager } from "discord.js";
import dotEnvExtended from "dotenv-extended";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  release: "dev",
  integrations: (integrations) => {
    return integrations
      .concat(
        new RewriteFrames({
          root: process.cwd(),
          iteratee: (frame) => {
            frame.filename = frame.filename?.replace(/^.*?\/dist\//, "app:///");
            return frame;
          },
        }),
      )
      .concat(new Sentry.Integrations.Prisma({ client }))
      .concat(new Sentry.Integrations.Http({ tracing: true }))
      .filter(function (integration) {
        return integration.name !== "Console";
      });
  },
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

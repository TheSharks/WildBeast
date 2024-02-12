import "@sapphire/plugin-hmr/register";
import "@sapphire/plugin-i18next/register";
import "@sapphire/plugin-scheduled-tasks/register";
import "@thesharks/logger/register";
import { GatewayIntentBits } from "discord.js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { LogLevel, SapphireClient } from "@sapphire/framework";

const loglev = process.env.TRACE
  ? LogLevel.Trace
  : process.env.NODE_ENV === "development"
    ? LogLevel.Debug
    : LogLevel.Info;

const hmr = {
  enabled: process.env.NODE_ENV === "development",
};

const client = new SapphireClient({
  intents: [GatewayIntentBits.Guilds],
  baseUserDirectory: join(dirname(fileURLToPath(import.meta.url)), ".."),
  logger: {
    level: loglev,
  },
  tasks: {
    bull: {
      connection: {
        host: process.env.REDIS_HOST ?? "localhost",
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB) : undefined,
      },
    },
  },
  hmr,
  i18n: {
    defaultLanguageDirectory: fileURLToPath(
      (await import.meta.resolve("@thesharks/i18n/discord", import.meta.url)) ??
        "",
    ),
    hmr,
  },
});

export { client };

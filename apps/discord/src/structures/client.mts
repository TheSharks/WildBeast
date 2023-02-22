import "@sapphire/plugin-hmr/register";
import "@sapphire/plugin-i18next/register";
import "@wildbeast/logger/register";
import { GatewayIntentBits } from "discord.js";
import { resolve } from "import-meta-resolve";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { LogLevel, SapphireClient } from "@sapphire/framework";

const loglev = process.env.TRACE
  ? LogLevel.Trace
  : process.env.NODE_ENV === "development"
  ? LogLevel.Debug
  : LogLevel.Info;

const baseUserDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const defaultLanguageDirectory = fileURLToPath(
  // import.meta.resolve is still experimental, we use a polyfil so our workers can use it
  // when node supports it without a flag, we can remove the polyfil
  (await resolve("@wildbeast/i18n/discord", import.meta.url)) ?? ""
);
const hmr = {
  enabled: process.env.NODE_ENV === "development",
};

const client = new SapphireClient({
  intents: [GatewayIntentBits.Guilds],
  baseUserDirectory,
  logger: {
    level: loglev,
  },
  hmr,
  i18n: {
    defaultLanguageDirectory,
    hmr,
  },
});

export { client };

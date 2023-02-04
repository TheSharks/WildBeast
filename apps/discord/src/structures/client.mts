import { LogLevel, SapphireClient } from "@sapphire/framework";
import "@sapphire/plugin-hmr/register";
import { GatewayIntentBits } from "discord.js";

// if TRACE is set, log everything
// if NODE_ENV is development, log debug and info
// otherwise, log info and above

const loglev = process.env.TRACE
  ? LogLevel.Trace
  : process.env.NODE_ENV === "development"
  ? LogLevel.Debug
  : LogLevel.Info;

const client = new SapphireClient({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  baseUserDirectory: import.meta.url.replace("file://", "") + "/../..",
  shards: "auto",
  logger: {
    level: loglev,
  },
  hmr: {
    enabled: process.env.NODE_ENV === "development",
  },
});

export { client };

import "@thesharks/sentry";
import { ShardingManager } from "discord.js";
import dotEnvExtended from "dotenv-extended";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

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
  }
);

manager.on("shardCreate", (shard) => console.log(`Launched shard ${shard.id}`));

manager.spawn();

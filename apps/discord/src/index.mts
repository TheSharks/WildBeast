import "@sapphire/plugin-logger/register";
// the logger needs to be registered before the framework
import dotEnvExtended from "dotenv-extended";
import * as path from "path";
import { client } from "./structures/client.mjs";

try {
  dotEnvExtended.load({
    errorOnMissing: true,
    silent: false,
    path: path.resolve(import.meta.url.replace("file://", ""), "../../.env"),
    schema: path.resolve(
      import.meta.url.replace("file://", ""),
      "../../.env.schema"
    ),
    defaults: path.resolve(
      import.meta.url.replace("file://", ""),
      "../../.env.defaults"
    ),
  });
  client.logger.debug("Loaded environment variables");
  await client.login(process.env.DISCORD_TOKEN);
  client.logger.debug("Logged in");
} catch (error) {
  client.logger.fatal(error);
  client.destroy();
  process.exit(1);
}

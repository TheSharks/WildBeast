import dotEnvExtended from "dotenv-extended";
dotEnvExtended.load(); // sure, we load the env again later, but we need to load it here for all our imports to work

import * as Sentry from "@wildbeast/sentry";
import { client } from "./structures/client.mjs";

try {
  await client.login(process.env.DISCORD_TOKEN);
  client.logger.info("Logged in");
} catch (error) {
  Sentry.captureException(error);
  client.logger.fatal(error);
  client.destroy();
  await Sentry.flush(2000);
  process.exit(1);
}

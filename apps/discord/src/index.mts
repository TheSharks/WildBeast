import * as Sentry from "@thesharks/sentry";
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

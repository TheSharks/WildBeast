import { RewriteFrames } from "@sentry/integrations";
import * as Sentry from "@sentry/node";
import * as Tracing from "@sentry/tracing";

import client from "@thesharks/prisma";

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
        })
      )
      .concat(new Tracing.Integrations.Prisma({ client }))
      .concat(new Sentry.Integrations.Http({ tracing: true }))
      .filter(function (integration) {
        return integration.name !== "Console";
      });
  },
});

export * from "@sentry/node";

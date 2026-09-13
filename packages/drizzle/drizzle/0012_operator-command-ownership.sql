ALTER TABLE "ApplicationCommandId" ADD COLUMN "operator" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- flags is the only shipped operator command. Other guild commands belong to Sapphire.
UPDATE "ApplicationCommandId" SET "operator" = true WHERE "name" = 'flags' AND "guildId" IS NOT NULL;

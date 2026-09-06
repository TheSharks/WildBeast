ALTER TABLE "Entitlement" ADD COLUMN "updatedAt" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- Normalize legacy owners before enforcing exactly one owner.
UPDATE "Entitlement" SET "userId" = NULL WHERE "userId" IS NOT NULL AND "guildId" IS NOT NULL;--> statement-breakpoint
DELETE FROM "Entitlement" WHERE "userId" IS NULL AND "guildId" IS NULL;--> statement-breakpoint
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_user_or_guild_check" CHECK ((("userId" IS NULL) <> ("guildId" IS NULL)));

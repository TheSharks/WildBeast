-- Guild subs arrive with both userId+guildId; the CHECK wants exactly one, so guild wins.
UPDATE "Entitlement" SET "userId" = NULL WHERE "userId" IS NOT NULL AND "guildId" IS NOT NULL;--> statement-breakpoint
-- Ownerless rows have nothing to attribute and would still violate the CHECK when soft-deleted, so drop them.
DELETE FROM "Entitlement" WHERE "userId" IS NULL AND "guildId" IS NULL;--> statement-breakpoint
-- Re-assert the CHECK idempotently: no-op when 0006 applied cleanly, enforced when 0006 never ran.
ALTER TABLE "Entitlement" DROP CONSTRAINT IF EXISTS "Entitlement_user_or_guild_check";--> statement-breakpoint
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_user_or_guild_check" CHECK ((("userId" IS NULL) <> ("guildId" IS NULL)));
ALTER TABLE "Tag" DROP CONSTRAINT "Tag_name_key";--> statement-breakpoint
-- Older dev/beta databases can already contain globally-scoped tags. Their
-- guild cannot be reconstructed, so retain them under the unreachable
-- sentinel guild 0 instead of making the NOT NULL addition fail the deploy.
ALTER TABLE "Tag" ADD COLUMN "guildId" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Tag" ALTER COLUMN "guildId" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_guildId_name_key" UNIQUE("guildId","name");

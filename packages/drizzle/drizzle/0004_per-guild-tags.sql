ALTER TABLE "Tag" DROP CONSTRAINT "Tag_name_key";--> statement-breakpoint
ALTER TABLE "Tag" ADD COLUMN "guildId" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_guildId_name_key" UNIQUE("guildId","name");
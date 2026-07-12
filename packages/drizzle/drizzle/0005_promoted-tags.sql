ALTER TABLE "Tag" ADD COLUMN "commandId" bigint;--> statement-breakpoint
ALTER TABLE "Tag" ADD COLUMN "commandDescription" text;--> statement-breakpoint
ALTER TABLE "Tag" ADD COLUMN "promotedBy" bigint;--> statement-breakpoint
ALTER TABLE "Tag" ADD COLUMN "promotedAt" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "Tag_commandId_key" ON "Tag" USING btree ("commandId");--> statement-breakpoint
CREATE INDEX "Tag_promoted_guildId_idx" ON "Tag" USING btree ("guildId") WHERE "commandId" IS NOT NULL;
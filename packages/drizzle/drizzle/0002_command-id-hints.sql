CREATE TABLE "ApplicationCommandId" (
	"commandId" bigint PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"guildId" bigint
);
--> statement-breakpoint
CREATE INDEX "ApplicationCommandId_name_idx" ON "ApplicationCommandId" USING btree ("name");
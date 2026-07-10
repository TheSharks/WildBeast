CREATE TABLE "Entitlement" (
	"id" bigint PRIMARY KEY NOT NULL,
	"skuId" bigint NOT NULL,
	"userId" bigint,
	"guildId" bigint,
	"type" integer NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"startsAt" timestamp with time zone,
	"endsAt" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "Entitlement_guildId_idx" ON "Entitlement" USING btree ("guildId");--> statement-breakpoint
CREATE INDEX "Entitlement_userId_idx" ON "Entitlement" USING btree ("userId");
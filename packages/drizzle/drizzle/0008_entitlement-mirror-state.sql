CREATE TABLE "EntitlementMirrorState" (
	"id" integer PRIMARY KEY NOT NULL,
	"revision" bigint DEFAULT 0 NOT NULL,
	"completedAt" timestamp with time zone,
	CONSTRAINT "EntitlementMirrorState_singleton" CHECK ("EntitlementMirrorState"."id" = 1)
);

-- Custom migration generated with drizzle-kit generate --custom.
-- Schema DDL remains generated from schema.ts; seeds and triggers require SQL.
INSERT INTO "EntitlementMirrorState" ("id") VALUES (1);
--> statement-breakpoint
-- Serialize before touching entitlement rows. This also detects writes from
-- the original runtime while the replacement is being introduced.
CREATE FUNCTION "advanceEntitlementMirrorRevision"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "EntitlementMirrorState" SET "revision" = "revision" + 1 WHERE "id" = 1;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "Entitlement_mirror_revision"
BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON "Entitlement"
FOR EACH STATEMENT EXECUTE FUNCTION "advanceEntitlementMirrorRevision"();

--> statement-breakpoint
-- Existing promoted commands remain owned, including enough payload to repair.
INSERT INTO "TagCommandIntent" (
  "tagId", "guildId", "name", "description", "argsDescription",
  "requestedBy", "requestedAt", "wanted", "attempted", "commandId"
)
SELECT "id", "guildId", lower("name"),
  coalesce("commandDescription", 'Tag "' || "name" || '" from this server'),
  'Space-separated arguments passed to the tag',
  coalesce("promotedBy", "authorId"), coalesce("promotedAt", now()),
  true, true, "commandId"
FROM "Tag" WHERE "commandId" IS NOT NULL;
--> statement-breakpoint
-- The baseline remains runnable after migration. Its promotion writes update
-- the same durable intents so they cannot become stale before cutover.
CREATE FUNCTION "mirrorLegacyTagPromotion"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."commandId" IS NOT NULL THEN
    INSERT INTO "TagCommandIntent" (
      "tagId", "guildId", "name", "description", "argsDescription",
      "requestedBy", "requestedAt", "wanted", "attempted", "commandId"
    ) VALUES (
      NEW."id", NEW."guildId", lower(NEW."name"),
      coalesce(NEW."commandDescription", 'Tag "' || NEW."name" || '" from this server'),
      'Space-separated arguments passed to the tag',
      coalesce(NEW."promotedBy", NEW."authorId"), coalesce(NEW."promotedAt", now()),
      true, true, NEW."commandId"
    ) ON CONFLICT ("guildId", "name") DO UPDATE SET
      "tagId" = EXCLUDED."tagId", "description" = EXCLUDED."description",
      "requestedBy" = EXCLUDED."requestedBy", "requestedAt" = EXCLUDED."requestedAt",
      "wanted" = true, "attempted" = true, "commandId" = EXCLUDED."commandId";
  ELSIF TG_OP = 'UPDATE' AND OLD."commandId" IS NOT NULL THEN
    UPDATE "TagCommandIntent" SET "wanted" = false WHERE "tagId" = NEW."id";
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "Tag_legacy_promotion_intent"
AFTER INSERT OR UPDATE OF "commandId", "commandDescription", "promotedBy", "promotedAt" ON "Tag"
FOR EACH ROW EXECUTE FUNCTION "mirrorLegacyTagPromotion"();

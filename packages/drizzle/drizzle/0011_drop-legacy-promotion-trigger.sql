-- Custom migration. The previous application wrote promotions directly to
-- "Tag"; this trigger mirrored them into "TagCommandIntent" while both
-- runtimes coexisted. Only the intent-based runtime remains.
DROP TRIGGER IF EXISTS "Tag_legacy_promotion_intent" ON "Tag";
--> statement-breakpoint
DROP FUNCTION IF EXISTS "mirrorLegacyTagPromotion"();

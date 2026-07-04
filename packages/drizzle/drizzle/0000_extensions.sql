-- Custom SQL migration file, put your code below! --

-- citext: case-insensitive text, used for tag names.
-- pg_trgm: trigram matching, backs substring autocomplete and
-- similarity() suggestions on tag names.
CREATE EXTENSION IF NOT EXISTS citext;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;

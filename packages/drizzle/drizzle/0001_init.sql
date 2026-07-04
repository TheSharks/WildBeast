CREATE TABLE "Guild" (
	"id" bigint PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Tag" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" "citext" NOT NULL,
	"content" text NOT NULL,
	"authorId" bigint NOT NULL,
	CONSTRAINT "Tag_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE INDEX "Tag_name_trgm_idx" ON "Tag" USING gin ("name" gin_trgm_ops);
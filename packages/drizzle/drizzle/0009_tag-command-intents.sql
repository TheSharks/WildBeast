CREATE TABLE "TagCommandIntent" (
	"id" serial PRIMARY KEY NOT NULL,
	"tagId" integer,
	"guildId" bigint NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"argsDescription" text NOT NULL,
	"requestedBy" bigint NOT NULL,
	"requestedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"wanted" boolean DEFAULT true NOT NULL,
	"attempted" boolean DEFAULT false NOT NULL,
	"commandId" bigint,
	CONSTRAINT "TagCommandIntent_guild_name_key" UNIQUE("guildId","name"),
	CONSTRAINT "TagCommandIntent_tag_key" UNIQUE("tagId"),
	CONSTRAINT "TagCommandIntent_command_key" UNIQUE("commandId")
);
--> statement-breakpoint
ALTER TABLE "TagCommandIntent" ADD CONSTRAINT "TagCommandIntent_tagId_Tag_id_fk" FOREIGN KEY ("tagId") REFERENCES "public"."Tag"("id") ON DELETE set null ON UPDATE no action;

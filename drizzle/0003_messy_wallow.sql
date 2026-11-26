CREATE TABLE "waitlist_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "waitlist_link_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "invite" DROP CONSTRAINT "invite_entry_id_waitlist_entry_id_fk";
--> statement-breakpoint
ALTER TABLE "invite" ADD COLUMN "account_id" uuid;--> statement-breakpoint
ALTER TABLE "waitlist_link" ADD CONSTRAINT "waitlist_link_entry_id_waitlist_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."waitlist_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_entry_id_waitlist_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."waitlist_entry"("id") ON DELETE cascade ON UPDATE no action;
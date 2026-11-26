CREATE TYPE "public"."admin_role" AS ENUM('owner', 'ops', 'fulfilment', 'support', 'community');--> statement-breakpoint
CREATE TYPE "public"."drop_state" AS ENUM('draft', 'scheduled', 'early_access', 'public', 'sold_out', 'closed');--> statement-breakpoint
CREATE TYPE "public"."hold_status" AS ENUM('active', 'converted', 'expired', 'released');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'confirmed', 'packing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('vnpay', 'momo', 'cod');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('created', 'pending', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."unit_status" AS ENUM('available', 'held', 'sold', 'retired');--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"phone" text,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"password_hash" text,
	"tier_id" uuid NOT NULL,
	"locale" text DEFAULT 'vi' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_email_unique" UNIQUE("email"),
	CONSTRAINT "account_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "address" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"recipient" text NOT NULL,
	"province" text NOT NULL,
	"ward" text NOT NULL,
	"street" text NOT NULL,
	"receiver_phone" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" "admin_role" NOT NULL,
	"password_hash" text,
	"mfa_secret" text,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	CONSTRAINT "admin_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"reason" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_no" text NOT NULL,
	"account_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"payment_method" "payment_provider" NOT NULL,
	"subtotal_vnd" integer NOT NULL,
	"shipping_vnd" integer NOT NULL,
	"total_vnd" integer NOT NULL,
	"pre_order" boolean DEFAULT false NOT NULL,
	"ship_to" jsonb NOT NULL,
	"invoice" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_order_order_no_unique" UNIQUE("order_no")
);
--> statement-breakpoint
CREATE TABLE "drop_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer NOT NULL,
	"name" text NOT NULL,
	"state" "drop_state" DEFAULT 'draft' NOT NULL,
	"early_access_at" timestamp with time zone,
	"public_at" timestamp with time zone,
	"close_at" timestamp with time zone,
	CONSTRAINT "drop_run_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "edition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drop_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"size" integer NOT NULL,
	"price_vnd" integer NOT NULL,
	"per_person_cap" integer DEFAULT 1 NOT NULL,
	"locked_at" timestamp with time zone,
	CONSTRAINT "edition_drop_id_variant_id_unique" UNIQUE("drop_id","variant_id"),
	CONSTRAINT "edition_size_positive" CHECK ("edition"."size" > 0)
);
--> statement-breakpoint
CREATE TABLE "edition_unit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"status" "unit_status" DEFAULT 'available' NOT NULL,
	"hold_id" uuid,
	"held_until" timestamp with time zone,
	CONSTRAINT "edition_unit_edition_id_number_unique" UNIQUE("edition_id","number")
);
--> statement-breakpoint
CREATE TABLE "hold" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"edition_id" uuid NOT NULL,
	"status" "hold_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"extensions" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "invite_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "order_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"edition_unit_id" uuid NOT NULL,
	"price_vnd" integer NOT NULL,
	CONSTRAINT "order_line_edition_unit_id_unique" UNIQUE("edition_unit_id")
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"provider_txn_id" text,
	"idempotency_key" text NOT NULL,
	"amount_vnd" integer NOT NULL,
	"status" "payment_status" DEFAULT 'created' NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_provider_txn_id_unique" UNIQUE("provider_txn_id"),
	CONSTRAINT "payment_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "physical_unit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_unit_id" uuid NOT NULL,
	"serial_no" text NOT NULL,
	"qc_result" text,
	"disposition" text,
	CONSTRAINT "physical_unit_edition_unit_id_unique" UNIQUE("edition_unit_id"),
	CONSTRAINT "physical_unit_serial_no_unique" UNIQUE("serial_no")
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"sku_family" text NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "product_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "refund" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount_vnd" integer NOT NULL,
	"method" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_line_id" uuid NOT NULL,
	"type" text NOT NULL,
	"rma_no" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"reason" text,
	"photos" text[] DEFAULT '{}'::text[] NOT NULL,
	"refund_bank" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "return_request_rma_no_unique" UNIQUE("rma_no")
);
--> statement-breakpoint
CREATE TABLE "setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"carrier" text NOT NULL,
	"tracking_code" text,
	"status" text DEFAULT 'created' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"early_access_minutes" integer DEFAULT 0 NOT NULL,
	"cap_override" integer,
	CONSTRAINT "tier_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "variant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"colour" text NOT NULL,
	"list_price_vnd" integer NOT NULL,
	CONSTRAINT "variant_product_id_colour_unique" UNIQUE("product_id","colour")
);
--> statement-breakpoint
CREATE TABLE "waitlist_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_norm" text NOT NULL,
	"drop_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"interests" text[] DEFAULT '{}'::text[] NOT NULL,
	"phone" text,
	"source" jsonb,
	"locale" text DEFAULT 'vi' NOT NULL,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_entry_email_norm_drop_id_unique" UNIQUE("email_norm","drop_id")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_tier_id_tier_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."tier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_admin_id_admin_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition" ADD CONSTRAINT "edition_drop_id_drop_run_id_fk" FOREIGN KEY ("drop_id") REFERENCES "public"."drop_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition" ADD CONSTRAINT "edition_variant_id_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_unit" ADD CONSTRAINT "edition_unit_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_unit" ADD CONSTRAINT "edition_unit_hold_id_hold_id_fk" FOREIGN KEY ("hold_id") REFERENCES "public"."hold"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hold" ADD CONSTRAINT "hold_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hold" ADD CONSTRAINT "hold_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_entry_id_waitlist_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."waitlist_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_order_id_customer_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."customer_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_edition_unit_id_edition_unit_id_fk" FOREIGN KEY ("edition_unit_id") REFERENCES "public"."edition_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_order_id_customer_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."customer_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "physical_unit" ADD CONSTRAINT "physical_unit_edition_unit_id_edition_unit_id_fk" FOREIGN KEY ("edition_unit_id") REFERENCES "public"."edition_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_request" ADD CONSTRAINT "return_request_order_line_id_order_line_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_order_id_customer_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."customer_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant" ADD CONSTRAINT "variant_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entry" ADD CONSTRAINT "waitlist_entry_drop_id_drop_run_id_fk" FOREIGN KEY ("drop_id") REFERENCES "public"."drop_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hold_one_active" ON "hold" USING btree ("account_id","edition_id") WHERE "hold"."status" = 'active';
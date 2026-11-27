ALTER TABLE "order_line" DROP CONSTRAINT "order_line_edition_unit_id_unique";--> statement-breakpoint
ALTER TABLE "order_line" ADD COLUMN "released_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "order_line_one_claim" ON "order_line" USING btree ("edition_unit_id") WHERE "order_line"."released_at" is null;
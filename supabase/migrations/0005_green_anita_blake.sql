ALTER TABLE "tickets" ADD COLUMN "external_id" varchar(255);--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_external_id_unique" UNIQUE("external_id");
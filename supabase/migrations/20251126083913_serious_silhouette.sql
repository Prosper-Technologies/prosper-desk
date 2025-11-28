ALTER TABLE "forms" DROP CONSTRAINT "forms_company_id_slug_unique";--> statement-breakpoint
ALTER TABLE "forms" ALTER COLUMN "client_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_company_id_client_id_slug_unique" UNIQUE("company_id","client_id","slug");
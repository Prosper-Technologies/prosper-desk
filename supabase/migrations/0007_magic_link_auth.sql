-- Remove access_token and expires_at columns for magic link authentication
ALTER TABLE "customer_portal_access" DROP COLUMN IF EXISTS "access_token";
ALTER TABLE "customer_portal_access" DROP COLUMN IF EXISTS "expires_at";


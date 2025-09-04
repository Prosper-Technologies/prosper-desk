import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.production" });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./supabase/migrations",
  verbose: true,
  strict: true,
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});

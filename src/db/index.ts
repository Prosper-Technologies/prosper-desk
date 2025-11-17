import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Database connection for migrations (service role)
const migrationClient = postgres(process.env.DATABASE_URL!, {
  max: 1,
  transform: postgres.fromCamel, // For migrations we want snake_case
});
export const migrationDb = drizzle(migrationClient, { schema });

// Database connection for queries (uses RLS with user JWT)
const queryClient = postgres(process.env.DATABASE_URL!, {
  max: 10,
  // Don't use postgres.camel transform - let Drizzle handle casing
});
export const db = drizzle(queryClient, { schema, casing: 'camelCase' });

export * from "./schema";

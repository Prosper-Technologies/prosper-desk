import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Database connection for migrations (service role)
const migrationClient = postgres(process.env.DATABASE_URL!, {
  max: 1,
  transform: postgres.fromCamel, // For migrations we want snake_case
});
export const migrationDb = drizzle(migrationClient, { schema });

// Database connection for queries (uses RLS with user JWT)
const queryClient = postgres(process.env.DATABASE_URL!, {
  max: 10,
  transform: postgres.camel, // Convert snake_case to camelCase
});
export const db = drizzle(queryClient, { schema });

export * from './schema';

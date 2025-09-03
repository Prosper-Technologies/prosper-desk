-- Initial database setup for BlueDesk
-- This file will be executed when the Docker container starts
-- Create the main database (if not exists)
-- Note: The database 'bluedesk' is already created by docker-compose.yml
-- Create any extensions we might need
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- The actual schema will be created by Drizzle migrations
-- This file is just for initial setup

import pg from "pg";
import { config } from "../config.js";

const { Pool } = pg;

if (!config.databaseUrl) {
  console.warn("DATABASE_URL nao definido. Configure no .env para usar API/DB.");
}

export const pool = new Pool({
  connectionString: config.databaseUrl || undefined,
});

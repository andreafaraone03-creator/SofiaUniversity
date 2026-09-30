import pg from "pg";

const { Pool } = pg;

/**
 * Low-level pool factory for services which deliberately use a database
 * variable other than the workspace default. This module never reads
 * DATABASE_URL and does not create the shared workspace client.
 */
export function createPool(connectionString: string, max = 10): pg.Pool {
  return new Pool({ connectionString, max });
}

export type { PoolClient, Pool, QueryResult, QueryResultRow } from "pg";
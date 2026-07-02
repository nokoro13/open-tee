import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local — see .env.example."
    );
  }

  const sql = neon(url);
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof createDb>;

declare global {
  // eslint-disable-next-line no-var
  var __openteeDb: Db | undefined;
}

export function getDb() {
  if (!globalThis.__openteeDb) {
    globalThis.__openteeDb = createDb();
  }
  return globalThis.__openteeDb;
}

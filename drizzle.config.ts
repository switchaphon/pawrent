/**
 * drizzle-kit config — introspection convenience only.
 *
 * Run `npx drizzle-kit pull` to re-introspect the DB and generate a draft
 * schema. Generated output goes to drizzle/ (gitignored) — never ship it.
 * The canonical schema lives at lib/db/schema.ts.
 *
 * Uses the admin URL so drizzle-kit can read table definitions without RLS
 * blocking access to system catalogs.
 */
import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_ADMIN_URL ??
      "postgres://pawrent_admin:pawrent_admin_dev_password@localhost:5433/pawrent",
  },
} satisfies Config;

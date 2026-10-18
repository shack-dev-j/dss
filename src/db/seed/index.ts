import dotenv from "dotenv";
import { getDb, runMigrations } from "../client";
import { resetDatabase, seedDatabase } from "./seed";

// CLI: `pnpm db:seed` — loads demo data (fictional Uzbek names) after wiping tables.
async function main() {
  dotenv.config({ path: ".env.local" });
  dotenv.config();
  if (process.env.NODE_ENV === "production" && process.env.DEMO_MODE !== "true") {
    throw new Error("Refusing to seed demo data in production (set DEMO_MODE=true to override).");
  }
  await runMigrations();
  const db = getDb();
  await resetDatabase(db);
  await seedDatabase(db, process.env.SEED_PASSWORD || undefined);
  console.log("Seeded demo data. Username examples: azamat.toirov, jasur.rahimov, director, manager");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { getDb, runMigrations } from "@/db/client";
import { resetDatabase, seedDatabase } from "@/db/seed/seed";

export async function setupDb() {
  await runMigrations();
  await resetDatabase(getDb());
  await seedDatabase(getDb());
}

export async function resetDb() {
  await resetDatabase(getDb());
  await seedDatabase(getDb());
}

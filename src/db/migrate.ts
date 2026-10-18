import dotenv from "dotenv";
import { runMigrations } from "./client";

// CLI: `pnpm db:migrate`
async function main() {
  dotenv.config({ path: ".env.local" });
  dotenv.config();
  await runMigrations();
  console.log("Migrations applied.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

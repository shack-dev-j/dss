import dotenv from "dotenv";
import { bootstrapAdmin } from "./bootstrap";
import { runMigrations } from "./client";

// CLI: BOOTSTRAP_ADMIN_USERNAME=... BOOTSTRAP_ADMIN_PASSWORD=... pnpm admin:bootstrap
async function main() {
  dotenv.config({ path: ".env.local" });
  dotenv.config();
  await runMigrations();
  const r = await bootstrapAdmin();
  console.log(r === "created" ? "Done." : "Nothing to do (set BOOTSTRAP_ADMIN_USERNAME/PASSWORD, and the database must have no users).");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

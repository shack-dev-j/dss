// Runs once when the server starts (not during `next build`). Fail closed.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertEnv } = await import("@/lib/env");
    assertEnv();
    // Docker/Compose sets MIGRATE_ON_START=true so a fresh database gets its tables before serving requests.
    if (process.env.MIGRATE_ON_START === "true") {
      const { runMigrations } = await import("@/db/client");
      await runMigrations();
    }
  }
}

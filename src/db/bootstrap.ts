import { eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { ensureCurrentYear } from "./admin";
import * as t from "./schema";
import { hashPassword } from "@/lib/auth";

/**
 * A brand-new production database has no users, so nobody could log in to create any.
 * If it is completely empty and BOOTSTRAP_ADMIN_USERNAME / BOOTSTRAP_ADMIN_PASSWORD are set,
 * create that one administrator (who must change the password at first login).
 * Does nothing once any user exists, so leaving the variables set is harmless; remove them anyway.
 */
export async function bootstrapAdmin(env: NodeJS.ProcessEnv = process.env): Promise<"created" | "skipped"> {
  const username = (env.BOOTSTRAP_ADMIN_USERNAME ?? "").trim().toLowerCase();
  const password = env.BOOTSTRAP_ADMIN_PASSWORD ?? "";
  if (!username || !password) return "skipped";
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)) throw new Error("BOOTSTRAP_ADMIN_USERNAME is not a valid username");
  if (password.length < 12) throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters");

  const db = getDb();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(t.users);
  if (n > 0) return "skipped";
  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await ensureCurrentYear(tx);
    const [u] = await tx
      .insert(t.users)
      .values({ username, fullName: env.BOOTSTRAP_ADMIN_NAME?.trim() || "Administrator", role: "admin", passwordHash, mustChangePassword: true })
      .returning({ id: t.users.id });
    await tx.insert(t.auditLog).values({ userId: u.id, action: "bootstrap.admin", entity: "user", entityId: u.id });
  });
  console.log(`[bootstrap] Created the first administrator "${username}". Log in and change the password, then remove BOOTSTRAP_ADMIN_* from the environment.`);
  return "created";
}

export async function adminExists(username: string) {
  const [u] = await getDb().select({ id: t.users.id }).from(t.users).where(eq(t.users.username, username));
  return !!u;
}

import { describe, it, expect, beforeAll } from "vitest";
import { getDb, runMigrations } from "@/db/client";
import { resetDatabase, seedDatabase } from "@/db/seed/seed";
import { bootstrapAdmin } from "@/db/bootstrap";
import { users, academicYears } from "@/db/schema";
import * as login from "@/app/api/auth/login/route";
import * as me from "@/app/api/auth/me/route";

const env = (o: Record<string, string>) => ({ ...o }) as NodeJS.ProcessEnv;

describe("first administrator bootstrap", () => {
  beforeAll(async () => { await runMigrations(); await resetDatabase(getDb()); });

  it("does nothing without credentials, and refuses weak ones", async () => {
    expect(await bootstrapAdmin(env({}))).toBe("skipped");
    await expect(bootstrapAdmin(env({ BOOTSTRAP_ADMIN_USERNAME: "boss", BOOTSTRAP_ADMIN_PASSWORD: "short" }))).rejects.toThrow(/12 characters/);
    await expect(bootstrapAdmin(env({ BOOTSTRAP_ADMIN_USERNAME: "B!", BOOTSTRAP_ADMIN_PASSWORD: "a-long-enough-password" }))).rejects.toThrow(/username/);
    expect(await getDb().select().from(users)).toHaveLength(0);
  });

  it("creates one admin in an empty database who must change the password; never again afterwards", async () => {
    const e = env({ BOOTSTRAP_ADMIN_USERNAME: "Head.Admin", BOOTSTRAP_ADMIN_PASSWORD: "a-long-enough-password" });
    expect(await bootstrapAdmin(e)).toBe("created");
    expect(await getDb().select().from(academicYears)).toHaveLength(1);
    const res = await login.POST(new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "head.admin", password: "a-long-enough-password" }) }));
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie")!.split(";")[0];
    const body = await (await me.GET(new Request("http://localhost/x", { headers: { cookie } }))).json();
    expect(body.user).toMatchObject({ role: "admin", mustChangePassword: true });
    expect(await bootstrapAdmin(e)).toBe("skipped"); // users exist now
    expect(await getDb().select().from(users)).toHaveLength(1);
  });

  it("is skipped on a database that already has users", async () => {
    await resetDatabase(getDb());
    await seedDatabase(getDb());
    expect(await bootstrapAdmin(env({ BOOTSTRAP_ADMIN_USERNAME: "intruder", BOOTSTRAP_ADMIN_PASSWORD: "a-long-enough-password" }))).toBe("skipped");
  });
});

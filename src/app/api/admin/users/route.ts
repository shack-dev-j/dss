import { NextResponse } from "next/server";
import { withAuth } from "@/lib/authz";
import { db } from "@/db";

export const GET = withAuth(
  async () => {
    const users = (await db.getAllUsers()).map(({ passwordHash, ...u }) => {
      void passwordHash;
      return { ...u, createdAt: u.createdAt.toISOString() };
    });
    return NextResponse.json({ users });
  },
  { roles: ["admin"] }
);

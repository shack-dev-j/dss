import { NextResponse } from "next/server";
import { withAuth } from "@/lib/authz";
import { db } from "@/db";

// Classes the user is class teacher of (admins: every class). Used by the attendance summary.
export const GET = withAuth(
  async (_req, user) =>
    NextResponse.json({ classes: await db.getClassesForClassTeacher(user.role === "teacher" ? user.id : undefined) }),
  { roles: ["teacher", "admin"] }
);

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/authz";
import { db } from "@/db";

// The (class, subject) pairs a teacher teaches; admins see all of them.
export const GET = withAuth(
  async (_req, user) =>
    NextResponse.json({ courses: await db.getCourses(user.role === "teacher" ? user.id : undefined) }),
  { roles: ["teacher", "admin"] }
);

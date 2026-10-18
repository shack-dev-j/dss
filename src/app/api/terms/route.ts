import { NextResponse } from "next/server";
import { readJson, withAuth } from "@/lib/authz";
import { createTerm } from "@/db/admin";
import { db } from "@/db";

// ?courseId=... limits the list to the academic year of that course's class (used by the marks screen).
export const GET = withAuth(async (req) => {
  const courseId = new URL(req.url).searchParams.get("courseId");
  return NextResponse.json({ terms: courseId ? await db.getTermsForCourse(courseId) : await db.getTerms() });
});

export const POST = withAuth(
  async (req, user) => {
    const b = await readJson(req);
    const term = await createTerm({ name: String(b.name ?? ""), startDate: String(b.startDate ?? ""), endDate: String(b.endDate ?? "") }, user.id);
    return NextResponse.json({ term }, { status: 201 });
  },
  { roles: ["admin"] }
);

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/authz";
import { db } from "@/db";

// ?courseId=... limits the list to the academic year of that course's class (used by the marks screen).
export const GET = withAuth(async (req) => {
  const courseId = new URL(req.url).searchParams.get("courseId");
  return NextResponse.json({ terms: courseId ? await db.getTermsForCourse(courseId) : await db.getTerms() });
});

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/authz";
import { assertCanSeeTranscript } from "@/lib/transcript-access";
import { loadTranscript } from "@/lib/transcript-data";

type Ctx = { params: Promise<{ studentId: string }> };

// ?termId=... for one term; without it the whole academic year.
export const GET = withAuth<Ctx>(async (req, user, ctx) => {
  const { studentId } = await ctx.params;
  await assertCanSeeTranscript(user, studentId);
  const termId = new URL(req.url).searchParams.get("termId") || undefined;
  return NextResponse.json(await loadTranscript(studentId, termId));
});

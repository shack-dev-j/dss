import { schoolDate } from "@/lib/dates";
import { withAuth } from "@/lib/authz";
import { renderTranscriptPdf } from "@/lib/transcript-pdf";
import { assertCanSeeTranscript } from "@/lib/transcript-access";
import { loadTranscript } from "@/lib/transcript-data";

type Ctx = { params: Promise<{ studentId: string }> };

export const GET = withAuth<Ctx>(async (req, user, ctx) => {
  const { studentId } = await ctx.params;
  await assertCanSeeTranscript(user, studentId);
  const sp = new URL(req.url).searchParams;
  const { student, scale, termName, transcript } = await loadTranscript(studentId, sp.get("termId") || undefined);
  const pdf = await renderTranscriptPdf({
    lang: sp.get("lang") === "en" ? "en" : "uz",
    student, periodName: termName, transcript, scale, issuedOn: schoolDate(),
  });
  const file = `transcript_${student.fullName.replace(/[^\w]+/g, "_")}_${student.className}${termName ? `_${termName.replace(/[^\w]+/g, "")}` : ""}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

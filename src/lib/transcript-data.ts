import { getGradingScale, getTranscriptSource } from "@/db/admin";
import { db } from "@/db";
import { HttpError } from "@/lib/errors";
import { buildTranscript } from "@/lib/transcript";

export async function loadTranscript(studentId: string, termId?: string) {
  const source = await getTranscriptSource(studentId);
  if (!source) throw new HttpError(404, "Student not found");
  let termName: string | null = null;
  if (termId) {
    const term = await db.getTermById(termId);
    if (!term) throw new HttpError(400, "Unknown term");
    termName = term.name;
  }
  const scale = await getGradingScale();
  return { student: source.student, scale, termName, transcript: buildTranscript(source.marks, scale, termId) };
}

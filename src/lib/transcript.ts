import { finalGrade, GradingScale } from "@/lib/grading";

export interface TranscriptMark {
  subjectId: string;
  subjectName: string;
  teacherName: string;
  termId: string;
  termName: string;
  termStart: string;
  score: number;
  maxScore: number;
}

export interface TranscriptSubject {
  subjectId: string;
  subjectName: string;
  teacherName: string;
  /** per term: average % and final grade (null if the subject has no marks in that term) */
  terms: Record<string, { average: number; grade: number | null } | undefined>;
  /** average of the term averages shown, and its final grade */
  periodAverage: number;
  periodGrade: number | null;
}

export interface Transcript {
  terms: { id: string; name: string }[];
  subjects: TranscriptSubject[];
  overall: { terms: Record<string, number | undefined>; period: number | null; grade: number | null };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Per subject and term: average % = points earned / points possible. Period (year or one term):
 * mean of that subject's term averages; overall = mean of the subject period averages.
 * Final grades come from the school's grading scale.
 */
export function buildTranscript(marks: TranscriptMark[], scale: GradingScale, onlyTermId?: string): Transcript {
  const rows = onlyTermId ? marks.filter((m) => m.termId === onlyTermId) : marks;
  const termMeta = new Map<string, { id: string; name: string; start: string }>();
  const acc = new Map<string, { subjectName: string; teacherName: string; terms: Map<string, { got: number; max: number }> }>();
  for (const m of rows) {
    if (m.maxScore <= 0) continue;
    termMeta.set(m.termId, { id: m.termId, name: m.termName, start: m.termStart });
    const s = acc.get(m.subjectId) ?? { subjectName: m.subjectName, teacherName: m.teacherName, terms: new Map() };
    const t = s.terms.get(m.termId) ?? { got: 0, max: 0 };
    t.got += m.score;
    t.max += m.maxScore;
    s.terms.set(m.termId, t);
    acc.set(m.subjectId, s);
  }
  const terms = [...termMeta.values()].sort((a, b) => a.start.localeCompare(b.start)).map(({ id, name }) => ({ id, name }));

  const subjects: TranscriptSubject[] = [...acc.entries()]
    .map(([subjectId, s]) => {
      const perTerm: TranscriptSubject["terms"] = {};
      const avgs: number[] = [];
      for (const [termId, t] of s.terms) {
        const average = round1((t.got / t.max) * 100);
        perTerm[termId] = { average, grade: finalGrade(average, scale) };
        avgs.push(average);
      }
      const periodAverage = round1(avgs.reduce((a, b) => a + b, 0) / avgs.length);
      return { subjectId, subjectName: s.subjectName, teacherName: s.teacherName, terms: perTerm, periodAverage, periodGrade: finalGrade(periodAverage, scale) };
    })
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  const overallTerms: Record<string, number | undefined> = {};
  for (const t of terms) {
    const vals = subjects.map((s) => s.terms[t.id]?.average).filter((v): v is number => v !== undefined);
    if (vals.length) overallTerms[t.id] = round1(vals.reduce((a, b) => a + b, 0) / vals.length);
  }
  const period = subjects.length ? round1(subjects.reduce((a, s) => a + s.periodAverage, 0) / subjects.length) : null;
  return { terms, subjects, overall: { terms: overallTerms, period, grade: finalGrade(period, scale) } };
}

export type Lang = "uz" | "en";

export const LABELS: Record<Lang, Record<string, string>> = {
  en: {
    school: "Namangan Presidential School", title: "Academic Transcript", student: "Student", class: "Class", year: "Academic year",
    period: "Period", fullYear: "Full year", subject: "Subject", teacher: "Teacher", yearAvg: "Year avg", termAvg: "Term avg", grade: "Grade",
    overall: "Overall", scale5: "5-point scale: 5 = {five}% and above, 4 = {four}%, 3 = {three}%, 2 = below", scalePct: "Grades are shown as percentages",
    generated: "Issued", noMarks: "No marks recorded for this period.", director: "Director", classTeacher: "Class teacher", stamp: "Stamp",
    note: "Averages are points earned divided by points possible; the year average is the mean of the term averages.",
  },
  uz: {
    school: "Namangan Prezident Maktabi", title: "Akademik ma'lumotnoma", student: "O'quvchi", class: "Sinf", year: "O'quv yili",
    period: "Davr", fullYear: "To'liq yil", subject: "Fan", teacher: "O'qituvchi", yearAvg: "Yillik o'rtacha", termAvg: "Chorak o'rtachasi", grade: "Baho",
    overall: "Umumiy", scale5: "5 ballik tizim: 5 = {five}% va yuqori, 4 = {four}%, 3 = {three}%, 2 = undan past", scalePct: "Baholar foizda ko'rsatilgan",
    generated: "Berilgan sana", noMarks: "Bu davr uchun baholar yo'q.", director: "Direktor", classTeacher: "Sinf rahbari", stamp: "Muhr",
    note: "O'rtacha = to'plangan ball / mumkin bo'lgan ball; yillik o'rtacha chorak o'rtachalarining o'rtacha qiymati.",
  },
};

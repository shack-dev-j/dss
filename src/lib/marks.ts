export interface MarkLike {
  subjectId: string;
  subjectName: string;
  termId: string;
  termName: string;
  score: number;
  maxScore: number;
}

export interface TermSummary {
  termId: string;
  termName: string;
  subjects: Array<{ subjectId: string; subjectName: string; average: number; count: number }>;
  /** Mean of the subject averages (each subject counts once), or null if there are no marks. */
  overall: number | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Subject average for a term = total points / total possible points * 100
 * (so a 20-point quiz weighs less than a 100-point exam). Overall = mean of subject averages.
 */
export function summarizeMarks(marks: MarkLike[]): TermSummary[] {
  const terms = new Map<string, TermSummary & { acc: Map<string, { name: string; got: number; max: number; n: number }> }>();
  for (const m of marks) {
    if (m.maxScore <= 0) continue;
    let term = terms.get(m.termId);
    if (!term) {
      term = { termId: m.termId, termName: m.termName, subjects: [], overall: null, acc: new Map() };
      terms.set(m.termId, term);
    }
    const a = term.acc.get(m.subjectId) ?? { name: m.subjectName, got: 0, max: 0, n: 0 };
    a.got += m.score;
    a.max += m.maxScore;
    a.n += 1;
    term.acc.set(m.subjectId, a);
  }
  return [...terms.values()].map(({ acc, ...term }) => {
    const subjects = [...acc.entries()]
      .map(([subjectId, a]) => ({ subjectId, subjectName: a.name, average: round1((a.got / a.max) * 100), count: a.n }))
      .sort((x, y) => x.subjectName.localeCompare(y.subjectName));
    const overall = subjects.length ? round1(subjects.reduce((s, x) => s + x.average, 0) / subjects.length) : null;
    return { ...term, subjects, overall };
  });
}

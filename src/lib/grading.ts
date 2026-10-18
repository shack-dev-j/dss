export type GradingScale = { mode: "percent" } | { mode: "five_point"; thresholds: { five: number; four: number; three: number } };

// Common 5-point mapping used in Uzbek schools; the school can change it in Settings.
export const DEFAULT_SCALE: GradingScale = { mode: "five_point", thresholds: { five: 86, four: 71, three: 55 } };

/** Final grade for an average percentage: 2..5 in five_point mode, the rounded percent otherwise. */
export function finalGrade(percent: number | null, scale: GradingScale): number | null {
  if (percent === null) return null;
  if (scale.mode === "percent") return Math.round(percent);
  const t = scale.thresholds;
  return percent >= t.five ? 5 : percent >= t.four ? 4 : percent >= t.three ? 3 : 2;
}

export function parseScale(v: unknown): GradingScale | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (o.mode === "percent") return { mode: "percent" };
  if (o.mode === "five_point" && o.thresholds && typeof o.thresholds === "object") {
    const { five, four, three } = o.thresholds as Record<string, unknown>;
    if ([five, four, three].every((n) => typeof n === "number" && n >= 0 && n <= 100) && (five as number) > (four as number) && (four as number) > (three as number)) {
      return { mode: "five_point", thresholds: { five: five as number, four: four as number, three: three as number } };
    }
  }
  return null;
}

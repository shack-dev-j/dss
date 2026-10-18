// Central, lazy environment access. Nothing here runs at import time, so
// `next build` works without runtime secrets; the app fails closed on first use.

export class ConfigError extends Error {}

function required(name: string, minLength = 1): string {
  const value = process.env[name];
  if (!value || value.length < minLength) {
    throw new ConfigError(
      `Missing or too short environment variable ${name}` + (minLength > 1 ? ` (min ${minLength} chars)` : "")
    );
  }
  return value;
}

export const env = {
  databaseUrl: () => required("DATABASE_URL"),
  sessionSecret: () => required("SESSION_SECRET", 32),
  anonymousPepper: () => required("ANONYMOUS_PEPPER", 16),
};

/** Throws ConfigError if any required variable is missing. Called at server start. */
export function assertEnv(): void {
  env.databaseUrl();
  env.sessionSecret();
  env.anonymousPepper();
}

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

export const FEATURE_NAMES = [
  "suggestions",
  "guardian",
  "events",
  "projects",
  "facilities",
  "knowledge",
  "workload",
] as const;
export type FeatureName = (typeof FEATURE_NAMES)[number];

/** FEATURES is a comma-separated list, or "all". Off by default. */
export function enabledFeatures(): FeatureName[] {
  const raw = (process.env.FEATURES || "").trim().toLowerCase();
  if (raw === "all") return [...FEATURE_NAMES];
  const set = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
  return FEATURE_NAMES.filter((f) => set.has(f));
}

export function isFeatureEnabled(name: FeatureName): boolean {
  return enabledFeatures().includes(name);
}

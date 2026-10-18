import type { FeatureName } from "@/lib/env";

// Client-safe map from sidebar/tab id to the FEATURES flag that gates it.
// Tabs not listed here (dashboard, timetable, assignments, attendance,
// announcements, csv-import) are always available.
export const TAB_FEATURE: Record<string, FeatureName> = {
  suggestions: "suggestions",
  "suggestions-review": "suggestions",
  guardian: "guardian",
  events: "events",
  projects: "projects",
  facilities: "facilities",
  policies: "knowledge",
  workload: "workload",
};

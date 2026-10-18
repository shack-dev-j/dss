import { NextResponse } from "next/server";
import { badRequest, notFound, readJson, withAuth } from "@/lib/authz";
import { db } from "@/db";
import { SuggestionStatus } from "@/types";

const STATUSES: SuggestionStatus[] = ["received", "under_review", "approved", "denied", "in_progress", "implemented", "closed"];

export const POST = withAuth(
  async (req) => {
    const body = await readJson(req);
    const status = STATUSES.find((s) => s === body.status);
    if (typeof body.id !== "string" || !status) throw badRequest("Missing or invalid parameters.");
    try {
      const updated = await db.updateAnonymousSuggestionStatus(
        body.id, status, typeof body.officialResponse === "string" ? body.officialResponse : undefined
      );
      return NextResponse.json({ suggestion: updated });
    } catch {
      throw notFound("Suggestion not found");
    }
  },
  { feature: "suggestions", roles: ["admin"] }
);

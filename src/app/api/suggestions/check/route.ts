import { NextResponse } from "next/server";
import { badRequest, notFound, readJson, withAuth } from "@/lib/authz";
import { db } from "@/db";

export const POST = withAuth(
  async (req) => {
    const body = await readJson(req);
    if (typeof body.receiptCode !== "string" || typeof body.secretToken !== "string") {
      throw badRequest("Both receiptCode and secretToken are required.");
    }
    const suggestion = await db.getAnonymousSuggestionByReceipt(body.receiptCode, body.secretToken);
    if (!suggestion) throw notFound("Invalid receipt code or secret token. Access denied.");
    return NextResponse.json({ suggestion });
  },
  { feature: "suggestions" }
);

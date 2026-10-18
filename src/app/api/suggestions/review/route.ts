import { NextResponse } from "next/server";
import { withAuth } from "@/lib/authz";
import { db } from "@/db";

export const GET = withAuth(
  async () => NextResponse.json({ suggestions: await db.getAllAnonymousSuggestions() }),
  { feature: "suggestions", roles: ["admin"] }
);

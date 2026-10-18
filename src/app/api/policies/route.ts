import { NextResponse } from "next/server";
import { withAuth } from "@/lib/authz";
import { db } from "@/db";

export const GET = withAuth(
  async (req) => {
    const category = new URL(req.url).searchParams.get("category") || undefined;
    return NextResponse.json({ policies: await db.getPolicies(category) });
  },
  { feature: "knowledge" }
);

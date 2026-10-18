import { NextResponse } from "next/server";
import { withAuth } from "@/lib/authz";
import { db } from "@/db";

// Wipes and reseeds the database. Exists only when DEMO_MODE=true.
export const POST = withAuth(
  async () => {
    await db.resetDemoData();
    return NextResponse.json({ success: true, message: "Demo data reset successfully" });
  },
  { demoOnly: true, roles: ["admin"] }
);

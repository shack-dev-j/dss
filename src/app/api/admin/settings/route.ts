import { NextResponse } from "next/server";
import { badRequest, readJson, withAuth } from "@/lib/authz";
import { parseScale } from "@/lib/grading";
import { getGradingScale, setGradingScale } from "@/db/admin";

// Readable by any logged-in user (the UI shows grades in this scale); only admins change it.
export const GET = withAuth(async () => NextResponse.json({ gradingScale: await getGradingScale() }));

export const PUT = withAuth(
  async (req, user) => {
    const b = await readJson(req);
    const scale = parseScale(b.gradingScale);
    if (!scale) throw badRequest('gradingScale must be {"mode":"percent"} or {"mode":"five_point","thresholds":{"five":86,"four":71,"three":55}} with five > four > three');
    await setGradingScale(scale, user.id);
    return NextResponse.json({ gradingScale: scale });
  },
  { roles: ["admin"] }
);

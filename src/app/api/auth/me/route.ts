import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { enabledFeatures, isDemoMode } from "@/lib/env";
import { errorResponse } from "@/lib/authz";

// Returns the current user plus the flags the UI needs. When there is no
// session the response is 401 but still tells the login page if demo mode is on.
export async function GET(req: Request) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Authentication required", demoMode: isDemoMode() }, { status: 401 });
    }
    return NextResponse.json({ user, demoMode: isDemoMode(), features: enabledFeatures() });
  } catch (e) {
    return errorResponse(e);
  }
}

import { NextResponse } from "next/server";
import { badRequest, readJson, withAuth } from "@/lib/authz";
import { db } from "@/db";

export const GET = withAuth(
  async () => {
    const [events, clubs, projects] = await Promise.all([db.getEvents(), db.getClubs(), db.getProjects()]);
    return NextResponse.json({ events, clubs, projects });
  },
  { feature: ["events", "projects"] }
);

export const POST = withAuth(
  async (req) => {
    const body = await readJson(req);
    if (typeof body.eventId !== "string") throw badRequest("eventId is required");
    try {
      return NextResponse.json({ event: await db.registerForEvent(body.eventId) });
    } catch (e) {
      throw badRequest(e instanceof Error ? e.message : "Failed to register");
    }
  },
  { feature: "events" }
);

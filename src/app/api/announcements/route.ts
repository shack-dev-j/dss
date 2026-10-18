import { NextResponse } from "next/server";
import { badRequest, readJson, withAuth } from "@/lib/authz";
import { db } from "@/db";

type Audience = "all" | "staff" | "class" | "students";
const PRIORITIES = ["urgent", "normal", "info"] as const;
const AUDIENCES: Audience[] = ["all", "staff", "class", "students"];

// What each role is allowed to read.
const VISIBLE: Record<string, Audience[]> = {
  admin: ["all", "staff", "class", "students"],
  teacher: ["all", "staff", "class"],
  student: ["all", "class", "students"],
  parent: ["all", "class"],
};

export const GET = withAuth(async (req, user) => {
  const requested = new URL(req.url).searchParams.get("audience") as Audience | null;
  const allowed = VISIBLE[user.role] ?? ["all"];
  const audiences = requested && requested !== "all" ? allowed.filter((a) => a === requested || a === "all") : allowed;
  return NextResponse.json({ announcements: await db.getAnnouncements(audiences) });
});

export const POST = withAuth(
  async (req, user) => {
    const body = await readJson(req);
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const targetAudience = AUDIENCES.includes(body.targetAudience as Audience) ? (body.targetAudience as Audience) : "all";
    const priority = PRIORITIES.includes(body.priority as never) ? (body.priority as (typeof PRIORITIES)[number]) : "normal";
    if (!title || !content) throw badRequest("title and content are required");
    const announcement = await db.createAnnouncement({
      authorId: user.id, authorName: user.fullName, title, content, targetAudience, priority,
    });
    return NextResponse.json({ announcement }, { status: 201 });
  },
  { roles: ["admin", "teacher"] }
);

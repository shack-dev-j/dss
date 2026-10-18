import { NextResponse } from "next/server";
import { readJson, withAuth } from "@/lib/authz";
import { createSlot } from "@/db/admin";

export const POST = withAuth(
  async (req, user) => {
    const b = await readJson(req);
    const slot = await createSlot(
      { courseId: String(b.courseId ?? ""), dayOfWeek: Number(b.dayOfWeek), startTime: String(b.startTime ?? ""), endTime: String(b.endTime ?? ""), room: String(b.room ?? "") },
      user.id
    );
    return NextResponse.json({ slot }, { status: 201 });
  },
  { roles: ["admin"] }
);

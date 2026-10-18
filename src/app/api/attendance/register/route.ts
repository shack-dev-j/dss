import { NextResponse } from "next/server";
import { assertTeachesSlot, badRequest, withAuth } from "@/lib/authz";
import { lessonEditability } from "@/lib/attendance-rules";
import { isValidDate } from "@/lib/dates";
import { db } from "@/db";

// The register for one lesson: every student of the class, with saved status or null (not recorded).
// The UI shows null as "present" so that a full class is one tap per exception.
export const GET = withAuth(
  async (req, user) => {
    const sp = new URL(req.url).searchParams;
    const slotId = sp.get("slotId") ?? "";
    const date = sp.get("date") ?? "";
    if (!slotId || !isValidDate(date)) throw badRequest("slotId and date (YYYY-MM-DD) are required");
    const { slot, ta } = await assertTeachesSlot(user, slotId);
    return NextResponse.json({
      slot: await db.getSlotById(slot.id),
      date,
      students: await db.getRegister(slotId, date, ta.classId),
      editability: await lessonEditability(user, slotId, date),
    });
  },
  { roles: ["teacher", "admin"] }
);

import { NextResponse } from "next/server";
import { badRequest, notFound, readJson, withAuth } from "@/lib/authz";
import { isValidDate, schoolDate } from "@/lib/dates";
import { db } from "@/db";

export const GET = withAuth(async () => NextResponse.json({ approvals: await db.listBackdateApprovals() }), { roles: ["admin"] });

// An admin lets teachers edit one specific old lesson (slot + date).
export const POST = withAuth(
  async (req, user) => {
    const b = await readJson(req);
    const slotId = String(b.slotId ?? "");
    const date = String(b.date ?? "");
    if (!slotId || !isValidDate(date) || date > schoolDate()) throw badRequest("slotId and a past date (YYYY-MM-DD) are required");
    if (!(await db.getSlotById(slotId))) throw notFound("Lesson slot not found");
    const approval = await db.createBackdateApproval(slotId, date, user.id, typeof b.reason === "string" ? b.reason : undefined);
    return NextResponse.json({ approval }, { status: 201 });
  },
  { roles: ["admin"] }
);

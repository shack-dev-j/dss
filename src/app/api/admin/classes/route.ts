import { NextResponse } from "next/server";
import { readJson, withAuth } from "@/lib/authz";
import { createClass, getClassesDetailed } from "@/db/admin";

export const GET = withAuth(async () => NextResponse.json({ classes: await getClassesDetailed() }), { roles: ["admin"] });

export const POST = withAuth(
  async (req, user) => {
    const b = await readJson(req);
    const created = await createClass(
      { gradeLevel: Number(b.gradeLevel), section: String(b.section ?? ""), classTeacherId: typeof b.classTeacherId === "string" ? b.classTeacherId : null },
      user.id
    );
    return NextResponse.json({ class: created }, { status: 201 });
  },
  { roles: ["admin"] }
);

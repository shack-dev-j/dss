import { NextResponse } from "next/server";
import { readJson, withAuth } from "@/lib/authz";
import { createSubject, getSubjects } from "@/db/admin";

// Everyone who is logged in may read the subject list (pickers); only admins change it.
export const GET = withAuth(async () => NextResponse.json({ subjects: await getSubjects() }));

export const POST = withAuth(
  async (req, user) => {
    const b = await readJson(req);
    const subject = await createSubject({ code: String(b.code ?? ""), nameUz: String(b.nameUz ?? ""), nameEn: String(b.nameEn ?? "") }, user.id);
    return NextResponse.json({ subject }, { status: 201 });
  },
  { roles: ["admin"] }
);

import { NextResponse } from "next/server";
import { readJson, withAuth } from "@/lib/authz";
import { updateSubject } from "@/db/admin";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withAuth<Ctx>(
  async (req, user, ctx) => {
    const b = await readJson(req);
    const subject = await updateSubject((await ctx.params).id, {
      nameUz: typeof b.nameUz === "string" ? b.nameUz : undefined,
      nameEn: typeof b.nameEn === "string" ? b.nameEn : undefined,
    }, user.id);
    return NextResponse.json({ subject });
  },
  { roles: ["admin"] }
);

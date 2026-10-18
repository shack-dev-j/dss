import { NextResponse } from "next/server";
import { generateTempPassword, hashPassword } from "@/lib/auth";
import { badRequest, readJson, withAuth } from "@/lib/authz";
import { createUser, getUsersDetailed, ROLES, Role } from "@/db/admin";

export const GET = withAuth(
  async () => NextResponse.json({ users: await getUsersDetailed() }),
  { roles: ["admin"] }
);

// Create an account. Without a password a one-time password is generated and returned once;
// either way the user must choose their own password at first login.
export const POST = withAuth(
  async (req, user) => {
    const b = await readJson(req);
    const role = ROLES.find((r) => r === b.role) as Role | undefined;
    if (!role) throw badRequest("role must be admin, teacher, student or parent");
    const given = typeof b.password === "string" && b.password ? b.password : null;
    if (given && given.length < 8) throw badRequest("password must be at least 8 characters");
    const password = given ?? generateTempPassword();
    const created = await createUser(
      {
        username: String(b.username ?? ""), fullName: String(b.fullName ?? ""), role,
        classId: typeof b.classId === "string" ? b.classId : null,
        passwordHash: await hashPassword(password, given ? 12 : 10), mustChangePassword: true,
      },
      user.id
    );
    return NextResponse.json(
      { user: { id: created.id, username: created.username, fullName: created.fullName, role: created.role }, ...(given ? {} : { temporaryPassword: password }) },
      { status: 201 }
    );
  },
  { roles: ["admin"] }
);

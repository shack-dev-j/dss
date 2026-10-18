import { forbidden, notFound, withAuth } from "@/lib/authz";
import { readUpload } from "@/lib/uploads";
import { db } from "@/db";

type Ctx = { params: Promise<{ id: string }> };

// Download: students of that class, the teacher who teaches it, or an admin.
export const GET = withAuth<Ctx>(async (_req, user, ctx) => {
  const hw = await db.getHomeworkById((await ctx.params).id);
  if (!hw || !hw.attachmentFile) throw notFound("Attachment not found");
  if (user.role === "student") {
    if (hw.classId !== user.classId) throw forbidden();
  } else if (user.role === "teacher") {
    if (hw.teacherId !== user.id) throw forbidden();
  } else if (user.role !== "admin") {
    throw forbidden();
  }
  const { bytes, contentType } = await readUpload(hw.attachmentFile);
  const name = (hw.attachmentName ?? "attachment").replace(/"/g, "");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${name}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
});

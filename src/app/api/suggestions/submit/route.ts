import { NextResponse } from "next/server";
import { badRequest, readJson, withAuth } from "@/lib/authz";
import { db } from "@/db";

const CATEGORIES = ["academic", "facilities", "catering", "events", "general"] as const;

// Requires a login (so the route is not open to the internet) but the user is
// deliberately NOT passed to the repository: nothing identifying is stored or logged.
export const POST = withAuth(
  async (req) => {
    const body = await readJson(req);
    const category = CATEGORIES.find((c) => c === body.category);
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!category || !title || !content) throw badRequest("Category, title, and content are required.");
    if (title.length < 3 || content.length < 10) {
      throw badRequest("Title must be at least 3 characters and content at least 10 characters.");
    }
    return NextResponse.json(await db.submitAnonymousSuggestion(category, title, content), { status: 201 });
  },
  { feature: "suggestions" }
);

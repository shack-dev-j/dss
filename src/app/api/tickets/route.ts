import { NextResponse } from "next/server";
import { badRequest, notFound, readJson, withAuth } from "@/lib/authz";
import { db } from "@/db";

const CATEGORIES = ["it", "facilities", "smartboard"] as const;
const PRIORITIES = ["high", "medium", "low"] as const;
const STATUSES = ["open", "in_progress", "resolved"] as const;

export const GET = withAuth(
  async (_req, user) => {
    const all = await db.getSupportTickets();
    // Non-admins only see tickets they reported.
    return NextResponse.json({ tickets: user.role === "admin" ? all : all.filter((t) => t.reporterId === user.id) });
  },
  { feature: "facilities" }
);

export const POST = withAuth(
  async (req, user) => {
    const body = await readJson(req);
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const category = CATEGORIES.find((c) => c === body.category);
    const priority = PRIORITIES.find((p) => p === body.priority) ?? "medium";
    if (!title || !description || !category) throw badRequest("title, description and a valid category are required");
    const ticket = await db.createSupportTicket({
      reporterId: user.id, reporterName: user.fullName, category, title, description, priority,
    });
    return NextResponse.json({ ticket }, { status: 201 });
  },
  { feature: "facilities" }
);

export const PATCH = withAuth(
  async (req) => {
    const body = await readJson(req);
    const status = STATUSES.find((s) => s === body.status);
    if (typeof body.id !== "string" || !status) throw badRequest("id and a valid status are required");
    try {
      return NextResponse.json({ ticket: await db.updateSupportTicketStatus(body.id, status) });
    } catch {
      throw notFound("Ticket not found");
    }
  },
  { feature: "facilities", roles: ["admin"] }
);

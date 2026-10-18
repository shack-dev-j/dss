import { NextResponse } from "next/server";
import { generateTempPassword, hashPassword } from "@/lib/auth";
import { badRequest, readJson, withAuth } from "@/lib/authz";
import { parseCsv, toCsv } from "@/lib/csv";
import { className, ImportRow, importStudents, validateStudentImport } from "@/db/admin";

const MAX_ROWS = 600;

// Class-list import. Columns (header row required): fullName, username, gradeLevel, section, [password].
// isDryRun=true validates and previews; otherwise it imports everything or nothing and returns the
// one-time passwords (shown once; every imported student must change theirs at first login).
export const POST = withAuth(
  async (req, user) => {
    const b = await readJson(req);
    const csvContent = typeof b.csvContent === "string" ? b.csvContent : "";
    if (b.entityType !== "students") throw badRequest('Only entityType "students" can be imported');
    const table = parseCsv(csvContent);
    if (table.length < 2) throw badRequest("The file needs a header row and at least one student");
    if (table.length - 1 > MAX_ROWS) throw badRequest(`At most ${MAX_ROWS} students per file`);

    const headers = table[0].map((h) => h.toLowerCase().replace(/[\s_]/g, ""));
    const col = (name: string) => headers.indexOf(name);
    const missing = ["fullname", "username", "gradelevel", "section"].filter((h) => col(h) < 0);
    if (missing.length) throw badRequest(`Missing columns: ${missing.join(", ")}`);

    const rows: ImportRow[] = table.slice(1).map((r) => ({
      fullName: r[col("fullname")] ?? "",
      username: (r[col("username")] ?? "").toLowerCase(),
      gradeLevel: Number(r[col("gradelevel")]),
      section: r[col("section")] ?? "",
      password: col("password") >= 0 ? r[col("password")] : undefined,
    }));

    const errors = await validateStudentImport(rows);
    if (errors.length) {
      return NextResponse.json({ success: false, totalRows: rows.length, errors: errors.slice(0, 50), moreErrors: Math.max(0, errors.length - 50) }, { status: 422 });
    }
    if (b.isDryRun) {
      return NextResponse.json({
        success: true, isDryRun: true, totalRows: rows.length,
        classes: [...new Set(rows.map((r) => className(r.gradeLevel, r.section)))].sort(),
        preview: rows.slice(0, 5).map(({ password, ...r }) => { void password; return r; }),
      });
    }

    const hashes = new Map<string, string>();
    const credentials: string[][] = [["fullName", "username", "class", "temporaryPassword"]];
    for (const r of rows) {
      const password = r.password || generateTempPassword();
      hashes.set(r.username, await hashPassword(password, r.password ? 12 : 10));
      credentials.push([r.fullName, r.username, className(r.gradeLevel, r.section), r.password ? "(set in file)" : password]);
    }
    const result = await importStudents(rows, hashes, user.id);
    return NextResponse.json({ success: true, isDryRun: false, ...result, credentialsCsv: toCsv(credentials) });
  },
  { roles: ["admin"] }
);

import path from "path";
import PDFDocument from "pdfkit";
import { GradingScale } from "@/lib/grading";
import { Lang, LABELS, Transcript } from "@/lib/transcript";

// Noto Sans (SIL OFL) is bundled so Uzbek letters (o', g' with the modifier apostrophe) and Cyrillic render.
const FONT_DIR = path.join(process.cwd(), "assets", "fonts");

export interface PdfInput {
  lang: Lang;
  student: { fullName: string; className: string; yearName: string };
  /** null = full year */
  periodName: string | null;
  transcript: Transcript;
  scale: GradingScale;
  issuedOn: string;
}

/**
 * Generic A4 layout. When the school supplies its paper sample, only this file (header, columns,
 * signature block) needs to change; all numbers come from buildTranscript().
 */
export function renderTranscriptPdf(input: PdfInput): Promise<Buffer> {
  const L = LABELS[input.lang];
  const { transcript: tr, student } = input;
  const doc = new PDFDocument({ size: "A4", margin: 50, info: { Title: `${L.title} - ${student.fullName}`, Author: L.school }, compress: process.env.PDF_COMPRESS !== "false" });
  doc.registerFont("regular", path.join(FONT_DIR, "NotoSans-Regular.ttf"));
  doc.registerFont("bold", path.join(FONT_DIR, "NotoSans-Bold.ttf"));

  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const oneTerm = input.periodName !== null;

    doc.font("bold").fontSize(16).text(L.school, { align: "center" });
    doc.font("regular").fontSize(13).text(L.title, { align: "center" }).moveDown(1);

    doc.fontSize(10);
    const info: [string, string][] = [
      [L.student, student.fullName], [L.class, student.className], [L.year, student.yearName], [L.period, input.periodName ?? L.fullYear],
    ];
    for (const [k, v] of info) {
      doc.font("regular").fillColor("#555").text(`${k}: `, { continued: true }).font("bold").fillColor("#000").text(v);
    }
    doc.moveDown(1);

    // Columns: subject | teacher | [one avg column per term when showing the full year] | average | grade
    const showTermCols = !oneTerm && tr.terms.length > 1;
    const gradeW = 42, avgW = 58;
    const termW = showTermCols ? Math.min(54, 140 / tr.terms.length) : 0;
    const rest = width - gradeW - avgW - termW * (showTermCols ? tr.terms.length : 0);
    const subjW = rest * 0.55, teachW = rest * 0.45;
    const cols: { x: number; w: number; title: string; align: "left" | "right" | "center" }[] = [];
    let x = left;
    const add = (w: number, title: string, align: "left" | "right" | "center") => { cols.push({ x, w, title, align }); x += w; };
    add(subjW, L.subject, "left");
    add(teachW, L.teacher, "left");
    if (showTermCols) tr.terms.forEach((t) => add(termW, `${t.name}`, "center"));
    add(avgW, oneTerm ? L.termAvg : L.yearAvg, "center");
    add(gradeW, L.grade, "center");

    const rowH = 22;
    const header = (y: number) => {
      doc.rect(left, y, width, rowH).fill("#eef2f7");
      doc.fillColor("#000").font("bold").fontSize(8.5);
      cols.forEach((c) => doc.text(c.title, c.x + 4, y + 6, { width: c.w - 8, align: c.align, lineBreak: false, ellipsis: true }));
      return y + rowH;
    };
    const gradeText = (g: number | null) => (g === null ? "–" : String(g));

    let y = header(doc.y);
    if (!tr.subjects.length) {
      doc.font("regular").fontSize(10).fillColor("#555").text(L.noMarks, left, y + 8);
      y = doc.y + 8;
    }
    tr.subjects.forEach((s, i) => {
      if (y + rowH > doc.page.height - 150) { doc.addPage(); y = header(doc.page.margins.top); }
      if (i % 2) doc.rect(left, y, width, rowH).fill("#f8fafc");
      doc.fillColor("#000").font("regular").fontSize(9);
      let ci = 0;
      const cell = (text: string, bold = false) => {
        const c = cols[ci++];
        doc.font(bold ? "bold" : "regular").text(text, c.x + 4, y + 6, { width: c.w - 8, align: c.align, lineBreak: false, ellipsis: true });
      };
      cell(s.subjectName);
      cell(s.teacherName);
      if (showTermCols) tr.terms.forEach((t) => cell(s.terms[t.id] ? `${s.terms[t.id]!.average}%` : "–"));
      cell(`${s.periodAverage}%`);
      cell(gradeText(s.periodGrade), true);
      y += rowH;
    });

    if (tr.subjects.length) {
      doc.moveTo(left, y).lineTo(left + width, y).strokeColor("#999").stroke();
      doc.font("bold").fontSize(9.5).fillColor("#000");
      const first = cols[0];
      doc.text(L.overall, first.x + 4, y + 6, { lineBreak: false });
      let ci = 2;
      if (showTermCols) tr.terms.forEach((t) => { const c = cols[ci++]; doc.text(tr.overall.terms[t.id] !== undefined ? `${tr.overall.terms[t.id]}%` : "–", c.x + 4, y + 6, { width: c.w - 8, align: "center", lineBreak: false }); });
      const avgC = cols[ci++], gradeC = cols[ci++];
      doc.text(tr.overall.period !== null ? `${tr.overall.period}%` : "–", avgC.x + 4, y + 6, { width: avgC.w - 8, align: "center", lineBreak: false });
      doc.text(gradeText(tr.overall.grade), gradeC.x + 4, y + 6, { width: gradeC.w - 8, align: "center", lineBreak: false });
      y += rowH + 6;
    }

    // Footer: scale, note, issue date, signature lines.
    if (y > doc.page.height - 160) { doc.addPage(); y = doc.page.margins.top; }
    doc.font("regular").fontSize(8).fillColor("#555");
    const scaleText = input.scale.mode === "percent"
      ? L.scalePct
      : L.scale5.replace("{five}", String(input.scale.thresholds.five)).replace("{four}", String(input.scale.thresholds.four)).replace("{three}", String(input.scale.thresholds.three));
    doc.text(scaleText, left, y + 8, { width });
    doc.text(L.note, left, doc.y + 2, { width });
    doc.text(`${L.generated}: ${input.issuedOn}`, left, doc.y + 6, { width });

    const sigY = Math.max(doc.y + 40, doc.page.height - 130);
    doc.fillColor("#000").fontSize(9);
    [[left, L.director], [left + width / 2 - 55, L.classTeacher], [left + width - 110, L.stamp]].forEach(([sx, label]) => {
      doc.moveTo(sx as number, sigY).lineTo((sx as number) + 110, sigY).strokeColor("#000").stroke();
      doc.text(label as string, sx as number, sigY + 3, { width: 110, align: "center" });
    });
    doc.end();
  });
}

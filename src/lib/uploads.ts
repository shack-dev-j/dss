import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { HttpError } from "@/lib/authz";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

// extension -> content type served on download. Anything else is rejected.
const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  txt: "text/plain; charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
export const ALLOWED_EXTENSIONS = Object.keys(TYPES);

export function uploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), ".data", "uploads"));
}

function extensionOf(name: string): string {
  return name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
}

/** Does the content really look like the type its extension claims? */
function matchesMagic(ext: string, b: Buffer): boolean {
  const starts = (...bytes: number[]) => bytes.every((v, i) => b[i] === v);
  switch (ext) {
    case "pdf": return starts(0x25, 0x50, 0x44, 0x46, 0x2d);
    case "png": return starts(0x89, 0x50, 0x4e, 0x47);
    case "jpg":
    case "jpeg": return starts(0xff, 0xd8, 0xff);
    case "docx":
    case "xlsx":
    case "pptx": return starts(0x50, 0x4b, 0x03, 0x04);
    case "txt": return !b.includes(0);
    default: return false;
  }
}

function safeDisplayName(name: string): string {
  return name.replace(/[^\w.\- ]+/g, "_").slice(-120) || "file";
}

export async function saveUpload(file: File): Promise<{ stored: string; displayName: string }> {
  if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(413, "File is larger than 5 MB");
  const ext = extensionOf(file.name);
  if (!TYPES[ext]) throw new HttpError(400, `File type not allowed (allowed: ${ALLOWED_EXTENSIONS.join(", ")})`);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES || !matchesMagic(ext, bytes)) {
    throw new HttpError(400, "File content does not match its type");
  }
  await fs.mkdir(uploadDir(), { recursive: true });
  const stored = `${crypto.randomUUID()}.${ext}`;
  await fs.writeFile(path.join(uploadDir(), stored), bytes, { flag: "wx" });
  return { stored, displayName: safeDisplayName(file.name) };
}

/** Only ever resolves names we generated (uuid.ext), so a stored value can't escape UPLOAD_DIR. */
function resolveStored(stored: string): string {
  if (!/^[0-9a-f-]{36}\.[a-z0-9]{2,5}$/.test(stored)) throw new HttpError(404, "File not found");
  return path.join(uploadDir(), stored);
}

export async function readUpload(stored: string): Promise<{ bytes: Buffer; contentType: string }> {
  try {
    return { bytes: await fs.readFile(resolveStored(stored)), contentType: TYPES[extensionOf(stored)] ?? "application/octet-stream" };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(404, "File not found");
  }
}

export async function deleteUpload(stored: string | null | undefined): Promise<void> {
  if (!stored) return;
  await fs.rm(resolveStored(stored), { force: true });
}

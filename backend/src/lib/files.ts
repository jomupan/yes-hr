import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { Response } from "express";
import { config } from "../config";
import { db } from "../db/knex";
import { nowISO } from "./time";
import { badRequest, notFound } from "./errors";

/* File storage. Files get a random server-generated name; the user's
   original file name is only kept as metadata and is never used as a path.
   Same rules as the frontend: PDF / JPG / JPEG / PNG only, max 5 MB,
   executables rejected.

   Two places a file can live (config.fileStorage):
     - "disk": under UPLOAD_DIR, path like "selfies/<uuid>.jpg"
     - "db":   in the stored_files table, path like "db:<uuid>.jpg"
   Reading always works for both, so switching modes never breaks old records. */

const DB_PREFIX = "db:";

const ALLOWED: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
};
const ALLOWED_EXT = [".pdf", ".jpg", ".jpeg", ".png"];
const TYPE_ERROR = "Only PDF, JPG, JPEG and PNG files are allowed.";

/** Check the real file signature so a renamed .exe can't sneak through. */
function sniff(buf: Buffer): string | null {
  if (buf.length >= 4 && buf.subarray(0, 4).toString("latin1") === "%PDF") return "application/pdf";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  return null;
}

export function sanitizeFileName(name: string): string {
  const base = (name || "document").split(/[\\/]/).pop() || "document";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "document";
}

export interface StoredFile {
  name: string;
  type: string;
  size: number;
  path: string; // relative to UPLOAD_DIR
}

export function validateUpload(file: { originalname: string; mimetype: string; size: number; buffer: Buffer }): void {
  if (file.size > config.maxUploadBytes) throw badRequest("File size must not exceed 5 MB.", "FILE_TOO_LARGE");
  const lower = (file.originalname || "").toLowerCase();
  if (/\.(exe|bat|cmd|sh|msi|dll|scr|com|js|jar)$/i.test(lower)) throw badRequest(TYPE_ERROR, "FILE_TYPE");
  if (!ALLOWED_EXT.some((e) => lower.endsWith(e))) throw badRequest(TYPE_ERROR, "FILE_TYPE");
  if (!ALLOWED[file.mimetype]) throw badRequest(TYPE_ERROR, "FILE_TYPE");
  const real = sniff(file.buffer);
  if (!real) throw badRequest(TYPE_ERROR, "FILE_TYPE");
}

async function writeBuffer(folder: string, buf: Buffer, mime: string): Promise<string> {
  const ext = ALLOWED[mime] || ".bin";
  const name = `${crypto.randomUUID()}${ext}`;
  if (config.fileStorage === "db") {
    await db("stored_files").insert({ id: name, mime, size: buf.length, data: buf, created_at: nowISO() });
    return `${DB_PREFIX}${name}`;
  }
  const dir = path.join(config.uploadDir, folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), buf);
  return path.posix.join(folder, name);
}

/** Validate + store a multer upload (memory storage). */
export async function storeUpload(
  folder: string,
  file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
): Promise<StoredFile> {
  validateUpload(file);
  const real = sniff(file.buffer)!;
  return {
    name: sanitizeFileName(file.originalname),
    type: real,
    size: file.size,
    path: await writeBuffer(folder, file.buffer, real),
  };
}

/** Store a camera selfie sent as a base64 data URL (JPEG/PNG only). */
export async function storeDataUrlImage(folder: string, dataUrl: string): Promise<string> {
  const m = /^data:(image\/(?:jpeg|jpg|png));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl || "");
  if (!m) throw badRequest("Selfie must be a JPEG or PNG image.", "SELFIE_INVALID");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length === 0) throw badRequest("Selfie image is empty.", "SELFIE_INVALID");
  if (buf.length > config.maxUploadBytes) throw badRequest("Selfie image is too large.", "SELFIE_INVALID");
  const real = sniff(buf);
  if (!real || real === "application/pdf") throw badRequest("Selfie must be a JPEG or PNG image.", "SELFIE_INVALID");
  return await writeBuffer(folder, buf, real);
}

function absolute(rel: string): string {
  const abs = path.resolve(config.uploadDir, rel);
  // Never serve anything outside the upload directory.
  if (!abs.startsWith(config.uploadDir + path.sep)) throw notFound("File not found.");
  return abs;
}

export async function deleteStored(rel: string | null | undefined): Promise<void> {
  if (!rel) return;
  try {
    if (rel.startsWith(DB_PREFIX)) await db("stored_files").where({ id: rel.slice(DB_PREFIX.length) }).del();
    else fs.unlinkSync(absolute(rel));
  } catch {
    /* already gone */
  }
}

/** Stream a stored file to the client. `inline` shows it in the browser. */
export async function sendStored(res: Response, rel: string, downloadName: string, mime: string, inline = false): Promise<void> {
  const headers = () => {
    res.setHeader("Content-Type", mime);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader(
      "Content-Disposition",
      `${inline ? "inline" : "attachment"}; filename="${sanitizeFileName(downloadName)}"`,
    );
  };
  if (rel.startsWith(DB_PREFIX)) {
    const row = await db("stored_files").where({ id: rel.slice(DB_PREFIX.length) }).first();
    if (!row) throw notFound("File not found.");
    headers();
    res.end(Buffer.from(row.data));
    return;
  }
  const abs = absolute(rel);
  if (!fs.existsSync(abs)) throw notFound("File not found.");
  headers();
  fs.createReadStream(abs).pipe(res);
}

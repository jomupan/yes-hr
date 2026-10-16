import type { LeaveAttachment } from "./hr-types";

/* ---------- leave attachment validation ----------
   Frontend validation mirrors the rules a backend would enforce:
   allow-listed MIME types, max 5 MB, no executables. The original file
   name is sanitised and never used as a storage path. */
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ATTACHMENT_ALLOWED = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];
const ATTACHMENT_ALLOWED_EXT = [".pdf", ".jpg", ".jpeg", ".png"];

export interface AttachmentValidation {
  ok: boolean;
  error?: string;
}

/** Validate a File before it is read/stored. */
export function validateAttachment(file: File): AttachmentValidation {
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return { ok: false, error: "File size must not exceed 5 MB." };
  }
  const name = (file.name || "").toLowerCase();
  const extOk = ATTACHMENT_ALLOWED_EXT.some((ext) => name.endsWith(ext));
  // Reject anything that looks like an executable regardless of extension.
  if (/\.(exe|bat|cmd|sh|msi|dll|scr|com|js|jar)$/i.test(name)) {
    return {
      ok: false,
      error: "Only PDF, JPG, JPEG and PNG files are allowed.",
    };
  }
  const typeOk = ATTACHMENT_ALLOWED.includes(file.type);
  if (!extOk || !typeOk) {
    return {
      ok: false,
      error: "Only PDF, JPG, JPEG and PNG files are allowed.",
    };
  }
  return { ok: true };
}

/** Sanitise a file name: strip path, drop dangerous chars, keep the extension. */
export function sanitizeFileName(name: string): string {
  const base = (name || "document").split(/[\\/]/).pop() || "document";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.slice(0, 80) || "document";
}

/** Read a File into a base64 data URL (used by the frontend store). */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

/** Build a LeaveAttachment from a validated File. */
export async function buildAttachment(
  file: File,
): Promise<LeaveAttachment | null> {
  const v = validateAttachment(file);
  if (!v.ok) return null;
  const dataUrl = await readFileAsDataUrl(file);
  return {
    name: sanitizeFileName(file.name),
    type: file.type,
    size: file.size,
    dataUrl,
  };
}

/** Trigger a browser download of an attachment's stored data. */
export function downloadAttachment(att: LeaveAttachment): void {
  const a = document.createElement("a");
  a.href = att.dataUrl;
  a.download = att.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Human-readable file size. */
export function formatFileSize(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

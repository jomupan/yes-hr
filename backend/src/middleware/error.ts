import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { HttpError } from "../lib/errors";
import { config } from "../config";

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ ok: false, error: `Route ${req.method} ${req.path} not found.`, code: "NOT_FOUND" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ ok: false, error: err.message, code: err.code });
    return;
  }
  if (err instanceof multer.MulterError) {
    const msg = err.code === "LIMIT_FILE_SIZE" ? "File size must not exceed 5 MB." : err.message;
    res.status(400).json({ ok: false, error: msg, code: "UPLOAD" });
    return;
  }
  if (err instanceof SyntaxError && "body" in (err as object)) {
    res.status(400).json({ ok: false, error: "Malformed JSON body.", code: "BAD_JSON" });
    return;
  }
  // Unique constraint races (e.g. two registrations at once).
  const msg = String((err as Error)?.message || "");
  if (/UNIQUE constraint|Duplicate entry|duplicate key/i.test(msg)) {
    res.status(409).json({ ok: false, error: "That record already exists.", code: "CONFLICT" });
    return;
  }
  if (!config.isTest) console.error(err);
  res.status(500).json({ ok: false, error: "Something went wrong on the server.", code: "SERVER_ERROR" });
}

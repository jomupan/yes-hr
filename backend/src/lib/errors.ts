import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, ZodSchema } from "zod";

/** Throw this anywhere in a route to send a clean JSON error. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, code?: string) => new HttpError(400, msg, code);
export const unauthorized = (msg = "Authentication required.", code?: string) => new HttpError(401, msg, code);
export const forbidden = (msg = "You do not have permission to do that.", code?: string) =>
  new HttpError(403, msg, code);
export const notFound = (msg = "Not found.") => new HttpError(404, msg, "NOT_FOUND");
export const conflict = (msg: string) => new HttpError(409, msg, "CONFLICT");

/** Wrap async route handlers so thrown errors reach the error middleware. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

/** Parse + validate with zod; throws a 400 with the first readable message. */
export function parse<T>(schema: ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (e) {
    if (e instanceof ZodError) {
      const first = e.issues[0];
      const field = first?.path.join(".");
      throw new HttpError(400, first ? `${field ? field + ": " : ""}${first.message}` : "Invalid input.", "VALIDATION");
    }
    throw e;
  }
}

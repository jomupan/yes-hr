import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { db } from "../db/knex";
import { forbidden, unauthorized } from "../lib/errors";
import type { UserRow } from "../services/users";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserRow;
    }
  }
}

const FILE_ROUTE = /\/(file|attachment|selfie\/(in|out))$/;

interface TokenPayload {
  sub: string; // user id
  role: string;
}

export function signToken(user: UserRow): string {
  return jwt.sign({ sub: user.id, role: user.auth_role } satisfies TokenPayload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

/** Require a valid bearer token. The user is re-loaded from the database on
 *  every request, so a deactivated account or a demoted admin loses access
 *  immediately instead of when the token expires. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization || "";
    let token = header.startsWith("Bearer ") ? header.slice(7) : "";
    // <img src> and download links can't send headers, so file GETs may
    // pass the token as ?token=… instead. Limited to file endpoints.
    if (!token && req.method === "GET" && FILE_ROUTE.test(req.originalUrl.split("?")[0]) && typeof req.query.token === "string") {
      token = req.query.token;
    }
    if (!token) throw unauthorized();
    let payload: TokenPayload;
    try {
      payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
    } catch {
      throw unauthorized("Your session has expired. Please log in again.", "TOKEN_INVALID");
    }
    const user = await db<UserRow>("users").where({ id: payload.sub }).first();
    if (!user) throw unauthorized("Your session has expired. Please log in again.", "TOKEN_INVALID");
    if (user.account_status === "inactive") {
      throw forbidden("This account is no longer active. Please contact HR for assistance.", "ACCOUNT_INACTIVE");
    }
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(unauthorized());
  if (req.user.auth_role !== "admin") return next(forbidden("Admin access required.", "ADMIN_ONLY"));
  next();
}

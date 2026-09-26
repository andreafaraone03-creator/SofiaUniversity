import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { sqlite } from "./sofia-db";

const secret = process.env.SESSION_SECRET;
if (!secret || secret.length < 24) {
  throw new Error("SESSION_SECRET must be configured with at least 24 characters.");
}

const cookieName = "sofia_admin_session";
const sessionLifetime = 8 * 60 * 60 * 1000;

export function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

export function newPasswordSalt(): string {
  return randomBytes(24).toString("hex");
}

function signature(payload: string): string {
  return createHmac("sha256", secret!).update(payload).digest("base64url");
}

export function setAdminSession(req: Request, res: Response): void {
  const payload = Buffer.from(JSON.stringify({ id: 1, exp: Date.now() + sessionLifetime }))
    .toString("base64url");
  res.cookie(cookieName, `${payload}.${signature(payload)}`, {
    httpOnly: true,
    secure: req.secure,
    sameSite: "strict",
    maxAge: sessionLifetime,
    path: "/api",
  });
}

export function clearAdminSession(res: Response): void {
  res.clearCookie(cookieName, { path: "/api", sameSite: "strict" });
}

export function isAdminAuthenticated(req: Request): boolean {
  const token = req.cookies?.[cookieName];
  if (typeof token !== "string") return false;
  const [payload, sentSignature, extra] = token.split(".");
  if (!payload || !sentSignature || extra) return false;
  const expected = Buffer.from(signature(payload));
  const sent = Buffer.from(sentSignature);
  if (sent.length !== expected.length || !timingSafeEqual(sent, expected)) return false;
  try {
    const data: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data || typeof data !== "object" || !("id" in data) || !("exp" in data) ||
      data.id !== 1 || typeof data.exp !== "number" || data.exp <= Date.now()) {
      return false;
    }
    return Boolean(sqlite.prepare("SELECT id FROM utenti_admin WHERE id = 1").get());
  } catch {
    return false;
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!isAdminAuthenticated(req)) {
    res.status(401).json({ error: "Accedi per vedere l'area riservata." });
    return;
  }
  next();
}
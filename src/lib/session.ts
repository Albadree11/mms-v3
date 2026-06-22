// src/lib/session.ts — [FIX 5]
// Signed JWT session stored in an httpOnly cookie.

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "mms_session";
const MAX_AGE = 60 * 60 * 12; // 12 hours
const ALG = "HS256";

export interface SessionData {
  userId: number;
  officeId: string | null;
  perms: Record<string, string>;
}

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set and at least 32 characters long."
    );
  }
  return new TextEncoder().encode(secret);
}

/** Create a signed session token and store it in the httpOnly cookie. */
export async function createSession(data: SessionData): Promise<void> {
  const token = await new SignJWT({ ...data })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getSecret());

  const isProd = process.env.NODE_ENV === "production";
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: [ALG],
    });
    const data = payload as unknown as SessionData;
    if (
      typeof data.userId !== "number" ||
      (data.officeId !== null && typeof data.officeId !== "string") ||
      typeof data.perms !== "object" ||
      data.perms === null
    ) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/** Destroy the session cookie (logout). */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

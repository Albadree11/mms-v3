// src/lib/password.ts — [FIX 4]
// bcrypt password hashing with 12 rounds + safe migration from plaintext

import bcrypt from "bcryptjs";

const ROUNDS = 12;

/** Hash a plaintext password using bcrypt. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  if (hash.startsWith("$2")) {
    try {
      return await bcrypt.compare(plain, hash);
    } catch {
      return false;
    }
  }
  // legacy plaintext fallback
  return plain === hash;
}

/** True when stored value is plaintext and must be re-hashed. */
export function needsRehash(hash: string): boolean {
  return !hash.startsWith("$2");
}

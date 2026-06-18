// src/lib/password.ts — [FIX 4]
// bcrypt password hashing with 12 rounds + safe migration from plaintext

import bcrypt from "bcryptjs";

const ROUNDS = 12;

/** Hash a plaintext password using bcrypt. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

/**
 * Verify a password against a stored hash.
 * Constant-time comparison when stored value is bcrypt.
 * Supports legacy plaintext: if the stored value is not a bcrypt hash,
 * do one direct comparison (so old logins still work) and let the caller
 * decide whether to rehash via needsRehash().
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  // bcrypt hashes start with $2
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

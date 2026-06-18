// src/lib/firebase-admin.ts
// Firebase Admin SDK — server-side only (API routes).
// Never import this from client components.

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
// ملاحظة: Firebase Storage غير متاح في خطة Spark المجانية.
// الملفات تُخزَّن محلياً في public/uploads/ — راجع src/app/api/files/route.ts

function initAdmin(): App {
  if (getApps().length > 0) return getApps()[0];

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin: يجب ضبط FIREBASE_PROJECT_ID و FIREBASE_CLIENT_EMAIL و FIREBASE_PRIVATE_KEY في ملف .env.local"
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

const app = initAdmin();

/** Firestore instance — use instead of Prisma db */
export const db = getFirestore(app);

export { Timestamp };

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Convert a Firestore document snapshot to a plain JS object.
 * Timestamps are converted to ISO strings automatically.
 */
export function docToObj<T = Record<string, unknown>>(
  snap: FirebaseFirestore.DocumentSnapshot
): (T & { id: string }) | null {
  if (!snap.exists) return null;
  return serializeTimestamps({ id: snap.id, ...snap.data() }) as T & { id: string };
}

/** Convert all Firestore Timestamps in an object to ISO strings (recursive). */
export function serializeTimestamps(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Timestamp) return obj.toDate().toISOString();
  if (Array.isArray(obj)) return obj.map(serializeTimestamps);
  if (typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = serializeTimestamps(v);
    }
    return out;
  }
  return obj;
}

/**
 * Run a Firestore collection query and return plain objects.
 * Applies an optional officeId filter then orders by createdAt desc.
 */
export async function queryCol<T = Record<string, unknown>>(
  collectionPath: string,
  officeFilter: string | null,
  extraConstraints?: (
    ref: FirebaseFirestore.CollectionReference
  ) => FirebaseFirestore.Query
): Promise<(T & { id: string })[]> {
  let ref: FirebaseFirestore.Query = db.collection(collectionPath);
  if (officeFilter) ref = ref.where("officeId", "==", officeFilter);
  if (extraConstraints) ref = extraConstraints(db.collection(collectionPath));
  if (officeFilter && extraConstraints) {
    // combine: filter first, then extra
    ref = extraConstraints(
      db.collection(collectionPath).where("officeId", "==", officeFilter) as unknown as FirebaseFirestore.CollectionReference
    );
  }
  ref = ref.orderBy("createdAt", "desc");
  const snap = await ref.get();
  return snap.docs.map((d) => serializeTimestamps({ id: d.id, ...d.data() }) as T & { id: string });
}

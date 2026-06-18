// src/app/api/offices/route.ts
import { NextRequest } from "next/server";
import { db, Timestamp, serializeTimestamps } from "@/lib/firebase-admin";
import { officeSchema } from "@/lib/enums";
import { requirePermission, handleError, readJson } from "@/lib/guard";

export async function GET() {
  try {
    // Any authenticated user can list offices (needed for filters / selectors)
    await requirePermission("devices", "view");

    const snap = await db.collection("offices").orderBy("createdAt", "asc").get();

    // Count related records per office in parallel
    const offices = await Promise.all(
      snap.docs.map(async (doc) => {
        const id = doc.id;
        const [devSnap, userSnap, hospSnap] = await Promise.all([
          db.collection("devices").where("officeId", "==", id).count().get(),
          db.collection("users").where("officeId", "==", id).count().get(),
          db.collection("hospitals").where("officeId", "==", id).count().get(),
        ]);
        return serializeTimestamps({
          id,
          ...doc.data(),
          _count: {
            devices:   devSnap.data().count,
            users:     userSnap.data().count,
            hospitals: hospSnap.data().count,
          },
        });
      })
    );

    return Response.json({ offices });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Only super admin can create offices
    const { 
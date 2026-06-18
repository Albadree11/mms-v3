// src/app/api/hospitals/route.ts
import { NextRequest } from "next/server";
import { db, Timestamp, serializeTimestamps } from "@/lib/firebase-admin";
import { hospitalSchema } from "@/lib/enums";
import {
  requirePermission, getOfficeFilter, enforceOfficeOnWrite,
  handleError, readJson, readOfficeParam,
} from "@/lib/guard";

export async function GET(req: NextRequest) {
  try {
    const { session } = await requirePermission("devices", "view");
    const officeFilter = getOfficeFilter(session, readOfficeParam(req));

    let q: FirebaseFirestore.Query = db.collection("hospitals");
    if (officeFilter) q = q.where("officeId", "==", officeFilter);
    q = q.orderBy("createdAt", "desc");
    const snap = await q.get();

    // Count devices per hospital
    const hospitals = await Promise.all(
      snap.docs.map(async (doc) => {
        const devSnap = await db.collection("devices")
          .where("hospitalId", "==", doc.id).count().get();
        return serializeTimestamps({
          id: doc.id, ...doc.data(),
          _count: { devices: devSnap.data().count },
        });
      })
    );

    return Response.json({ hospitals });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requirePermission("devices", "edit");
    const body = await readJson(req) as any;
    const parsed = hospitalSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
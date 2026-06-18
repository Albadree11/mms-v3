// src/app/api/maintenance/route.ts
import { NextRequest } from "next/server";
import { db, Timestamp, serializeTimestamps } from "@/lib/firebase-admin";
import { maintenanceSchema } from "@/lib/enums";
import {
  requirePermission, getOfficeFilter, enforceOfficeOnWrite,
  handleError, readJson, GuardError,
} from "@/lib/guard";

export async function GET(req: NextRequest) {
  try {
    const { session } = await requirePermission("maintenance", "view");
    const url = new URL(req.url);
    const officeFilter = getOfficeFilter(session, url.searchParams.get("office"));
    const deviceId = url.searchParams.get("deviceId");

    let q: FirebaseFirestore.Query = db.collection("maintenance");
    if (officeFilter) q = q.where("officeId", "==", officeFilter);
    if (deviceId)     q = q.where("deviceId", "==", deviceId);
    q = q.orderBy("createdAt", "desc");
    const snap = await q.get();

    const records = await Promise.all(
      snap.docs.map(async (doc) => {
        const d = doc.data();
        let device = null;
        if (d.deviceId) {
          const dev = await db.doc(`devices/${d.deviceId}`).get();
          if (dev.exists) {
            const dd = dev.data()!;
            device = { id: dev.id, name: dd.name, serial: dd.serial };
          }
        }
        return serializeTimestamps({ id: doc.id, ...d, device });
      })
    );

    return Response.json({ records });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requirePermission("maintenance", "edit");
    const body = await readJson(req) as any;
    const parsed = maintenanceSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const officeId = enforceOfficeOnWrite(session, body?.officeId);

    // Verify de
// src/app/api/devices/route.ts
import { NextRequest } from "next/server";
import { db, Timestamp, serializeTimestamps } from "@/lib/firebase-admin";
import { deviceSchema } from "@/lib/enums";
import {
  requirePermission, getOfficeFilter, enforceOfficeOnWrite,
  handleError, readJson, readOfficeParam, GuardError,
} from "@/lib/guard";
import { computeWarranty } from "@/lib/warranty";

export async function GET(req: NextRequest) {
  try {
    const { session } = await requirePermission("devices", "view");
    const url = new URL(req.url);
    const officeFilter = getOfficeFilter(session, readOfficeParam(req));
    const statusFilter = url.searchParams.get("status");
    const locationFilter = url.searchParams.get("location");

    let q: FirebaseFirestore.Query = db.collection("devices");
    if (officeFilter) q = q.where("officeId", "==", officeFilter);
    if (statusFilter) q = q.where("status", "==", statusFilter);
    if (locationFilter) q = q.where("location", "==", locationFilter);
    const snap = await q.get();

    const hospitalIds = [...new Set(
      snap.docs.map(d => d.data().hospitalId).filter(Boolean)
    )] as string[];

    const hospitalMap: Record<string, string> = {};
    if (hospitalIds.length > 0) {
      await Promise.all(
        hospitalIds.map(async (hid) => {
          const h = await db.doc(`hospitals/${hid}`).get();
          if (h.exists) hospitalMap[hid] = h.data()!.name;
        })
      );
    }

    const devices = snap.docs.map((doc) => {
      const d = serializeTimestamps({ id: doc.id, ...doc.data() }) as any;
      const hid = d.hospitalId;
      d.hospital = hid ? { id: hid, name: hospitalMap[hid] ?? "" } : null;
      d.warranty = computeWarranty(d.installDate ?? "", d.warrantyMonths ?? 0);
      return d;
    }).sort((a: any, b: any) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));

    return Response.json({ devices });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requirePermission("devices", "edit");
    const body = await readJson(req) as any;
    const parsed = deviceSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const officeId = enforceOfficeOnWrite(session, body?.officeId);

    const dup = await db.collection("devices")
      .where("serial", "==", parsed.data.serial)
      .where("officeId", "==", officeId)
      .limit(1).get();
    if (!dup.empty) {
      return Response.json({ error: "الرقم التسلسلي مستخدم مسبقاً في هذا المكتب" }, { status: 409 });
    }

    const now = Timestamp.now();
    const ref = await db.collection("devices").add({
      ...parsed.data,
      officeId,
      createdAt: now,
      updatedAt: now,
    });

    return Response.json(
      { device: serializeTimestamps({ id: ref.id, ...parsed.data, officeId }) },
      { status: 201 }
    );
  } catch (err) {
    return handleError(err);
  }
}

// src/app/api/projects/route.ts
import { NextRequest } from "next/server";
import { db, Timestamp, serializeTimestamps } from "@/lib/firebase-admin";
import { projectSchema } from "@/lib/enums";
import {
  requirePermission, getOfficeFilter, enforceOfficeOnWrite,
  handleError, readJson,
} from "@/lib/guard";

export async function GET(req: NextRequest) {
  try {
    const { session } = await requirePermission("projects", "view");
    const url = new URL(req.url);
    const officeFilter = getOfficeFilter(session, url.searchParams.get("office"));
    const status = url.searchParams.get("status");

    let q: FirebaseFirestore.Query = db.collection("projects");
    if (officeFilter) q = q.where("officeId", "==", officeFilter);
    if (status) q = q.where("status", "==", status);
    const snap = await q.get();

    const projects = (await Promise.all(
      snap.docs.map(async (doc) => {
        const d = doc.data();
        let awardedToDevice = null;
        if (d.awardedToDeviceId) {
          const dev = await db.doc(`devices/${d.awardedToDeviceId}`).get();
          if (dev.exists) {
            const dd = dev.data()!;
            awardedToDevice = { id: dev.id, name: dd.name, serial: dd.serial };
          }
        }
        return serializeTimestamps({ id: doc.id, ...d, awardedToDevice });
      })
    )).sort((a: any, b: any) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));

    return Response.json({ projects });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requirePermission("projects", "edit");
    const body = await readJson(req) as any;
    const parsed = projectSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const officeId = enforceOfficeOnWrite(session, body?.officeId);

    const ref = await db.collection("projects").add({
      ...parsed.data,
      officeId,
      awardedToDeviceId: parsed.data.awardedToDeviceId ?? null,
      createdAt: Timestamp.now(),
    });

    return Response.json(
      { project: serializeTimestamps({ id: ref.id, ...parsed.data, officeId }) },
      { status: 201 }
    );
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { session } = await requirePermission("projects", "edit");
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return Response.json({ error: "id مطلوب" }, { status: 400 });

    const snap = await db.doc(`projects/${id}`).get();
    if (!snap.exists) return Response.json({ error: "غير موجود" }, { status: 404 });
    enforceOfficeOnWrite(session, snap.data()!.officeId as string);

    await db.doc(`projects/${id}`).delete();
    return Response.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}

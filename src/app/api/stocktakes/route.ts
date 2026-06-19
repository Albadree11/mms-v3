// src/app/api/stocktakes/route.ts
import { NextRequest } from "next/server";
import { db, Timestamp, serializeTimestamps } from "@/lib/firebase-admin";
import { stocktakeSchema } from "@/lib/enums";
import {
  requirePermission, getOfficeFilter, enforceOfficeOnWrite,
  handleError, readJson,
} from "@/lib/guard";

export async function GET(req: NextRequest) {
  try {
    const { session } = await requirePermission("devices", "view");
    const officeFilter = getOfficeFilter(session, new URL(req.url).searchParams.get("office"));

    let q: FirebaseFirestore.Query = db.collection("stocktakes");
    if (officeFilter) q = q.where("officeId", "==", officeFilter);
    q = q.orderBy("createdAt", "desc");
    const snap = await q.get();

    // Include item count for each stocktake
    const stocktakes = await Promise.all(
      snap.docs.map(async (doc) => {
        const countSnap = await db
          .collection(`stocktakes/${doc.id}/items`)
          .count()
          .get();
        return serializeTimestamps({
          id: doc.id,
          ...doc.data(),
          _count: { items: countSnap.data().count },
        });
      })
    );

    return Response.json({ stocktakes });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requirePermission("devices", "edit");
    const body = await readJson(req) as any;
    const parsed = stocktakeSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const officeId = enforceOfficeOnWrite(session, body?.officeId);

    // Build summary
    const summary: Record<string, number> = { found: 0, missing: 0, damaged: 0 };
    for (const it of parsed.data.items) {
      summary[it.result] = (summary[it.result] ?? 0) + 1;
    }

    const stocktakeRef = db.collection("stocktakes").doc();
    const now = Timestamp.now();

    const batch = db.batch();
    batch.set(stocktakeRef, {
      date:      parsed.data.date,
      by:        parsed.data.by,
      summary,
      officeId,
      createdAt: now,
    });

    for (const item of parsed.data.items) {
      const itemRef = stocktakeRef.collection("items").doc();
      batch.set(itemRef, { ...item, createdAt: now });
    }

    await batch.commit();

    return Response.json(
      {
        stocktake: serializeTimestamps({
          id: stocktakeRef.id,
          date: parsed.data.date,
          by: parsed.data.by,
          summary,
          officeId,
          _count: { items: parsed.data.items.length },
        }),
      },
      { status: 201 }
    );
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { session } = await requirePermission("devices", "edit");
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return Response.json({ error: "id مطلوب" }, { status: 400 });

    const snap = await db.doc(`stocktakes/${id}`).get();
    if (!snap.exists) return Response.json({ error: "غير موجود" }, { status: 404 });
    enforceOfficeOnWrite(session, snap.data()!.officeId as string);

    await db.doc(`stocktakes/${id}`).delete();
    return Response.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}

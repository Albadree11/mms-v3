// src/app/api/stocktakes/route.ts
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { stocktakeSchema } from "@/lib/enums";
import {
  requirePermission,
  officeScope,
  enforceOfficeOnWrite,
  handleError,
  readJson,
} from "@/lib/guard";

export async function GET(req: NextRequest) {
  try {
    const { session } = await requirePermission("devices", "view");
    const where = officeScope(session, new URL(req.url).searchParams.get("office"));
    const stocktakes = await db.stocktake.findMany({
      where,
      orderBy: { id: "desc" },
      include: { _count: { select: { items: true } } },
    });
    return Response.json({ stocktakes });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requirePermission("devices", "edit");
    const body = await readJson(req);
    const parsed = stocktakeSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const officeId = enforceOfficeOnWrite(session, body?.officeId);
    // build summary JSON
    const summary: Record<string, number> = { found: 0, missing: 0, damaged: 0 };
    for (const it of parsed.data.items) {
      summary[it.result] = (summary[it.result] || 0) + 1;
    }
    const stocktake = await db.stocktake.create({
      data: {
        date: parsed.data.date,
        by: parsed.data.by,
        officeId,
        summary: JSON.stringify(summary),
        items: {
          create: parsed.data.items.map((it) => ({
            deviceId: it.deviceId ?? null,
            name: it.name,
            serial: it.serial,
            manufacturer: it.manufacturer, // [FIX 17]
            result: it.result,
            note: it.note,
          })),
        },
      },
      include: { items: true },
    });
    return Response.json({ stocktake }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

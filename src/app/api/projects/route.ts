// src/app/api/projects/route.ts
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { projectSchema } from "@/lib/enums";
import {
  requirePermission,
  officeScope,
  enforceOfficeOnWrite,
  handleError,
  readJson,
} from "@/lib/guard";

export async function GET(req: NextRequest) {
  try {
    const { session } = await requirePermission("projects", "view");
    const url = new URL(req.url);
    const where: any = officeScope(session, url.searchParams.get("office"));
    const status = url.searchParams.get("status");
    if (status) where.status = status;
    const projects = await db.project.findMany({
      where,
      orderBy: { id: "desc" },
      include: {
        awardedToDevice: { select: { id: true, name: true, serial: true } },
      },
    });
    return Response.json({ projects });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requirePermission("projects", "edit");
    const body = await readJson(req);
    const parsed = projectSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const officeId = enforceOfficeOnWrite(session, body?.officeId);
    const project = await db.project.create({
      data: { ...parsed.data, officeId },
    });
    return Response.json({ project }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

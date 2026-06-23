// src/app/api/projects/[id]/route.ts — [FIX A3] edit/delete projects
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { projectSchema } from "@/lib/enums";
import {
  requirePermission,
  officeScope,
  handleError,
  readJson,
  GuardError,
} from "@/lib/guard";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requirePermission("projects", "edit");
    const { id } = await params;
    const projectId = Number(id);
    if (!projectId) throw new GuardError(400, "معرّف غير صالح");

    const body = await readJson(req);
    const parsed = projectSchema.partial().safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
        { status: 400 }
      );
    }

    const scope = officeScope(session);
    const existing = await db.project.findFirst({
      where: { id: projectId, ...scope },
      select: { id: true },
    });
    if (!existing) throw new GuardError(404, "المشروع غير موجود");

    const data: Record<string, unknown> = { ...parsed.data };
    delete (data as any).officeId;

    // If awarding to a device, it must be within the caller's scope.
    if (typeof parsed.data.awardedToDeviceId === "number") {
      const device = await db.device.findFirst({
        where: { id: parsed.data.awardedToDeviceId, ...scope },
        select: { id: true },
      });
      if (!device) throw new GuardError(404, "الجهاز غير موجود ضمن نطاقك");
    }

    const project = await db.project.update({
      where: { id: projectId },
      data,
    });
    return Response.json({ project });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requirePermission("projects", "full");
    const { id } = await params;
    const projectId = Number(id);
    if (!projectId) throw new GuardError(400, "معرّف غير صالح");

    const scope = officeScope(session);
    const existing = await db.project.findFirst({
      where: { id: projectId, ...scope },
      select: { id: true },
    });
    if (!existing) throw new GuardError(404, "المشروع غير موجود");

    await db.project.delete({ where: { id: projectId } });
    return Response.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}

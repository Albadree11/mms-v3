// src/lib/guard.ts — [FIX 6, 7]
// Server-side permission checks + office isolation primitives.

import { NextRequest } from "next/server";
import { getSession, type SessionData } from "./session";
import type { PermLevel, PermModule } from "./enums";

const LEVEL_RANK: Record<PermLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
  full: 3,
};

/** True if `perms[module]` >= `level`. */
export function can(
  perms: Record<string, string>,
  module: PermModule,
  level: PermLevel
): boolean {
  const have = perms[module] as PermLevel | undefined;
  if (!have) return false;
  return LEVEL_RANK[have] >= LEVEL_RANK[level];
}

/** Super admin has officeId === null. */
export function isSuperAdmin(session: SessionData | null): boolean {
  return !!session && session.officeId === null;
}

export class GuardError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "GuardError";
  }
}

export async function requirePermission(
  module: PermModule,
  level: PermLevel
): Promise<{ session: SessionData; officeId: string | null }> {
  const session = await getSession();
  if (!session) {
    throw new GuardError(401, "يجب تسجيل الدخول أولاً");
  }
  if (isSuperAdmin(session)) {
    return { session, officeId: null };
  }
  if (!can(session.perms, module, level)) {
    throw new GuardError(403, "ليست لديك صلاحية كافية للوصول إلى هذا المورد");
  }
  return { session, officeId: session.officeId };
}

export function officeScope(
  session: SessionData,
  requestedOfficeId?: string | null
): { officeId?: string } {
  if (isSuperAdmin(session)) {
    if (requestedOfficeId && requestedOfficeId !== "all") {
      return { officeId: requestedOfficeId };
    }
    return {};
  }
  return { officeId: session.officeId! };
}

export function enforceOfficeOnWrite(
  session: SessionData,
  bodyOfficeId?: string | null
): string {
  if (isSuperAdmin(session)) {
    if (!bodyOfficeId || typeof bodyOfficeId !== "string") {
      throw new GuardError(400, "يجب تحديد المكتب للمدير العام");
    }
    return bodyOfficeId;
  }
  return session.officeId!;
}

export function handleError(err: unknown): Response {
  if (err instanceof GuardError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  const msg = err instanceof Error ? err.message : "";
  if (msg.toLowerCase().includes("unique constraint")) {
    return Response.json({ error: "القيمة مُستخدمة مسبقاً (قيد التفرد)" }, { status: 409 });
  }
  if (msg.toLowerCase().includes("foreign key constraint failed")) {
    return Response.json({ error: "المرجع المحدد غير موجود" }, { status: 400 });
  }
  console.error("[API ERROR]", err);
  return Response.json({ error: "خطأ داخلي في الخادم" }, { status: 500 });
}

export async function readJson(req: NextRequest | Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    throw new GuardError(400, "جسم الطلب ليس JSON صالحاً");
  }
}

export function readOfficeParam(req: NextRequest): string | null {
  const url = new URL(req.url);
  return url.searchParams.get("office");
}

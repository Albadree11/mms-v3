// src/app/api/files/[id]/route.ts
// [VERCEL] Files are stored in Supabase Storage — filePath holds the public URL.
// GET redirects to the public URL; DELETE removes from Supabase + DB.
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import {
  requirePermission,
  officeScope,
  handleError,
  GuardError,
} from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "mms-files";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key);
}

/** GET /api/files/:id — redirect to Supabase public URL. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requirePermission("files", "view");
    const { id } = await params;
    const fileId = Number(id);
    if (!fileId) throw new GuardError(400, "معرّف غير صالح");

    const scope = officeScope(session);
    const entry = await db.fileEntry.findFirst({
      where: { id: fileId, ...scope },
    });
    if (!entry) throw new GuardError(404, "الملف غير موجود");

    // filePath holds the Supabase public URL — redirect the client to it.
    return Response.redirect(entry.filePath, 302);
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/files/:id — remove from Supabase Storage + DB. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requirePermission("files", "full");
    const { id } = await params;
    const fileId = Number(id);
    if (!fileId) throw new GuardError(400, "معرّف غير صالح");

    const scope = officeScope(session);
    const entry = await db.fileEntry.findFirst({
      where: { id: fileId, ...scope },
    });
    if (!entry) throw new GuardError(404, "الملف غير موجود");

    // Delete DB row first.
    await db.fileEntry.delete({ where: { id: fileId } });

    // Delete from Supabase Storage (best-effort — a missing file should not
    // block deleting the metadata).
    try {
      const supabase = getSupabase();
      // Extract the storage path from the public URL.
      const url = new URL(entry.filePath);
      const storagePath = url.pathname.split(`/object/public/${BUCKET}/`)[1];
      if (storagePath) {
        await supabase.storage.from(BUCKET).remove([storagePath]);
      }
    } catch {
      /* ignore storage deletion errors */
    }

    return Response.json({ ok: true });
  } catch (err) {
    return handleError, err);
  }
}

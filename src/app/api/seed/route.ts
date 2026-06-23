// src/app/api/seed/route.ts
// Protected by x-seed-secret header — only call this once after deployment.
// Idempotent: skips records that already exist.
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // --- Auth ---
  const secret = req.headers.get("x-seed-secret");
  if (!secret || secret !== process.env.SEED_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results: string[] = [];

    // ----------------------------------------------------------------
    // Offices
    // ----------------------------------------------------------------
    const officeData = [
      { id: "shatea", name: "مكتب الشاطئ" },
      { id: "diaar",  name: "مكتب الديار" },
    ];

    for (const o of officeData) {
      const existing = await db.office.findUnique({ where: { id: o.id } });
      if (existing) {
        results.push(`office:${o.id} already exists — skipped`);
      } else {
        await db.office.create({ data: o });
        results.push(`office:${o.id} created`);
      }
    }

    // ----------------------------------------------------------------
    // Users (password "1234")
    // ----------------------------------------------------------------
    const passwordHash = await bcrypt.hash("1234", 10);

    const userData = [
      {
        username: "admin",
        name:     "مدير النظام",
        role:     "superadmin",
        officeId: null,
        perms:    "{}",
      },
      {
        username: "shatea",
        name:     "مستخدم الشاط٦",
        role:     "user",
        officeId: "shatea",
        perms:    "{}",
      },
      {
        username: "diaar",
        name:     "مستخدم الديار",
        role:     "user",
        officeId: "diaar",
        perms:    "{}",
      },
    ];

    for (const u of userData) {
      const existing = await db.user.findUnique({ where: { username: u.username } });
      if (existing) {
        results.push(`user:${u.username} already exists — skipped`);
      } else {
        await db.user.create({
          data: {
            username: u.username,
            name:     u.name,
            password: passwordHash,
            role:     u.role,
            officeId: u.officeId,
            perms:    u.perms,
          },
        });
        results.push(`user:${u.username} created`);
      }
    }

    return Response.json({ ok: true, results });
  } catch (err) {
    console.error("Seed error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

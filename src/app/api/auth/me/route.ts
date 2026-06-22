// src/app/api/auth/me/route.ts
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ user: null });
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      phone: true,
      department: true,
      officeId: true,
      perms: true,
    },
  });
  if (!user) return Response.json({ user: null });
  let perms: Record<string, string> = {};
  try {
    perms = JSON.parse(user.perms || "{}");
  } catch {
    perms = {};
  }
  return Response.json({
    user: {
      ...user,
      perms,
      isSuperAdmin: session.officeId === null,
    },
  });
}

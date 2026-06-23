// src/components/mms/OfficeContext.tsx
"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { User, Office } from "@/lib/types";

/**
 * activeOfficeId values:
 *   - "all"      → super admin viewing every office (no office filter)
 *   - "shatea" → scoped to shatea office
 *   - "diaar"   → scoped to diaar office
 *
 * Normal users always have activeOfficeId === user.officeId (locked).
 */
export interface OfficeContextValue {
  user: User;
  offices: Office[];
  activeOfficeId: string; // "all" | office.id
  activeOffice: Office | null; // null when activeOfficeId === "all"
  isScopedToSingleOffice: boolean; // true when activeOfficeId !== "all"
}

const OfficeContext = createContext<OfficeContextValue | null>(null);

export function OfficeProvider({
  user,
  offices,
  activeOfficeId,
  children,
}: {
  user: User;
  offices: Office[];
  activeOfficeId: string;
  children: ReactNode;
}) {
  const value = useMemo<OfficeContextValue>(() => {
    const activeOffice = offices.find((o) => o.id === activeOfficeId) ?? null;
    return {
      user,
      offices,
      activeOfficeId,
      activeOffice,
      isScopedToSingleOffice: activeOfficeId !== "all",
    };
  }, [user, offices, activeOfficeId]);

  return <OfficeContext.Provider value={value}>{children}</OfficeContext.Provider>;
}

export function useOffice(): OfficeContextValue {
  const ctx = useContext(OfficeContext);
  if (!ctx) {
    throw new Error("useOffice must be used inside <OfficeProvider>");
  }
  return ctx;
}

/**
 * Build the `?office=` query string segment for fetch calls.
 * - When scoped to a single office, returns "&office=<id>" (or "?office=<id>"
 *   if no other params exist — caller decides).
 * - When viewing all offices (super admin default), returns "".
 *
 * Usage:
 *   const officeQ = officeQuery();
 *   fetch(`/api/devices${officeQ ? `?${officeQ}` : ""}`)
 */
export function officeQuery(ctx: OfficeContextValue): string {
  return ctx.isScopedToSingleOffice ? `office=${ctx.activeOfficeId}` : "";
}

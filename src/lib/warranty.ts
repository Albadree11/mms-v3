// src/lib/warranty.ts — [FIX 3]
// Warranty expiry is NEVER stored. It is computed on-the-fly from
// installDate + warrantyMonths.

export type WarrantyState = "under" | "expiring" | "expired" | "unknown";

export interface WarrantyInfo {
  expiry: Date | null;
  daysLeft: number | null;
  state: WarrantyState;
}

export const WARRANTY_LABELS: Record<WarrantyState, string> = {
  under: "ضمن الضمان",
  expiring: "قرب الانتهاء",
  expired: "منتهي الضمان",
  unknown: "غير معروف",
};

/** Threshold (days) below which a warranty is flagged as "expiring". */
export const EXPIRING_THRESHOLD_DAYS = 90;

/**
 * Compute warranty info dynamically.
 * @param installDate ISO date string (YYYY-MM-DD) or empty
 * @param warrantyMonths number of months of warranty
 */
export function computeWarranty(
  installDate: string,
  warrantyMonths: number
): WarrantyInfo {
  if (!installDate || !warrantyMonths || warrantyMonths <= 0) {
    return { expiry: null, daysLeft: null, state: "unknown" };
  }
  const start = new Date(installDate);
  if (isNaN(start.getTime())) {
    return { expiry: null, daysLeft: null, state: "unknown" };
  }
  const expiry = new Date(start);
  expiry.setMonth(expiry.getMonth() + warrantyMonths);
  const now = new Date();
  const msLeft = expiry.getTime() - now.getTime();
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  let state: WarrantyState;
  if (daysLeft <= 0) state = "expired";
  else if (daysLeft <= EXPIRING_THRESHOLD_DAYS) state = "expiring";
  else state = "under";
  return { expiry, daysLeft, state };
}

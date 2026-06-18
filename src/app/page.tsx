// src/app/page.tsx — MMS v3 root SPA
"use client";

import { useEffect, useState } from "react";
import LoginScreen from "@/components/mms/LoginScreen";
import OfficePicker from "@/components/mms/OfficePicker";
import AppShell from "@/components/mms/AppShell";
import { Loader2 } from "lucide-react";
import type { User } from "@/lib/types";

/**
 * Flow:
 *   1. booting         → spinner while /api/auth/me resolves
 *   2. no user         → LoginScreen
 *   3. user, no office → OfficePicker (super admin picks; normal users auto-enter)
 *   4. user + office   → AppShell
 */
export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [activeOfficeId, setActiveOfficeId] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  // On first load, check whether a valid session cookie already exists.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (!cancelled && res.ok && data.user) {
          setUser(data.user);
          // Normal users are locked to their own office — set it directly so
          // they skip the picker. Super admins (officeId === null) go through
          // the picker.
          if (data.user.officeId) {
            setActiveOfficeId(data.user.officeId);
          }
        }
      } catch {
        /* network errors just leave the user on the login screen */
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  // LoginScreen receives the user object directly from the login response —
  // no second round-trip to /api/auth/me that could race with cookie
  // propagation and silently leave the user on the login screen.
  if (!user) {
    return (
      <LoginScreen
        onLogin={(loggedInUser) => {
          setUser(loggedInUser);
          // Normal users are locked to their own office — auto-pick it.
          if (loggedInUser.officeId) {
            setActiveOfficeId(loggedInUser.officeId);
          }
          // Super admins leave activeOfficeId null → OfficePicker shows.
        }}
      />
    );
  }

  // Super admin must pick an office (or "all") before entering the app.
  if (!activeOfficeId) {
    return (
      <OfficePicker
        user={user}
        onPick={(pickedId) => setActiveOfficeId(pickedId)}
      />
    );
  }

  return (
    <AppShell
      user={user}
      activeOfficeId={activeOfficeId}
      onActiveOfficeChange={setActiveOfficeId}
      onLogout={() => {
        setUser(null);
        setActiveOfficeId(null);
      }}
    />
  );
}

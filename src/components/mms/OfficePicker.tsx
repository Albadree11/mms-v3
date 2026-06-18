// src/components/mms/OfficePicker.tsx — post-login office selection screen
"use client";

import { useEffect, useState } from "react";
import { Building2, ChevronLeft, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { User, Office } from "@/lib/types";
import { cn } from "@/lib/utils";

const OFFICE_THEMES: Record<string, { gradient: string; ring: string; text: string }> = {
  cyan: {
    gradient: "from-cyan-500 to-teal-600",
    ring: "hover:ring-cyan-400 hover:border-cyan-400",
    text: "text-cyan-600",
  },
  emerald: {
    gradient: "from-emerald-500 to-green-600",
    ring: "hover:ring-emerald-400 hover:border-emerald-400",
    text: "text-emerald-600",
  },
  blue: {
    gradient: "from-sky-500 to-blue-600",
    ring: "hover:ring-sky-400 hover:border-sky-400",
    text: "text-sky-600",
  },
  amber: {
    gradient: "from-amber-500 to-orange-600",
    ring: "hover:ring-amber-400 hover:border-amber-400",
    text: "text-amber-600",
  },
  rose: {
    gradient: "from-rose-500 to-pink-600",
    ring: "hover:ring-rose-400 hover:border-rose-400",
    text: "text-rose-600",
  },
};

function theme(color: string) {
  return OFFICE_THEMES[color] ?? OFFICE_THEMES.blue;
}

export default function OfficePicker({
  user,
  onPick,
}: {
  user: User;
  onPick: (officeId: string) => void; // "all" | office.id
}) {
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/offices");
        const data = await res.json();
        if (res.ok) setOffices(data.offices || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Normal office users are locked to their own office — skip the picker
  // entirely and proceed directly. Only super admins see the picker.
  if (!user.isSuperAdmin) {
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      );
    }
    // Auto-pick the user's office
    onPick(user.officeId!);
    return null;
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f766e 100%)",
      }}
    >
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg mb-4">
            <ShieldCheck className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            مرحباً، {user.name}
          </h1>
          <p className="text-slate-400 mt-1">
            اختر المكتب الذي تريد إدارته. يمكنك التبديل لاحقاً من القائمة الجانبية.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* "All offices" option — super admin only */}
            <button
              onClick={() => onPick("all")}
              className={cn(
                "group relative overflow-hidden rounded-xl p-6 text-right border-2 border-slate-700/50 bg-slate-800/50 backdrop-blur transition-all hover:scale-[1.02]",
                "hover:border-teal-400 hover:ring-2 hover:ring-teal-400/40"
              )}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-7 h-7 text-slate-200" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-white text-lg">كل المكاتب</div>
                  <div className="text-sm text-slate-400 mt-1">
                    عرض شامل لأجهزة ومستشفيات وسجلات جميع المكاتب
                  </div>
                </div>
                <ChevronLeft className="w-5 h-5 text-slate-500 group-hover:text-teal-400 transition-colors" />
              </div>
            </button>

            {/* One card per office */}
            {offices.map((office) => {
              const t = theme(office.color);
              const count = office._count;
              return (
                <button
                  key={office.id}
                  onClick={() => onPick(office.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-xl p-6 text-right border-2 border-slate-700/50 bg-slate-800/50 backdrop-blur transition-all hover:scale-[1.02]",
                    t.ring
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0",
                        t.gradient
                      )}
                    >
                      <Building2 className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-lg">
                        {office.name}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2 text-xs">
                        {count && (
                          <>
                            <span className="px-2 py-0.5 rounded-md bg-slate-700/60 text-slate-300">
                              {count.devices} جهاز
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-700/60 text-slate-300">
                              {count.hospitals} مستشفى
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-700/60 text-slate-300">
                              {count.users} مستخدم
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronLeft
                      className={cn(
                        "w-5 h-5 text-slate-500 group-hover:text-teal-400 transition-colors"
                      )}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

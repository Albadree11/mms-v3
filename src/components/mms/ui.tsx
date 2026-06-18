// src/components/mms/ui.tsx — small shared building blocks
"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{title}</h1>
        {description && (
          <p className="text-sm text-slate-500 mt-1">{description}</p>
        )}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

const STAT_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  teal: { bg: "from-teal-500/10 to-emerald-500/10", text: "text-teal-600", icon: "bg-teal-500/15 text-teal-600" },
  amber: { bg: "from-amber-500/10 to-orange-500/10", text: "text-amber-600", icon: "bg-amber-500/15 text-amber-600" },
  red: { bg: "from-rose-500/10 to-red-500/10", text: "text-rose-600", icon: "bg-rose-500/15 text-rose-600" },
  blue: { bg: "from-sky-500/10 to-indigo-500/10", text: "text-sky-600", icon: "bg-sky-500/15 text-sky-600" },
  purple: { bg: "from-violet-500/10 to-purple-500/10", text: "text-violet-600", icon: "bg-violet-500/15 text-violet-600" },
  slate: { bg: "from-slate-500/10 to-slate-700/10", text: "text-slate-700", icon: "bg-slate-500/15 text-slate-700" },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  color = "teal",
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  color?: keyof typeof STAT_STYLES;
  hint?: string;
}) {
  const s = STAT_STYLES[color];
  return (
    <Card className={cn("p-5 border-0 shadow-sm bg-gradient-to-br", s.bg)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-slate-600 font-medium">{label}</div>
          <div className={cn("text-3xl font-bold mt-1", s.text)}>{value}</div>
          {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
        </div>
        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0", s.icon)}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="text-center py-16 px-4">
      <div className="mx-auto w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">{description}</p>
      )}
    </div>
  );
}

export function OfficeBadge({ officeId, officeName, color }: { officeId: string; officeName?: string; color?: string }) {
  const colorMap: Record<string, string> = {
    cyan: "bg-cyan-100 text-cyan-700",
    emerald: "bg-emerald-100 text-emerald-700",
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
  };
  const cls = colorMap[color || "blue"] || colorMap.blue;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", cls)}>
      {officeName || officeId}
    </span>
  );
}

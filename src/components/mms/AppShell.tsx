// src/components/mms/AppShell.tsx — main authenticated shell with view-switching
"use client";

import { useState, useCallback, useEffect } from "react";
import {
  LayoutDashboard,
  MonitorSmartphone,
  Wrench,
  FolderKanban,
  FileText,
  ClipboardCheck,
  Building2,
  Users,
  Paperclip,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Repeat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { User, Office } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { OfficeProvider, useOffice } from "./OfficeContext";

import DashboardView from "./views/DashboardView";
import DevicesView from "./views/DevicesView";
import MaintenanceView from "./views/MaintenanceView";
import ProjectsView from "./views/ProjectsView";
import DocumentsView from "./views/DocumentsView";
import StocktakesView from "./views/StocktakesView";
import HospitalsView from "./views/HospitalsView";
import UsersView from "./views/UsersView";
import FilesView from "./views/FilesView";

type ViewKey =
  | "dashboard"
  | "devices"
  | "maintenance"
  | "projects"
  | "documents"
  | "stocktakes"
  | "hospitals"
  | "users"
  | "files";

interface NavItem {
  key: ViewKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  module: "devices" | "maintenance" | "projects" | "files" | "documents" | "users" | null;
  minLevel?: "view" | "edit" | "full";
}

const NAV: NavItem[] = [
  { key: "dashboard", label: "لوحة التحكم", icon: LayoutDashboard, module: null },
  { key: "devices", label: "الأجهزة", icon: MonitorSmartphone, module: "devices", minLevel: "view" },
  { key: "maintenance", label: "الصيانة", icon: Wrench, module: "maintenance", minLevel: "view" },
  { key: "projects", label: "المشاريع", icon: FolderKanban, module: "projects", minLevel: "view" },
  { key: "documents", label: "الكتب الرسمية", icon: FileText, module: "documents", minLevel: "view" },
  { key: "stocktakes", label: "الجرد", icon: ClipboardCheck, module: "devices", minLevel: "view" },
  { key: "hospitals", label: "المستشفيات", icon: Building2, module: "devices", minLevel: "view" },
  { key: "users", label: "المستخدمون", icon: Users, module: "users", minLevel: "view" },
  { key: "files", label: "الملفات", icon: Paperclip, module: "files", minLevel: "view" },
];

const LEVEL_RANK: Record<string, number> = { none: 0, view: 1, edit: 2, full: 3 };

function canSee(user: User, item: NavItem): boolean {
  if (user.isSuperAdmin) return true;
  if (!item.module) return true; // dashboard always visible
  const lvl = user.perms?.[item.module] ?? "none";
  const need = item.minLevel ?? "view";
  return LEVEL_RANK[lvl] >= LEVEL_RANK[need];
}

const OFFICE_THEME_COLORS: Record<string, string> = {
  cyan: "from-cyan-400 to-teal-500",
  emerald: "from-emerald-400 to-green-500",
  blue: "from-sky-400 to-blue-500",
  amber: "from-amber-400 to-orange-500",
  rose: "from-rose-400 to-pink-500",
};

function officeTheme(color?: string): string {
  return OFFICE_THEME_COLORS[color ?? "blue"] ?? OFFICE_THEME_COLORS.blue;
}

/**
 * Inner shell that consumes the OfficeContext. Splitting this out lets every
 * view under it read the active office without prop-drilling through AppShell.
 */
function AppShellInner({
  onActiveOfficeChange,
  onLogout,
}: {
  onActiveOfficeChange: () => void;
  onLogout: () => void;
}) {
  const { user, offices, activeOfficeId, activeOffice } = useOffice();
  const [view, setView] = useState<ViewKey>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const visibleNav = NAV.filter((n) => canSee(user, n));

  const navigate = useCallback((v: ViewKey) => {
    setView(v);
    setSidebarOpen(false);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore network errors on logout */
    }
    toast.success("تم تسجيل الخروج");
    onLogout();
  }, [onLogout]);

  // Header gradient reflects the active office so the user always knows
  // which office they are working in at a glance.
  const headerGradient = activeOffice
    ? officeTheme(activeOffice.color)
    : "from-teal-400 to-emerald-500";

  return (
    <div className="min-h-screen bg-slate-50 flex" dir="rtl">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 right-0 z-50 w-72 bg-slate-900 text-slate-100 transform transition-transform duration-300 lg:translate-x-0 flex flex-col",
          sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex items-center gap-3 p-5 border-b border-slate-800">
          <div
            className={cn(
              "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg",
              headerGradient
            )}
          >
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm truncate">
              {activeOffice ? activeOffice.name : "كل المكاتب"}
            </div>
            <div className="text-xs text-slate-400">إدارة الأجهزة الطبية</div>
          </div>
          <button
            className="lg:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Office switcher button — only super admins can switch. */}
        {user.isSuperAdmin && (
          <div className="p-3 border-b border-slate-800">
            <button
              onClick={onActiveOfficeChange}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors border border-slate-700/50"
            >
              <Repeat className="w-4 h-4" />
              <span>تبديل المكتب</span>
              <span className="mr-auto text-xs text-slate-500 truncate">
                {activeOffice ? activeOffice.name : "الكل"}
              </span>
            </button>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = view === item.key;
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.key)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-gradient-to-l from-teal-500/20 to-emerald-500/20 text-teal-300 border border-teal-500/30"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="bg-slate-800/50 rounded-lg p-3 text-xs">
            <div className="font-semibold text-slate-200">{user.name}</div>
            <div className="text-slate-500 mt-0.5 truncate">{user.username}</div>
            <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300">
              {user.isSuperAdmin ? "مدير عام" : "مستخدم مكتب"}
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 ml-2" />
            تسجيل الخروج
          </Button>
        </div>
      </aside>

      {/* mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden bg-white border-b sticky top-0 z-30 flex items-center justify-between p-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md hover:bg-slate-100"
            aria-label="القائمة"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="font-bold text-slate-800">
            {activeOffice ? activeOffice.name : "كل المكاتب"}
          </div>
          {user.isSuperAdmin && (
            <button
              onClick={onActiveOfficeChange}
              className="p-2 rounded-md hover:bg-slate-100 text-slate-600"
              aria-label="تبديل المكتب"
            >
              <Repeat className="w-5 h-5" />
            </button>
          )}
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-hidden">
          {view === "dashboard" && <DashboardView />}
          {view === "devices" && <DevicesView />}
          {view === "maintenance" && <MaintenanceView />}
          {view === "projects" && <ProjectsView />}
          {view === "documents" && <DocumentsView />}
          {view === "stocktakes" && <StocktakesView />}
          {view === "hospitals" && <HospitalsView />}
          {view === "users" && <UsersView />}
          {view === "files" && <FilesView />}
        </main>
      </div>
    </div>
  );
}

export default function AppShell({
  user,
  activeOfficeId,
  onActiveOfficeChange,
  onLogout,
}: {
  user: User;
  activeOfficeId: string;
  onActiveOfficeChange: (id: string) => void;
  onLogout: () => void;
}) {
  // Fetch offices once for the provider + switcher.
  const [offices, setOffices] = useState<Office[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/offices");
        const data = await res.json();
        if (!cancelled && res.ok) setOffices(data.offices || []);
      } catch {
        /* leave offices empty — UI degrades gracefully */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <OfficeProvider user={user} offices={offices} activeOfficeId={activeOfficeId}>
      <AppShellInner
        onActiveOfficeChange={() => onActiveOfficeChange("")}
        onLogout={onLogout}
      />
    </OfficeProvider>
  );
}

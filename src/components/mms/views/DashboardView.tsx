// src/components/mms/views/DashboardView.tsx
"use client";

import { useEffect, useState } from "react";
import {
  MonitorSmartphone,
  Wrench,
  AlertTriangle,
  Building2,
  Users,
  FolderKanban,
  FileText,
  TrendingUp,
  Activity,
} from "lucide-react";
import { PageHeader, StatCard } from "../ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Device } from "@/lib/types";
import { WARRANTY_LABELS } from "@/lib/warranty";
import { useOffice, officeQuery } from "../OfficeContext";

const stateColor: Record<string, string> = {
  under: "bg-emerald-100 text-emerald-700",
  expiring: "bg-amber-100 text-amber-700",
  expired: "bg-rose-100 text-rose-700",
  unknown: "bg-slate-100 text-slate-600",
};

type ViewKey =
  | "dashboard" | "devices" | "maintenance" | "projects" | "documents"
  | "movements" | "stocktakes" | "hospitals" | "users" | "files";

export default function DashboardView({
  onNavigate,
}: {
  onNavigate?: (v: ViewKey) => void;
}) {
  const office = useOffice();
  const { user, activeOffice } = office;
  const [devices, setDevices] = useState<Device[]>([]);
  const [counts, setCounts] = useState({
    hospitals: 0,
    users: 0,
    projects: 0,
    documents: 0,
    maintenance: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const q = officeQuery(office);
        const sep = q ? "?" : "";
        const amp = q ? "&" : "";
        const [devRes, hosRes, usrRes, projRes, docRes, mainRes] = await Promise.all([
          fetch(`/api/devices${sep}${q}`),
          fetch(`/api/hospitals${sep}${q}`),
          fetch(`/api/users${sep}${q}`),
          fetch(`/api/projects${sep}${q}`),
          fetch(`/api/documents${sep}${q}`),
          fetch(`/api/maintenance${sep}${q}`),
        ]);
        const devData = await devRes.json();
        const hosData = await hosRes.json();
        const usrData = await usrRes.json();
        const projData = await projRes.json();
        const docData = await docRes.json();
        const mainData = await mainRes.json();
        if (cancelled) return;
        if (devRes.ok) setDevices(devData.devices || []);
        if (hosRes.ok) setCounts((c) => ({ ...c, hospitals: hosData.hospitals?.length || 0 }));
        if (usrRes.ok) setCounts((c) => ({ ...c, users: usrData.users?.length || 0 }));
        if (projRes.ok) setCounts((c) => ({ ...c, projects: projData.projects?.length || 0 }));
        if (docRes.ok) setCounts((c) => ({ ...c, documents: docData.documents?.length || 0 }));
        if (mainRes.ok) setCounts((c) => ({ ...c, maintenance: mainData.records?.length || 0 }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [office.activeOfficeId]);

  const total = devices.length;
  const active = devices.filter((d) => d.status === "active").length;
  const inMaintenance = devices.filter((d) => d.status === "maintenance").length;
  const expiringSoon = devices.filter((d) => d.warranty?.state === "expiring").length;
  const expired = devices.filter((d) => d.warranty?.state === "expired").length;
  const inWarehouse = devices.filter((d) => d.location === "warehouse").length;
  const inHospitals = devices.filter((d) => d.location === "hospital").length;

  const upcomingMaint = devices
    .filter((d) => d.warranty?.state === "expiring" || d.warranty?.state === "expired")
    .slice(0, 6);

  const scopeLabel = activeOffice
    ? activeOffice.name
    : "كل المكاتب";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`مرحباً، ${user.name}`}
        description={`أنت تعمل ضمن: ${scopeLabel}. ${user.isSuperAdmin ? "يمكنك التبديل بين المكاتب من القائمة الجانبية." : "بياناتك معزولة عن باقي المكاتب."}`}
        action={
          onNavigate && (
            <Button
              className="bg-gradient-to-l from-teal-500 to-emerald-600"
              onClick={() => onNavigate("devices")}
            >
              <MonitorSmartphone className="w-4 h-4 ml-2" />
              إدارة الأجهزة
            </Button>
          )
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="إجمالي الأجهزة" value={loading ? "—" : total} icon={MonitorSmartphone} color="teal" />
        <StatCard label="أجهزة فعّالة" value={loading ? "—" : active} icon={Activity} color="blue" hint={`${inMaintenance} قيد الصيانة`} />
        <StatCard label="قرب انتهاء الضمان" value={loading ? "—" : expiringSoon} icon={AlertTriangle} color="amber" hint={`${expired} منتهٍ`} />
        <StatCard label="المستشفيات" value={loading ? "—" : counts.hospitals} icon={Building2} color="purple" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="المستخدمون" value={counts.users} icon={Users} color="slate" />
        <StatCard label="المشاريع" value={counts.projects} icon={FolderKanban} color="blue" />
        <StatCard label="الكتب الرسمية" value={counts.documents} icon={FileText} color="purple" />
        <StatCard label="سجلات الصيانة" value={counts.maintenance} icon={Wrench} color="amber" />
      </div>

      {/* Warehouse / Hospital split + expiring list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">توزيع الموقع</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-sm font-medium text-amber-900">في المخزن</span>
              </div>
              <span className="text-2xl font-bold text-amber-700">{inWarehouse}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-teal-50 border border-teal-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-teal-500" />
                <span className="text-sm font-medium text-teal-900">في المستشفيات</span>
              </div>
              <span className="text-2xl font-bold text-teal-700">{inHospitals}</span>
            </div>
            <div className="pt-2 border-t border-slate-100">
              <div className="text-xs text-slate-500 mb-2">الحالة</div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{active} فعّال</Badge>
                <Badge variant="outline">{inMaintenance} صيانة</Badge>
                <Badge variant="outline">{inWarehouse} في المخزن</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg">تنبيهات الضمان</CardTitle>
            {onNavigate && (
              <Button variant="ghost" size="sm" onClick={() => onNavigate("devices")}>
                عرض الكل
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {upcomingMaint.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-500">
                <TrendingUp className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                لا توجد أجهزة قرب انتهاء الضمان
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {upcomingMaint.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 truncate">{d.name}</div>
                      <div className="text-xs text-slate-500">
                        {d.serial} • {d.manufacturer}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={stateColor[d.warranty?.state || "unknown"]}>
                        {d.warranty ? WARRANTY_LABELS[d.warranty.state] : "—"}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        {d.warranty?.daysLeft !== null && d.warranty?.daysLeft !== undefined
                          ? `${d.warranty.daysLeft} يوم`
                          : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

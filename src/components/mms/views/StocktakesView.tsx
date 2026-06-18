// src/components/mms/views/StocktakesView.tsx
"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck, Plus, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { PageHeader, EmptyState, OfficeBadge } from "../ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import type { Stocktake, Office, Device } from "@/lib/types";
import { STOCKTAKE_RESULTS, label } from "@/lib/enums";
import { useOffice } from "../OfficeContext";

const resultColor: Record<string, string> = {
  found: "bg-emerald-100 text-emerald-700",
  missing: "bg-rose-100 text-rose-700",
  damaged: "bg-amber-100 text-amber-700",
};

const resultIcon: Record<string, any> = {
  found: CheckCircle2,
  missing: XCircle,
  damaged: AlertTriangle,
};

function emptyForm() {
  return {
    date: new Date().toISOString().slice(0, 10),
    by: "",
    officeId: "",
    items: [] as any[],
  };
}

export default function StocktakesView() {
  const officeCtx = useOffice();
  const { user, activeOfficeId } = officeCtx;
  const [stocktakes, setStocktakes] = useState<Stocktake[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyForm());
  const [saving, setSaving] = useState(false);

  const canEdit = user.isSuperAdmin || user.perms?.devices === "edit" || user.perms?.devices === "full";

  async function load() {
    setLoading(true);
    try {
      const officeQ = activeOfficeId !== "all" ? `?office=${activeOfficeId}` : "";
      const [sRes, oRes, dRes] = await Promise.all([
        fetch(`/api/stocktakes${officeQ}`),
        fetch("/api/offices"),
        fetch(`/api/devices${officeQ}`),
      ]);
      const sData = await sRes.json();
      const oData = await oRes.json();
      const dData = await dRes.json();
      if (sRes.ok) setStocktakes(sData.stocktakes || []);
      if (oRes.ok) setOffices(oData.offices || []);
      if (dRes.ok) setDevices(dData.devices || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [activeOfficeId]);

  function openCreate() {
    const presetOfficeId = !user.isSuperAdmin
      ? user.officeId || ""
      : activeOfficeId !== "all"
      ? activeOfficeId
      : "";
    const items = devices.map((d) => ({
      deviceId: d.id,
      name: d.name,
      serial: d.serial,
      result: "found",
      note: "",
    }));
    setForm({
      date: new Date().toISOString().slice(0, 10),
      by: user.name,
      officeId: presetOfficeId,
      items,
    });
    setDialogOpen(true);
  }

  function setItemResult(idx: number, result: string) {
    setForm((f: any) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], result };
      return { ...f, items };
    });
  }
  function setItemNote(idx: number, note: string) {
    setForm((f: any) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], note };
      return { ...f, items };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/stocktakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الحفظ");
      toast.success("تم تسجيل الجرد");
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  function summarize(s: Stocktake): { found: number; missing: number; damaged: number } {
    try {
      return JSON.parse(s.summary || "{}");
    } catch {
      return { found: 0, missing: 0, damaged: 0 };
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="الجرد الدوري"
        description="جرد المخزون بنتائج موحّدة: موجود / مفقود / تالف [FIX 8]."
        action={canEdit && (
          <Button className="bg-gradient-to-l from-teal-500 to-emerald-600" onClick={openCreate}>
            <Plus className="w-4 h-4 ml-2" />
            جرد جديد
          </Button>
        )}
      />
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : stocktakes.length === 0 ? (
            <EmptyState title="لا توجد جردات" icon={ClipboardCheck} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>بواسطة</TableHead>
                    <TableHead>العناصر</TableHead>
                    <TableHead>موجود</TableHead>
                    <TableHead>مفقود</TableHead>
                    <TableHead>تالف</TableHead>
                    {user.isSuperAdmin && <TableHead>المكتب</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stocktakes.map((s) => {
                    const sum = summarize(s);
                    const office = offices.find((o) => o.id === s.officeId);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.date}</TableCell>
                        <TableCell className="text-sm">{s.by || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{s._count?.items || 0}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={resultColor.found}>{sum.found || 0}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={resultColor.missing}>{sum.missing || 0}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={resultColor.damaged}>{sum.damaged || 0}</Badge>
                        </TableCell>
                        {user.isSuperAdmin && (
                          <TableCell>
                            <OfficeBadge officeId={s.officeId} officeName={office?.name} color={office?.color} />
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>جرد جديد</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>التاريخ</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f: any) => ({ ...f, date: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>بواسطة</Label>
                <Input
                  value={form.by}
                  onChange={(e) => setForm((f: any) => ({ ...f, by: e.target.value }))}
                />
              </div>
              {user.isSuperAdmin && (
                <div className="space-y-2">
                  <Label>المكتب *</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={form.officeId}
                    onChange={(e) => setForm((f: any) => ({ ...f, officeId: e.target.value }))}
                    required
                  >
                    <option value="">اختر</option>
                    {offices.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-700 mb-2">
                العناصر ({form.items.length})
              </div>
              <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                {form.items.map((it: any, idx: number) => {
                  const Icon = resultIcon[it.result] || CheckCircle2;
                  return (
                    <div key={idx} className="flex items-center gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{it.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{it.serial}</div>
                      </div>
                      <Input
                        placeholder="ملاحظة"
                        value={it.note}
                        onChange={(e) => setItemNote(idx, e.target.value)}
                        className="w-32 h-8 text-xs"
                      />
                      <div className="flex gap-1">
                        {STOCKTAKE_RESULTS.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setItemResult(idx, r)}
                            className={`px-2 py-1 rounded-md text-xs font-medium ${
                              it.result === r ? resultColor[r] : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {label("stocktake_result", r)}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={saving} className="bg-gradient-to-l from-teal-500 to-emerald-600">
                {saving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : null}
                حفظ الجرد
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// src/components/mms/views/UsersView.tsx
"use client";

import { useEffect, useState } from "react";
import { Users, Plus, Loader2, Mail, Shield } from "lucide-react";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import type { Office } from "@/lib/types";
import { PERM_MODULES, PERM_LEVELS, label } from "@/lib/enums";
import { useOffice } from "../OfficeContext";

function emptyForm() {
  const perms: Record<string, string> = {};
  for (const m of PERM_MODULES) perms[m] = "view";
  return {
    name: "",
    email: "",
    password: "",
    phone: "",
    department: "",
    officeId: "",
    perms,
  };
}

export default function UsersView() {
  const officeCtx = useOffice();
  const { user, activeOfficeId } = officeCtx;
  const [users, setUsers] = useState<any[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyForm());
  const [saving, setSaving] = useState(false);

  const canEdit = user.isSuperAdmin || user.perms?.users === "edit" || user.perms?.users === "full";

  async function load() {
    setLoading(true);
    try {
      const officeQ = activeOfficeId !== "all" ? `?office=${activeOfficeId}` : "";
      const [uRes, oRes] = await Promise.all([
        fetch(`/api/users${officeQ}`),
        fetch("/api/offices"),
      ]);
      const uData = await uRes.json();
      const oData = await oRes.json();
      if (uRes.ok) setUsers(uData.users || []);
      if (oRes.ok) setOffices(oData.offices || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [activeOfficeId]);

  function setField(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }
  function setPerm(module: string, level: string) {
    setForm((f: any) => ({ ...f, perms: { ...f.perms, [module]: level } }));
  }

  function openCreate() {
    const presetOfficeId = !user.isSuperAdmin
      ? user.officeId || ""
      : activeOfficeId !== "all"
      ? activeOfficeId
      : "";
    setForm({
      ...emptyForm(),
      officeId: presetOfficeId,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الحفظ");
      toast.success("تم إنشاء المستخدم");
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="المستخدمون"
        description="إدارة حسابات المستخدمين والصلاحيات."
        action={canEdit && (
          <Button className="bg-gradient-to-l from-teal-500 to-emerald-600" onClick={openCreate}>
            <Plus className="w-4 h-4 ml-2" />
            مستخدم جديد
          </Button>
        )}
      />
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : users.length === 0 ? (
            <EmptyState title="لا يوجد مستخدمون" icon={Users} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>البريد</TableHead>
                    <TableHead>القسم</TableHead>
                    <TableHead>المكتب</TableHead>
                    <TableHead>الصلاحيات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const office = offices.find((o) => o.id === u.officeId);
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold">
                              {u.name.charAt(0)}
                            </div>
                            <div className="font-medium">{u.name}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span className="font-mono text-xs">{u.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{u.department || "—"}</TableCell>
                        <TableCell>
                          {u.officeId ? (
                            <OfficeBadge officeId={u.officeId} officeName={office?.name} color={office?.color} />
                          ) : (
                            <Badge className="bg-violet-100 text-violet-700 gap-1">
                              <Shield className="w-3 h-3" />
                              مدير عام
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-md">
                            {PERM_MODULES.map((m) => {
                              const lvl = u.perms?.[m] || "none";
                              if (lvl === "none") return null;
                              return (
                                <Badge key={m} variant="outline" className="text-xs">
                                  {label("perm_level", lvl)} · {m}
                                </Badge>
                              );
                            })}
                          </div>
                        </TableCell>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>مستخدم جديد</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label>الاسم *</Label>
              <Input value={form.name} onChange={(e) => setField("name", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني *</Label>
              <Input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>كلمة المرور *</Label>
              <Input type="password" value={form.password} onChange={(e) => setField("password", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>الهاتف</Label>
              <Input value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>القسم</Label>
              <Input value={form.department} onChange={(e) => setField("department", e.target.value)} />
            </div>
            {user.isSuperAdmin && (
              <div className="space-y-2">
                <Label>المكتب</Label>
                <Select value={form.officeId || "none"} onValueChange={(v) => setField("officeId", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">مدير عام (بدون مكتب)</SelectItem>
                    {offices.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="md:col-span-2">
              <Label className="mb-2 block">الصلاحيات</Label>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {PERM_MODULES.map((m) => (
                  <div key={m} className="flex items-center justify-between p-2.5">
                    <span className="text-sm font-medium">{m}</span>
                    <div className="flex gap-1">
                      {PERM_LEVELS.map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setPerm(m, lvl)}
                          className={`px-2 py-1 rounded-md text-xs ${
                            form.perms[m] === lvl
                              ? "bg-teal-500 text-white"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {label("perm_level", lvl)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter className="md:col-span-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={saving} className="bg-gradient-to-l from-teal-500 to-emerald-600">
                {saving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : null}
                حفظ
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

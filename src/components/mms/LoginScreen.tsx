// src/components/mms/LoginScreen.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Lock, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@/lib/types";

export default function LoginScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState("admin@medical.iq");
  const [password, setPassword] = useState("1234");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.user) {
        toast.error(data.error || "فشل تسجيل الدخول");
        return;
      }
      // The login response already carries the authenticated user object —
      // use it directly instead of issuing a second round-trip to /me that
      // could race with cookie propagation in some browsers.
      toast.success("مرحباً بك في النظام");
      onLogin(data.user as User);
    } catch {
      toast.error("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f766e 100%)",
      }}
    >
      <Card className="w-full max-w-md shadow-2xl border-slate-700/50 bg-slate-900/80 backdrop-blur">
        <CardHeader className="text-center space-y-3 pb-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg">
            <Activity className="w-9 h-9 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            نظام إدارة الأجهزة الطبية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200">
                البريد الإلكتروني
              </Label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-800/50 border-slate-700 text-white placeholder-slate-500 pr-10"
                  placeholder="admin@medical.iq"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200">
                كلمة المرور
              </Label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-800/50 border-slate-700 text-white placeholder-slate-500 pr-10"
                  placeholder="••••"
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-l from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-semibold h-11"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري الدخول...
                </>
              ) : (
                "تسجيل الدخول"
              )}
            </Button>
          </form>
          <div className="mt-6 pt-6 border-t border-slate-800">
            <p className="text-xs text-slate-400 mb-2 font-semibold">حسابات تجريبية:</p>
            <div className="space-y-1 text-xs text-slate-500 font-mono">
              <div>admin@medical.iq — مدير عام</div>
              <div>shatea.mgr@medical.iq — مكتب الشاطئ</div>
              <div>diaar.mgr@medical.iq — مكتب الديار</div>
              <div className="text-slate-400 mt-1">كلمة المرور للجميع: 1234</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

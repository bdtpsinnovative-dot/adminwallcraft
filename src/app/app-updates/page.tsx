"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Users,
} from "lucide-react";

interface ReleaseSettings {
  id: string;
  latest_version_android: string;
  download_url_android: string;
  force_update_android: boolean;
  latest_version_ios: string;
  download_url_ios: string;
  force_update_ios: boolean;
  release_date: string;
  change_log: string;
  updated_at: string | null;
}

interface TrackedDevice {
  id: string;
  device_key: string;
  platform: "android" | "ios" | "web" | "other";
  app_version: string;
  build_number: number | null;
  device_brand: string;
  device_model: string;
  os_version: string;
  last_seen_at: string;
  status: "up_to_date" | "outdated";
}

interface LegacyDeviceHint {
  platform: "android" | "ios" | "unknown";
  device_brand: string;
  device_model: string;
  os_version: string;
  last_seen_at: string | null;
  source: "order_audit" | "fcm_token";
}

interface EmployeeAppRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
  team_name: string | null;
  devices: TrackedDevice[];
  legacyDevices: LegacyDeviceHint[];
  summaryStatus: "up_to_date" | "outdated" | "legacy_untracked";
}

const SETUP_SQL_SNIPPET = `CREATE TABLE IF NOT EXISTS public.app_release_settings (
    id TEXT PRIMARY KEY DEFAULT 'wallcraft_mobile',
    latest_version_android TEXT NOT NULL DEFAULT '2.1.1',
    download_url_android TEXT NOT NULL DEFAULT 'https://app.wallcraftthailand.com/app-release.apk',
    force_update_android BOOLEAN NOT NULL DEFAULT false,
    latest_version_ios TEXT NOT NULL DEFAULT '2.0.7',
    download_url_ios TEXT NOT NULL DEFAULT 'https://testflight.apple.com/join/BXMvdwVM',
    force_update_ios BOOLEAN NOT NULL DEFAULT false,
    release_date TEXT NOT NULL DEFAULT '2026-10-31',
    change_log TEXT NOT NULL DEFAULT 'แก้ไขการเชื่อมต่อระบบ Production และเพิ่มความเสถียร',
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.app_release_settings (id) VALUES ('wallcraft_mobile') ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_release_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Wallcraft admins manage app release settings" ON public.app_release_settings;
CREATE POLICY "Wallcraft admins manage app release settings" ON public.app_release_settings FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'admin'));
REVOKE ALL ON TABLE public.app_release_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_release_settings TO authenticated;
GRANT ALL ON TABLE public.app_release_settings TO service_role;

CREATE TABLE IF NOT EXISTS public.user_app_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    device_key TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web', 'other')),
    app_version TEXT NOT NULL DEFAULT '',
    build_number INTEGER,
    device_brand TEXT NOT NULL DEFAULT '',
    device_model TEXT NOT NULL DEFAULT '',
    os_version TEXT NOT NULL DEFAULT '',
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_app_devices_user_device_unique UNIQUE (user_id, device_key)
);

CREATE INDEX IF NOT EXISTS user_app_devices_last_seen_idx ON public.user_app_devices (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS user_app_devices_platform_version_idx ON public.user_app_devices (platform, app_version);

ALTER TABLE public.user_app_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Wallcraft admins read all app devices" ON public.user_app_devices;
CREATE POLICY "Wallcraft admins read all app devices" ON public.user_app_devices FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'admin'));
DROP POLICY IF EXISTS "Users manage own app devices" ON public.user_app_devices;
CREATE POLICY "Users manage own app devices" ON public.user_app_devices FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
REVOKE ALL ON TABLE public.user_app_devices FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_app_devices TO authenticated;
GRANT ALL ON TABLE public.user_app_devices TO service_role;

NOTIFY pgrst, 'reload schema';`;

function formatDateTimeTh(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function platformBadge(platform: string) {
  if (platform === "ios") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-slate-900 text-white">
        iOS
      </span>
    );
  }
  if (platform === "android") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
        Android
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-600">
      {platform || "-"}
    </span>
  );
}

function UpdateModeSelector({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (force: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center gap-2 ${
          !value
            ? "bg-blue-50 border-blue-500 text-blue-800 shadow-sm"
            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
        }`}
      >
        <Clock size={15} className={!value ? "text-blue-600" : "text-slate-400"} />
        <div>
          <div>ปิดข้ามได้</div>
          <div className="text-[10px] font-normal opacity-80">กดไว้ทีหลังได้</div>
        </div>
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center gap-2 ${
          value
            ? "bg-rose-50 border-rose-500 text-rose-800 shadow-sm"
            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
        }`}
      >
        <ShieldAlert
          size={15}
          className={value ? "text-rose-600" : "text-slate-400"}
        />
        <div>
          <div>บังคับอัปเดต</div>
          <div className="text-[10px] font-normal opacity-80">ห้ามกดปิดข้าม</div>
        </div>
      </button>
    </div>
  );
}

export default function AppUpdatesManagementPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [settings, setSettings] = useState<ReleaseSettings>({
    id: "wallcraft_mobile",
    latest_version_android: "2.1.1",
    download_url_android: "https://app.wallcraftthailand.com/app-release.apk",
    force_update_android: false,
    latest_version_ios: "2.0.7",
    download_url_ios: "https://testflight.apple.com/join/BXMvdwVM",
    force_update_ios: false,
    release_date: new Date().toISOString().slice(0, 10),
    change_log: "",
    updated_at: null,
  });

  const [employees, setEmployees] = useState<EmployeeAppRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "outdated" | "up_to_date" | "legacy_untracked"
  >("all");
  const [platformFilter, setPlatformFilter] = useState<"all" | "android" | "ios">(
    "all"
  );

  const getAuthHeaders = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    return headers;
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/app-updates", {
        headers,
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "โหลดข้อมูลไม่สำเร็จ");
      }
      setMigrationRequired(Boolean(json.migrationRequired));
      if (json.settings) setSettings(json.settings);
      setEmployees(Array.isArray(json.employees) ? json.employees : []);
    } catch (err: any) {
      setBanner({
        type: "error",
        text: err?.message || "ไม่สามารถโหลดข้อมูลได้",
      });
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setBanner(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/app-updates", {
        method: "PUT",
        headers,
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "บันทึกการตั้งค่าไม่สำเร็จ");
      }
      if (json.settings) setSettings(json.settings);
      setBanner({
        type: "success",
        text: "บันทึกเวอร์ชันล่าสุดและ URL อัปเดตเรียบร้อยแล้ว — แอปมือถือจะใช้ค่านี้ทันทีเมื่อเปิดแอป",
      });
      await fetchData();
    } catch (err: any) {
      setBanner({
        type: "error",
        text: err?.message || "เกิดข้อผิดพลาดในการบันทึก",
      });
    } finally {
      setSaving(false);
    }
  };

  const copySql = async () => {
    await navigator.clipboard.writeText(SETUP_SQL_SNIPPET);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const counts = useMemo(() => {
    let upToDate = 0;
    let outdated = 0;
    let untracked = 0;
    for (const emp of employees) {
      if (emp.summaryStatus === "up_to_date") upToDate++;
      else if (emp.summaryStatus === "outdated") outdated++;
      else untracked++;
    }
    return { total: employees.length, upToDate, outdated, untracked };
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return employees.filter((emp) => {
      if (statusFilter !== "all" && emp.summaryStatus !== statusFilter) {
        return false;
      }

      const activePlatforms = [
        ...emp.devices.map((d) => d.platform),
        ...emp.legacyDevices.map((d) => d.platform),
      ];
      if (platformFilter !== "all" && !activePlatforms.includes(platformFilter)) {
        return false;
      }

      if (!q) return true;
      const deviceText = [
        ...emp.devices.map(
          (d) =>
            `${d.platform} ${d.device_brand} ${d.device_model} ${d.os_version} ${d.app_version}`
        ),
        ...emp.legacyDevices.map(
          (d) => `${d.platform} ${d.device_brand} ${d.device_model} ${d.os_version}`
        ),
      ].join(" ");

      const haystack = `${emp.full_name} ${emp.email} ${emp.team_name || ""} ${deviceText}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [employees, statusFilter, platformFilter, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-100">
            <Smartphone size={24} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900">
              จัดการอัปเดตแอป & ติดตามอุปกรณ์พนักงาน
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              กำหนดเลขเวอร์ชัน, วาง URL ไฟล์อัปเดต, ตั้งค่าปิดข้ามได้/บังคับอัปเดต และตรวจดูว่าใครอัปเดตหรือใช้อุปกรณ์รุ่นไหนอยู่
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void fetchData()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-bold transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          รีเฟรชข้อมูล
        </button>
      </div>

      {/* SQL Migration Notice (shown only when tables do not exist yet) */}
      {migrationRequired && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-2.5 text-amber-900">
              <AlertTriangle size={20} className="shrink-0 mt-0.5 text-amber-600" />
              <div>
                <div className="font-extrabold text-sm">
                  ยังไม่ได้สร้างตารางเก็บการตั้งค่าอัปเดตและประวัติอุปกรณ์ใน Supabase
                </div>
                <div className="text-xs text-amber-800 mt-0.5">
                  คัดลอกคำสั่ง SQL ด้านล่างไปวางใน Supabase SQL Editor แล้วกด Run 1 ครั้ง จากนั้นกดรีเฟรชหน้านี้ได้เลยครับ
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={copySql}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0"
            >
              <Copy size={14} />
              {copiedSql ? "คัดลอก SQL แล้ว!" : "คัดลอก SQL"}
            </button>
          </div>
          <pre className="text-[11px] leading-relaxed bg-slate-900 text-emerald-300 p-3.5 rounded-xl overflow-x-auto max-h-48">
            {SETUP_SQL_SNIPPET}
          </pre>
        </div>
      )}

      {banner && (
        <div
          className={`rounded-2xl px-4 py-3.5 border text-sm font-semibold flex items-center gap-2.5 ${
            banner.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {banner.type === "success" ? (
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle size={18} className="text-rose-600 shrink-0" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      {/* Release Configuration Form */}
      <form
        onSubmit={handleSaveSettings}
        className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-sm space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-blue-600" />
            <h2 className="text-base font-extrabold text-slate-900">
              ตั้งค่าเวอร์ชันล่าสุด & ลิงก์สำหรับอัปเดต (Live API)
            </h2>
          </div>
          {settings.updated_at && (
            <span className="text-xs text-slate-400">
              บันทึกล่าสุด: {formatDateTimeTh(settings.updated_at)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Android Card */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-emerald-900">
                Android (APK / OTA Auto-Install)
              </span>
              {platformBadge("android")}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                เวอร์ชันล่าสุด (Android)
              </label>
              <input
                type="text"
                required
                placeholder="เช่น 2.1.2"
                value={settings.latest_version_android}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    latest_version_android: e.target.value,
                  }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                URL ไฟล์ APK สำหรับดาวน์โหลด
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  required
                  placeholder="https://app.wallcraftthailand.com/app-release.apk"
                  value={settings.download_url_android}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      download_url_android: e.target.value,
                    }))
                  }
                  className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {settings.download_url_android && (
                  <a
                    href={settings.download_url_android}
                    target="_blank"
                    rel="noreferrer"
                    title="เปิดดู URL"
                    className="px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                รูปแบบการแจ้งเตือนเมื่อมีเวอร์ชันใหม่ (Android)
              </label>
              <UpdateModeSelector
                value={settings.force_update_android}
                onChange={(force) =>
                  setSettings((prev) => ({
                    ...prev,
                    force_update_android: force,
                  }))
                }
              />
            </div>
          </div>

          {/* iOS Card */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-slate-900">
                iOS (TestFlight / App Store URL)
              </span>
              {platformBadge("ios")}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                เวอร์ชันล่าสุด (iOS)
              </label>
              <input
                type="text"
                required
                placeholder="เช่น 2.1.2"
                value={settings.latest_version_ios}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    latest_version_ios: e.target.value,
                  }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                URL สำหรับอัปเดต iOS (เช่น ลิงก์ TestFlight)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  required
                  placeholder="https://testflight.apple.com/join/..."
                  value={settings.download_url_ios}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      download_url_ios: e.target.value,
                    }))
                  }
                  className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {settings.download_url_ios && (
                  <a
                    href={settings.download_url_ios}
                    target="_blank"
                    rel="noreferrer"
                    title="เปิดดู URL"
                    className="px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                รูปแบบการแจ้งเตือนเมื่อมีเวอร์ชันใหม่ (iOS)
              </label>
              <UpdateModeSelector
                value={settings.force_update_ios}
                onChange={(force) =>
                  setSettings((prev) => ({ ...prev, force_update_ios: force }))
                }
              />
            </div>
          </div>
        </div>

        {/* Changelog + Release Date + Save */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              วันที่ปล่อยเวอร์ชัน (Release Date)
            </label>
            <input
              type="date"
              value={settings.release_date}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  release_date: e.target.value,
                }))
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ข้อความแจ้งพนักงาน (Change Log)
            </label>
            <input
              type="text"
              placeholder="เช่น อัปเดตหน้า PI Records ใหม่ และเพิ่มระบบตรวจสอบความเสถียร"
              value={settings.change_log}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, change_log: e.target.value }))
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={saving || migrationRequired}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-100 transition-all disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            บันทึกการตั้งค่าอัปเดต
          </button>
        </div>
      </form>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === "all"
              ? "bg-slate-900 text-white border-slate-900 shadow-md"
              : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold opacity-75">
            <span>พนักงานทั้งหมด</span>
            <Users size={15} />
          </div>
          <div className="text-2xl font-black mt-1">{counts.total}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("up_to_date")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === "up_to_date"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
              : "bg-white text-slate-800 border-slate-200 hover:bg-emerald-50"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold opacity-75">
            <span>อัปเดตล่าสุดแล้ว</span>
            <CheckCircle2 size={15} />
          </div>
          <div className="text-2xl font-black mt-1">{counts.upToDate}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("outdated")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === "outdated"
              ? "bg-amber-500 text-white border-amber-500 shadow-md"
              : "bg-white text-slate-800 border-slate-200 hover:bg-amber-50"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold opacity-75">
            <span>เวอร์ชันเก่า (รออัปเดต)</span>
            <AlertTriangle size={15} />
          </div>
          <div className="text-2xl font-black mt-1">{counts.outdated}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("legacy_untracked")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === "legacy_untracked"
              ? "bg-slate-700 text-white border-slate-700 shadow-md"
              : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold opacity-75">
            <span>ยังไม่เคยเปิดเวอร์ชันใหม่</span>
            <Clock size={15} />
          </div>
          <div className="text-2xl font-black mt-1">{counts.untracked}</div>
        </button>
      </div>

      {/* Employee Device & App Version Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, อีเมล, ทีม, รุ่นมือถือ หรือเลขเวอร์ชัน..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(["all", "android", "ios"] as const).map((plat) => (
              <button
                key={plat}
                type="button"
                onClick={() => setPlatformFilter(plat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                  platformFilter === plat
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {plat === "all"
                  ? "ทุกแพลตฟอร์ม"
                  : plat === "android"
                    ? "Android"
                    : "iOS"}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">พนักงาน / ทีม</th>
                <th className="px-5 py-3.5">แพลตฟอร์ม & รุ่นอุปกรณ์</th>
                <th className="px-5 py-3.5">เวอร์ชันแอปที่ใช้</th>
                <th className="px-5 py-3.5">สถานะอัปเดต</th>
                <th className="px-5 py-3.5">เปิดใช้งานล่าสุด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                    กำลังโหลดข้อมูลพนักงานและอุปกรณ์...
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                    ไม่พบรายการที่ตรงกับตัวกรอง
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/70 align-top">
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900">
                        {emp.full_name}
                      </div>
                      <div className="text-xs text-slate-500">{emp.email || "-"}</div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {emp.team_name && (
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-semibold">
                            {emp.team_name}
                          </span>
                        )}
                        {emp.role === "admin" && (
                          <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[11px] font-semibold">
                            Admin
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      {emp.devices.length > 0 ? (
                        <div className="space-y-2">
                          {emp.devices.map((dev) => {
                            const deviceName = [dev.device_brand, dev.device_model]
                              .filter(Boolean)
                              .join(" ");
                            return (
                              <div key={dev.id} className="flex flex-wrap items-center gap-2">
                                {platformBadge(dev.platform)}
                                <span className="font-semibold text-slate-800">
                                  {deviceName || "ไม่ทราบรุ่น"}
                                </span>
                                {dev.os_version && (
                                  <span className="text-xs text-slate-500">
                                    (OS {dev.os_version})
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : emp.legacyDevices.length > 0 ? (
                        <div className="space-y-1.5">
                          {emp.legacyDevices.map((hint, idx) => {
                            const modelLabel = [hint.device_brand, hint.device_model]
                              .filter(Boolean)
                              .join(" ");
                            return (
                              <div key={idx} className="flex flex-wrap items-center gap-2">
                                {platformBadge(hint.platform)}
                                <span className="text-slate-600 text-xs font-medium">
                                  {modelLabel
                                    ? `${modelLabel}${hint.os_version ? ` (OS ${hint.os_version})` : ""} · จากประวัติเดิม`
                                    : "ตรวจพบจาก FCM Token เดิม"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">ยังไม่มีข้อมูลอุปกรณ์</span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      {emp.devices.length > 0 ? (
                        <div className="space-y-2">
                          {emp.devices.map((dev) => (
                            <div key={dev.id} className="font-mono text-xs font-bold text-slate-800">
                              v{dev.app_version}
                              {dev.build_number ? (
                                <span className="text-slate-400 font-normal">
                                  {" "}
                                  (build {dev.build_number})
                                </span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          แอปเก่าก่อนระบบติดตาม
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      {emp.devices.length > 0 ? (
                        <div className="space-y-2">
                          {emp.devices.map((dev) =>
                            dev.status === "up_to_date" ? (
                              <div key={dev.id}>
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                  <CheckCircle2 size={13} />
                                  อัปเดตล่าสุดแล้ว
                                </span>
                              </div>
                            ) : (
                              <div key={dev.id}>
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                                  <AlertTriangle size={13} />
                                  เวอร์ชันเก่า (ยังไม่อัปเดต)
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                          <Clock size={13} />
                          รออัปเดตเข้าระบบเช็ก
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-xs text-slate-600">
                      {emp.devices.length > 0 ? (
                        <div className="space-y-2">
                          {emp.devices.map((dev) => (
                            <div key={dev.id}>{formatDateTimeTh(dev.last_seen_at)}</div>
                          ))}
                        </div>
                      ) : emp.legacyDevices[0]?.last_seen_at ? (
                        <span className="text-slate-400">
                          {formatDateTimeTh(emp.legacyDevices[0].last_seen_at)}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

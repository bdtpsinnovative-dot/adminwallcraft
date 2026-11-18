"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  RefreshCw,
  Search,
  UserCheck,
  Users,
  X,
} from "lucide-react";

interface CallLogItem {
  id: string;
  user_id: string;
  sale_name: string;
  contact_id: string | null;
  phone_normalized: string;
  phone_display: string;
  contact_name_snapshot: string;
  company_name_snapshot: string;
  contact_category_snapshot: string;
  call_direction: "incoming" | "outgoing" | "missed";
  call_source: "android_call_log" | "in_app_dial" | "manual";
  started_at: string;
  duration_sec: number;
  outcome: "connected" | "no_answer" | "busy" | "follow_up" | "unknown";
  note: string;
}

interface SalesStat {
  user_id: string;
  sale_name: string;
  totalCalls: number;
  outgoing: number;
  incoming: number;
  missed: number;
  connected: number;
  totalDurationSec: number;
  uniqueCustomersCount: number;
  lastCallAt: string;
}

interface CallSummary {
  totalCalls: number;
  outgoing: number;
  incoming: number;
  missed: number;
  connected: number;
  followUp: number;
  totalDurationSec: number;
  uniqueCustomers: number;
  activeSalesCount: number;
}

const SETUP_SQL_SNIPPET = `CREATE TABLE IF NOT EXISTS public.customer_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.customer_contacts(id) ON DELETE SET NULL,
  phone_normalized TEXT NOT NULL CHECK (char_length(trim(phone_normalized)) > 0),
  phone_display TEXT NOT NULL DEFAULT '',
  contact_name_snapshot TEXT NOT NULL DEFAULT '',
  company_name_snapshot TEXT NOT NULL DEFAULT '',
  contact_category_snapshot TEXT NOT NULL DEFAULT 'general',
  call_direction TEXT NOT NULL CHECK (call_direction IN ('incoming', 'outgoing', 'missed')),
  call_source TEXT NOT NULL DEFAULT 'manual' CHECK (call_source IN ('android_call_log', 'in_app_dial', 'manual')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_sec INTEGER NOT NULL DEFAULT 0 CHECK (duration_sec >= 0),
  outcome TEXT NOT NULL DEFAULT 'connected' CHECK (outcome IN ('connected', 'no_answer', 'busy', 'follow_up', 'unknown')),
  note TEXT NOT NULL DEFAULT '',
  device_call_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_customer_call_logs_user_device_key UNIQUE (user_id, device_call_key)
);

CREATE INDEX IF NOT EXISTS idx_customer_call_logs_user_started ON public.customer_call_logs (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_call_logs_contact_started ON public.customer_call_logs (contact_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_call_logs_phone_started ON public.customer_call_logs (phone_normalized, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_call_logs_started_at ON public.customer_call_logs (started_at DESC);

CREATE OR REPLACE FUNCTION public.set_customer_call_logs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_call_logs_updated_at ON public.customer_call_logs;
CREATE TRIGGER trg_customer_call_logs_updated_at
  BEFORE UPDATE ON public.customer_call_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_customer_call_logs_updated_at();

ALTER TABLE public.customer_call_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.customer_call_logs FROM anon;
REVOKE ALL ON TABLE public.customer_call_logs FROM public;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_call_logs TO authenticated;
GRANT ALL ON TABLE public.customer_call_logs TO service_role;

DROP POLICY IF EXISTS customer_call_logs_select_authenticated ON public.customer_call_logs;
CREATE POLICY customer_call_logs_select_authenticated
  ON public.customer_call_logs
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS customer_call_logs_insert_own ON public.customer_call_logs;
CREATE POLICY customer_call_logs_insert_own
  ON public.customer_call_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS customer_call_logs_update_own ON public.customer_call_logs;
CREATE POLICY customer_call_logs_update_own
  ON public.customer_call_logs
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS customer_call_logs_delete_admin ON public.customer_call_logs;
CREATE POLICY customer_call_logs_delete_admin
  ON public.customer_call_logs
  FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
    )
  );

NOTIFY pgrst, 'reload schema';`;

function formatDurationTh(seconds: number): string {
  const s = Math.max(0, Math.trunc(seconds || 0));
  if (s === 0) return "0 วิ";
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  if (mins === 0) return `${rem} วิ`;
  return `${mins} น. ${rem} วิ`;
}

function formatDateTimeTh(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("th-TH", {
    year: "2-digit",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDirectionMeta(dir: string) {
  if (dir === "outgoing") {
    return {
      label: "โทรออก",
      cls: "bg-blue-50 text-blue-700 border-blue-200",
      Icon: PhoneOutgoing,
    };
  }
  if (dir === "missed") {
    return {
      label: "ไม่ได้รับ",
      cls: "bg-rose-50 text-rose-700 border-rose-200",
      Icon: PhoneMissed,
    };
  }
  return {
    label: "โทรเข้า",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Icon: PhoneIncoming,
  };
}

function getOutcomeLabel(outcome: string): { label: string; cls: string } {
  switch (outcome) {
    case "connected":
      return { label: "คุยสำเร็จ", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "follow_up":
      return { label: "นัดติดตาม", cls: "bg-amber-50 text-amber-800 border-amber-200" };
    case "no_answer":
      return { label: "ไม่รับสาย", cls: "bg-slate-100 text-slate-600 border-slate-200" };
    case "busy":
      return { label: "สายไม่ว่าง", cls: "bg-orange-50 text-orange-700 border-orange-200" };
    default:
      return { label: "ไม่ระบุ", cls: "bg-slate-100 text-slate-600 border-slate-200" };
  }
}

function getSourceLabel(src: string): string {
  if (src === "android_call_log") return "ซิงค์อัตโนมัติ (Android)";
  if (src === "in_app_dial") return "โทรจากแอป";
  return "บันทึกเอง";
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = value == null ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

export default function CustomerCallLogsPage() {
  const [loading, setLoading] = useState(true);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [days, setDays] = useState<number>(30);
  const [logs, setLogs] = useState<CallLogItem[]>([]);
  const [salesStats, setSalesStats] = useState<SalesStat[]>([]);
  const [summary, setSummary] = useState<CallSummary>({
    totalCalls: 0,
    outgoing: 0,
    incoming: 0,
    missed: 0,
    connected: 0,
    followUp: 0,
    totalDurationSec: 0,
    uniqueCustomers: 0,
    activeSalesCount: 0,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState<string>("all");
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");

  const getAuthHeaders = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    return headers;
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/call-logs?days=${days}`, {
        headers,
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "โหลดประวัติการโทรไม่สำเร็จ");

      setMigrationRequired(Boolean(json.migrationRequired));
      setLogs(Array.isArray(json.logs) ? json.logs : []);
      setSalesStats(Array.isArray(json.salesStats) ? json.salesStats : []);
      if (json.summary) setSummary(json.summary);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }, [days, getAuthHeaders]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return logs.filter((row) => {
      if (selectedSaleId !== "all" && row.user_id !== selectedSaleId) return false;
      if (directionFilter !== "all" && row.call_direction !== directionFilter) return false;
      if (outcomeFilter !== "all" && row.outcome !== outcomeFilter) return false;
      if (!q) return true;
      const hay = [
        row.sale_name,
        row.phone_normalized,
        row.phone_display,
        row.contact_name_snapshot,
        row.company_name_snapshot,
        row.note,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [logs, searchQuery, selectedSaleId, directionFilter, outcomeFilter]);

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SETUP_SQL_SNIPPET);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    } catch {
      setErrorMsg("คัดลอก SQL ไม่สำเร็จ");
    }
  };

  const handleExportCsv = () => {
    const headers = [
      "วันเวลา",
      "เซลล์",
      "ชื่อลูกค้า",
      "บริษัท",
      "เบอร์โทร",
      "ทิศทางสาย",
      "ผลคุย",
      "ระยะเวลา(วินาที)",
      "โน้ต",
      "แหล่งที่มา",
    ];
    const lines = [
      headers.map(escapeCsvCell).join(","),
      ...filteredLogs.map((r) =>
        [
          formatDateTimeTh(r.started_at),
          r.sale_name,
          r.contact_name_snapshot,
          r.company_name_snapshot,
          r.phone_display || r.phone_normalized,
          getDirectionMeta(r.call_direction).label,
          getOutcomeLabel(r.outcome).label,
          r.duration_sec,
          r.note,
          getSourceLabel(r.call_source),
        ]
          .map(escapeCsvCell)
          .join(",")
      ),
    ];

    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wallcraft_call_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[1440px] mx-auto space-y-6 pb-14">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-100 shrink-0">
            <PhoneCall size={24} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900">
              ประวัติโทรคุยกับลูกค้า (Sales Call Tracking)
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              ติดตามว่าเซลล์แต่ละคนโทรคุยกับลูกค้าคนไหนบ้าง กี่นาที พร้อมบันทึกหลังวางสาย (ซิงค์เฉพาะเบอร์ในสมุดเบอร์กลาง)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-bold text-slate-700"
          >
            <option value={7}>ย้อนหลัง 7 วัน</option>
            <option value={30}>ย้อนหลัง 30 วัน</option>
            <option value={90}>ย้อนหลัง 90 วัน</option>
            <option value={365}>ย้อนหลัง 1 ปี</option>
          </select>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredLogs.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold disabled:opacity-40"
          >
            <Download size={16} />
            ส่งออก CSV
          </button>

          <button
            type="button"
            onClick={() => void fetchData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            รีเฟรช
          </button>
        </div>
      </div>

      {/* SQL Migration Notice */}
      {migrationRequired && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-2.5 text-amber-900">
              <AlertTriangle size={20} className="shrink-0 mt-0.5 text-amber-600" />
              <div>
                <div className="font-extrabold text-sm">
                  ยังไม่ได้สร้างตาราง <code className="px-1.5 py-0.5 bg-amber-100 rounded">public.customer_call_logs</code> ใน Supabase
                </div>
                <div className="text-xs text-amber-800 mt-1">
                  คัดลอกคำสั่ง SQL ด้านล่างไปวางใน Supabase SQL Editor แล้วกด Run 1 ครั้ง จากนั้นกดรีเฟรชหน้านี้ครับ
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleCopySql()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0"
            >
              <Copy size={14} />
              {copiedSql ? "คัดลอก SQL แล้ว!" : "คัดลอก SQL"}
            </button>
          </div>
          <pre className="text-[11px] leading-relaxed bg-slate-900 text-emerald-300 p-3.5 rounded-xl overflow-x-auto max-h-52">
            {SETUP_SQL_SNIPPET}
          </pre>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-2xl px-4 py-3.5 border bg-rose-50 border-rose-200 text-rose-800 text-sm font-semibold flex items-center justify-between">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="text-xs font-bold text-slate-500">สายลูกค้าทั้งหมด</div>
          <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
            {summary.totalCalls}
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-blue-200 bg-white shadow-sm">
          <div className="text-xs font-bold text-blue-700">โทรออกหาลูกค้า</div>
          <div className="text-2xl font-black text-blue-600 mt-1 tabular-nums">
            {summary.outgoing}
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-emerald-200 bg-white shadow-sm">
          <div className="text-xs font-bold text-emerald-700">ลูกค้าโทรเข้า</div>
          <div className="text-2xl font-black text-emerald-600 mt-1 tabular-nums">
            {summary.incoming}
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-rose-200 bg-white shadow-sm">
          <div className="text-xs font-bold text-rose-700">ไม่ได้รับสาย</div>
          <div className="text-2xl font-black text-rose-600 mt-1 tabular-nums">
            {summary.missed}
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-purple-200 bg-white shadow-sm">
          <div className="text-xs font-bold text-purple-700">เวลาคุยรวม</div>
          <div className="text-2xl font-black text-purple-600 mt-1 tabular-nums">
            {Math.round(summary.totalDurationSec / 60)} น.
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-amber-200 bg-white shadow-sm">
          <div className="text-xs font-bold text-amber-800">ลูกค้าที่คุยแล้ว</div>
          <div className="text-2xl font-black text-amber-600 mt-1 tabular-nums">
            {summary.uniqueCustomers}
          </div>
        </div>
      </div>

      {/* Per-Salesperson Cards */}
      {salesStats.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900">
              <Users size={16} className="text-blue-600" />
              สรุปรายเซลล์ (คลิกชื่อเพื่อกรองตารางด้านล่าง)
            </div>
            {selectedSaleId !== "all" && (
              <button
                type="button"
                onClick={() => setSelectedSaleId("all")}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                แสดงทุกเซลล์
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {salesStats.map((s) => (
              <button
                key={s.user_id}
                type="button"
                onClick={() =>
                  setSelectedSaleId((prev) => (prev === s.user_id ? "all" : s.user_id))
                }
                className={`text-left p-3.5 rounded-xl border transition-all ${
                  selectedSaleId === s.user_id
                    ? "border-blue-500 bg-blue-50/70 ring-2 ring-blue-100"
                    : "border-slate-200 hover:border-blue-300 bg-slate-50/50"
                }`}
              >
                <div className="font-extrabold text-slate-900 text-sm truncate">{s.sale_name}</div>
                <div className="text-xs text-slate-600 mt-1">
                  คุย <strong>{s.totalCalls}</strong> สาย •{" "}
                  <strong>{s.uniqueCustomersCount}</strong> ราย •{" "}
                  <strong>{formatDurationTh(s.totalDurationSec)}</strong>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  โทรออก {s.outgoing} | เข้า {s.incoming} | ล่าสุด {formatDateTimeTh(s.lastCallAt)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <Search
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อเซลล์, ชื่อลูกค้า, บริษัท, เบอร์โทร, หรือโน้ตการคุย..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-bold text-slate-700"
            >
              <option value="all">ทุกทิศทางสาย</option>
              <option value="outgoing">โทรออก</option>
              <option value="incoming">โทรเข้า</option>
              <option value="missed">ไม่ได้รับ</option>
            </select>

            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-bold text-slate-700"
            >
              <option value="all">ทุกผลคุย</option>
              <option value="connected">คุยสำเร็จ</option>
              <option value="follow_up">นัดติดตาม</option>
              <option value="no_answer">ไม่รับสาย</option>
              <option value="busy">สายไม่ว่าง</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">กำลังโหลดประวัติการโทร...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            ยังไม่มีประวัติการโทรในช่วงเวลานี้
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase">
                  <th className="py-3 pl-4 pr-3">วันเวลา</th>
                  <th className="py-3 px-3">พนักงานขาย</th>
                  <th className="py-3 px-3">ลูกค้า / บริษัท / เบอร์โทร</th>
                  <th className="py-3 px-3">สาย & ระยะเวลา</th>
                  <th className="py-3 px-3">ผลคุย & โน้ต</th>
                  <th className="py-3 pl-3 pr-4 text-right">แหล่งบันทึก</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredLogs.map((row) => {
                  const dir = getDirectionMeta(row.call_direction);
                  const DirIcon = dir.Icon;
                  const out = getOutcomeLabel(row.outcome);

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 align-top">
                      <td className="py-3.5 pl-4 pr-3 text-xs font-semibold text-slate-700 whitespace-nowrap">
                        {formatDateTimeTh(row.started_at)}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="inline-flex items-center gap-1.5 font-bold text-slate-900">
                          <UserCheck size={14} className="text-blue-600 shrink-0" />
                          <span>{row.sale_name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 space-y-1">
                        <div className="font-bold text-slate-900">
                          {row.contact_name_snapshot || "ไม่ระบุชื่อ"}
                        </div>
                        {row.company_name_snapshot && (
                          <div className="flex items-center gap-1 text-xs text-slate-600">
                            <Building2 size={12} className="text-slate-400 shrink-0" />
                            <span>{row.company_name_snapshot}</span>
                          </div>
                        )}
                        <div className="text-xs font-mono text-slate-500">
                          {row.phone_display || row.phone_normalized}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 space-y-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${dir.cls}`}
                        >
                          <DirIcon size={12} />
                          {dir.label}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-slate-600">
                          <Clock size={12} className="text-slate-400" />
                          <span>{formatDurationTh(row.duration_sec)}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 space-y-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${out.cls}`}
                        >
                          <CheckCircle2 size={11} />
                          {out.label}
                        </span>
                        {row.note && (
                          <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 max-w-md">
                            {row.note}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 pl-3 pr-4 text-right text-xs text-slate-500 whitespace-nowrap">
                        {getSourceLabel(row.call_source)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  AlertTriangle,
  Ban,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  FileWarning,
  FolderKanban,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";

type ReviewStatus = "pending_review" | "verified" | "ignored";

interface CustomerContact {
  id: string;
  phone_normalized: string;
  phone_display: string;
  display_name: string;
  contact_category: string;
  company_name: string;
  project_names: string[];
  alternate_names: string[];
  raw_phones: string[];
  source_tables: string[];
  owner_sale_id: string | null;
  owner_sale_name: string;
  order_count: number;
  last_order_at: string | null;
  review_status: ReviewStatus;
  manually_edited: boolean;
  notes: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface InvalidOrderEntry {
  order_id: string;
  customer_name: string;
  company_name: string;
  raw_phone: string;
  reason: string;
  owner_sale_name: string;
  created_at: string | null;
}

interface ContactSummary {
  total: number;
  pendingReview: number;
  verified: number;
  ignored: number;
  multiNameCount: number;
  missingNameCount: number;
  invalidOrderPhoneCount: number;
  byCategory: Record<string, number>;
}

const SETUP_SQL_SNIPPET = `CREATE TABLE IF NOT EXISTS public.customer_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_normalized TEXT NOT NULL UNIQUE CHECK (char_length(trim(phone_normalized)) > 0),
  phone_display TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  contact_category TEXT NOT NULL DEFAULT 'general',
  company_name TEXT NOT NULL DEFAULT '',
  project_names TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  alternate_names TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  raw_phones TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  source_tables TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  owner_sale_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  owner_sale_name TEXT NOT NULL DEFAULT '',
  order_count INTEGER NOT NULL DEFAULT 0 CHECK (order_count >= 0),
  last_order_at TIMESTAMPTZ,
  review_status TEXT NOT NULL DEFAULT 'pending_review' CHECK (review_status IN ('pending_review', 'verified', 'ignored')),
  manually_edited BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT NOT NULL DEFAULT '',
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_contacts_review_status ON public.customer_contacts (review_status);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_category ON public.customer_contacts (contact_category);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_owner_sale_id ON public.customer_contacts (owner_sale_id);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_reviewed_by ON public.customer_contacts (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_last_order_at ON public.customer_contacts (last_order_at DESC NULLS LAST);

CREATE OR REPLACE FUNCTION public.set_customer_contacts_updated_at()
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

DROP TRIGGER IF EXISTS trg_customer_contacts_updated_at ON public.customer_contacts;
CREATE TRIGGER trg_customer_contacts_updated_at
  BEFORE UPDATE ON public.customer_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_customer_contacts_updated_at();

ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.customer_contacts FROM anon;
REVOKE ALL ON TABLE public.customer_contacts FROM public;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_contacts TO authenticated;
GRANT ALL ON TABLE public.customer_contacts TO service_role;

DROP POLICY IF EXISTS customer_contacts_select_authenticated ON public.customer_contacts;
CREATE POLICY customer_contacts_select_authenticated
  ON public.customer_contacts
  FOR SELECT
  TO authenticated
  USING (
    review_status = 'verified'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS customer_contacts_insert_admin ON public.customer_contacts;
CREATE POLICY customer_contacts_insert_admin
  ON public.customer_contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS customer_contacts_update_admin ON public.customer_contacts;
CREATE POLICY customer_contacts_update_admin
  ON public.customer_contacts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS customer_contacts_delete_admin ON public.customer_contacts;
CREATE POLICY customer_contacts_delete_admin
  ON public.customer_contacts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
    )
  );

NOTIFY pgrst, 'reload schema';`;

const CATEGORY_OPTIONS: Array<{ value: string; label: string; badgeClass: string }> = [
  { value: "general", label: "ลูกค้าทั่วไป", badgeClass: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "interior", label: "Interior", badgeClass: "bg-purple-50 text-purple-700 border-purple-200" },
  { value: "architect", label: "Architect", badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { value: "developer", label: "Developer", badgeClass: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "contractor", label: "Contractor", badgeClass: "bg-amber-50 text-amber-800 border-amber-200" },
  { value: "office", label: "Office", badgeClass: "bg-cyan-50 text-cyan-800 border-cyan-200" },
  { value: "vip", label: "VIP", badgeClass: "bg-rose-50 text-rose-700 border-rose-200" },
  { value: "team", label: "ทีมงาน WallCraft", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "other", label: "อื่นๆ", badgeClass: "bg-slate-100 text-slate-600 border-slate-200" },
];

function getCategoryMeta(category: string) {
  return (
    CATEGORY_OPTIONS.find((opt) => opt.value === category) || {
      value: category || "general",
      label: category || "ลูกค้าทั่วไป",
      badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    }
  );
}

function getSourceLabel(src: string): string {
  if (src === "orders") return "Orders";
  if (src === "order_item_projects") return "Projects";
  if (src === "profiles") return "Team";
  if (src === "manual") return "เพิ่มเอง";
  return src;
}

function formatDateTh(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("th-TH", {
    year: "2-digit",
    month: "short",
    day: "numeric",
  });
}

function formatCallerIdPreview(displayName: string, companyName: string): string {
  const dn = displayName.trim();
  const cn = companyName.trim();
  if (!dn && !cn) return "ไม่ระบุชื่อ";
  if (dn && cn && dn !== cn && !dn.includes(cn)) {
    return `${dn} • ${cn}`;
  }
  return dn || cn;
}

function getPendingReviewReasons(c: CustomerContact): string[] {
  const reasons: string[] = [];
  const name = c.display_name.trim();
  if (!name) {
    reasons.push("ยังไม่มีชื่อผู้ติดต่อ");
  } else if (name.length < 3) {
    reasons.push("ชื่อสั้น (< 3 ตัวอักษร)");
  }
  if ((c.alternate_names || []).length > 1) {
    reasons.push(`ใช้ซ้ำ ${c.alternate_names.length} ชื่อ (เลือกชื่อหลัก)`);
  }
  if (c.contact_category === "team" || (c.source_tables || []).includes("profiles")) {
    reasons.push("เบอร์ทีมงานภายใน");
  }
  if ((c.raw_phones || []).some((rp) => /[,/;|&\n]/.test(rp) && /[a-zA-Zก-๙]/.test(rp))) {
    reasons.push("ช่องเดิมมีหลายเบอร์และข้อความ");
  }
  return reasons;
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = value == null ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

export default function CustomerContactsPage() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [invalidEntries, setInvalidEntries] = useState<InvalidOrderEntry[]>([]);
  const [summary, setSummary] = useState<ContactSummary>({
    total: 0,
    pendingReview: 0,
    verified: 0,
    ignored: 0,
    multiNameCount: 0,
    missingNameCount: 0,
    invalidOrderPhoneCount: 0,
    byCategory: {},
  });

  // Filters & tabs
  const [activeTab, setActiveTab] = useState<"contacts" | "invalid_orders">("contacts");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ReviewStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [onlyMultiName, setOnlyMultiName] = useState(false);
  const [onlyMissingName, setOnlyMissingName] = useState(false);
  const [invalidSearchQuery, setInvalidSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Edit modal state
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(null);
  const [editForm, setEditForm] = useState({
    phone: "",
    display_name: "",
    company_name: "",
    contact_category: "general",
    owner_sale_name: "",
    review_status: "pending_review" as ReviewStatus,
    notes: "",
  });

  // Add new contact modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    phone: "",
    display_name: "",
    company_name: "",
    contact_category: "general",
    owner_sale_name: "",
    review_status: "verified" as ReviewStatus,
    notes: "",
  });

  const hasAutoSyncedOnEmpty = useRef(false);

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
      const res = await fetch("/api/customer-contacts", {
        headers,
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "โหลดข้อมูลเบอร์ลูกค้าไม่สำเร็จ");
      }

      const nextContacts: CustomerContact[] = Array.isArray(json.contacts) ? json.contacts : [];
      const isMigrationNeeded = Boolean(json.migrationRequired);

      setMigrationRequired(isMigrationNeeded);
      setPreviewMode(Boolean(json.previewMode));
      setContacts(nextContacts);
      setInvalidEntries(Array.isArray(json.invalidOrderEntries) ? json.invalidOrderEntries : []);
      if (json.summary) {
        setSummary(json.summary);
      }
      setSelectedIds(new Set());

      // Auto-populate once right after table migration is applied for the first time
      if (!isMigrationNeeded && nextContacts.length === 0 && !hasAutoSyncedOnEmpty.current) {
        hasAutoSyncedOnEmpty.current = true;
        setSyncing(true);
        try {
          const syncRes = await fetch("/api/customer-contacts/sync", {
            method: "POST",
            headers,
          });
          const syncJson = await syncRes.json();
          if (syncRes.ok && syncJson.success) {
            setBanner({
              type: "success",
              text: `นำเข้าข้อมูลเบอร์เรียบร้อย ${syncJson.inserted} เบอร์ (ยืนยันอัตโนมัติที่มั่นใจ ${syncJson.verifiedCount ?? 0} เบอร์, รอรีเช็ก ${syncJson.pendingReviewCount ?? 0} เบอร์)`,
            });
            const refreshRes = await fetch("/api/customer-contacts", { headers, cache: "no-store" });
            const refreshJson = await refreshRes.json();
            if (refreshRes.ok) {
              setContacts(Array.isArray(refreshJson.contacts) ? refreshJson.contacts : []);
              setInvalidEntries(
                Array.isArray(refreshJson.invalidOrderEntries) ? refreshJson.invalidOrderEntries : []
              );
              if (refreshJson.summary) setSummary(refreshJson.summary);
            }
          }
        } finally {
          setSyncing(false);
        }
      }
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการโหลดข้อมูล",
      });
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SETUP_SQL_SNIPPET);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    } catch {
      setBanner({ type: "error", text: "คัดลอกไม่สำเร็จ กรุณากด Ctrl+C จากกล่อง SQL ด้านบน" });
    }
  };

  const handleSyncContacts = async () => {
    setSyncing(true);
    setBanner(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/customer-contacts/sync", {
        method: "POST",
        headers,
      });
      const json = await res.json();
      if (!res.ok) {
        if (json?.migrationRequired) {
          setMigrationRequired(true);
        }
        throw new Error(json?.error || "ซิงค์ข้อมูลไม่สำเร็จ");
      }

      setBanner({
        type: "success",
        text: `ซิงค์สำเร็จ: เพิ่มใหม่ ${json.inserted} เบอร์, อัปเดต ${json.updated} เบอร์ | ยืนยันแล้ว ${json.verifiedCount ?? "-"} เบอร์, รอรีเช็ก ${json.pendingReviewCount ?? "-"} เบอร์`,
      });
      await fetchData();
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "ซิงค์ข้อมูลไม่สำเร็จ",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleQuickStatus = async (contact: CustomerContact, nextStatus: ReviewStatus) => {
    if (previewMode) {
      setBanner({
        type: "error",
        text: "ขณะนี้กำลังดูตัวอย่าง Live จาก Orders — กรุณารันคำสั่ง SQL สร้างตาราง customer_contacts ด้านบน 1 ครั้งก่อนบันทึกสถานะ",
      });
      return;
    }

    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/customer-contacts", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: contact.id, review_status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "เปลี่ยนสถานะไม่สำเร็จ");

      const updatedRow: CustomerContact = json.contact;
      setContacts((prev) => prev.map((row) => (row.id === updatedRow.id ? updatedRow : row)));
      setSummary((prev) => {
        const next = { ...prev };
        if (contact.review_status === "verified") next.verified = Math.max(0, next.verified - 1);
        else if (contact.review_status === "ignored") next.ignored = Math.max(0, next.ignored - 1);
        else next.pendingReview = Math.max(0, next.pendingReview - 1);

        if (nextStatus === "verified") next.verified += 1;
        else if (nextStatus === "ignored") next.ignored += 1;
        else next.pendingReview += 1;
        return next;
      });
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "เปลี่ยนสถานะไม่สำเร็จ",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkStatus = async (nextStatus: ReviewStatus) => {
    if (previewMode || selectedIds.size === 0) return;
    setSaving(true);
    setBanner(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/customer-contacts", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          review_status: nextStatus,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "อัปเดตแบบกลุ่มไม่สำเร็จ");

      const statusText =
        nextStatus === "verified" ? "ยืนยันแล้ว" : nextStatus === "ignored" ? "ไม่ใช้งาน" : "รอรีเช็ก";
      setBanner({
        type: "success",
        text: `เปลี่ยนสถานะ ${selectedIds.size} รายการ เป็น "${statusText}" เรียบร้อยแล้ว`,
      });
      await fetchData();
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "อัปเดตแบบกลุ่มไม่สำเร็จ",
      });
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (contact: CustomerContact) => {
    setEditingContact(contact);
    setEditForm({
      phone: contact.phone_display || contact.phone_normalized,
      display_name: contact.display_name || "",
      company_name: contact.company_name || "",
      contact_category: contact.contact_category || "general",
      owner_sale_name: contact.owner_sale_name || "",
      review_status: contact.review_status,
      notes: contact.notes || "",
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact) return;
    if (previewMode) {
      setBanner({
        type: "error",
        text: "กรุณารันคำสั่ง SQL สร้างตาราง customer_contacts ใน Supabase ก่อนบันทึกการแก้ไขครับ",
      });
      return;
    }

    setSaving(true);
    setBanner(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/customer-contacts", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          id: editingContact.id,
          phone: editForm.phone,
          display_name: editForm.display_name,
          company_name: editForm.company_name,
          contact_category: editForm.contact_category,
          owner_sale_name: editForm.owner_sale_name,
          review_status: editForm.review_status,
          notes: editForm.notes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "บันทึกไม่สำเร็จ");

      setEditingContact(null);
      setBanner({
        type: "success",
        text: `บันทึกข้อมูลเบอร์ ${json.contact?.phone_display || editForm.phone} เรียบร้อยแล้ว`,
      });
      await fetchData();
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "บันทึกไม่สำเร็จ",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContact = async (contact: CustomerContact) => {
    if (previewMode) return;
    const confirmed = window.confirm(
      `ต้องการลบเบอร์ ${contact.phone_display} (${contact.display_name || "ไม่มีชื่อ"}) ออกจากสมุดเบอร์กลางใช่หรือไม่?\n(หากต้องการแค่ซ่อนแนะนำให้กดปุ่ม "ไม่ใช้" แทนเพื่อไม่ให้ถูกซิงค์กลับมาใหม่)`
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/customer-contacts?id=${encodeURIComponent(contact.id)}`, {
        method: "DELETE",
        headers,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "ลบไม่สำเร็จ");

      setBanner({
        type: "success",
        text: `ลบเบอร์ ${contact.phone_display} เรียบร้อยแล้ว`,
      });
      await fetchData();
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "ลบไม่สำเร็จ",
      });
    } finally {
      setSaving(false);
    }
  };

  const openAddModalFromInvalid = (entry: InvalidOrderEntry) => {
    setAddForm({
      phone: "",
      display_name: entry.customer_name !== "-" ? entry.customer_name : entry.company_name || "",
      company_name: entry.company_name || "",
      contact_category: "general",
      owner_sale_name: entry.owner_sale_name || "",
      review_status: "verified",
      notes: `อ้างอิงออเดอร์ ${entry.order_id.slice(0, 8)} (ค่าเดิมใน Orders: "${entry.raw_phone}")`,
    });
    setShowAddModal(true);
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (previewMode) {
      setBanner({
        type: "error",
        text: "กรุณารันคำสั่ง SQL สร้างตาราง customer_contacts ก่อนเพิ่มเบอร์ใหม่ครับ",
      });
      return;
    }

    setSaving(true);
    setBanner(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/customer-contacts", {
        method: "POST",
        headers,
        body: JSON.stringify(addForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "เพิ่มเบอร์ไม่สำเร็จ");

      setShowAddModal(false);
      setAddForm({
        phone: "",
        display_name: "",
        company_name: "",
        contact_category: "general",
        owner_sale_name: "",
        review_status: "verified",
        notes: "",
      });
      setBanner({
        type: "success",
        text: `เพิ่มเบอร์ ${json.contact?.phone_display || ""} (${json.contact?.display_name || ""}) เรียบร้อยแล้ว`,
      });
      await fetchData();
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "เพิ่มเบอร์ไม่สำเร็จ",
      });
    } finally {
      setSaving(false);
    }
  };

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return contacts.filter((c) => {
      if (statusFilter !== "all" && c.review_status !== statusFilter) return false;
      if (categoryFilter !== "all" && c.contact_category !== categoryFilter) return false;
      if (onlyMultiName && (!c.alternate_names || c.alternate_names.length <= 1)) return false;
      if (onlyMissingName && c.display_name.trim() !== "") return false;

      if (!q) return true;
      const haystack = [
        c.phone_normalized,
        c.phone_display,
        c.display_name,
        c.company_name,
        c.owner_sale_name,
        c.notes,
        ...(c.alternate_names || []),
        ...(c.project_names || []),
        ...(c.raw_phones || []),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [contacts, searchQuery, statusFilter, categoryFilter, onlyMultiName, onlyMissingName]);

  const filteredInvalidEntries = useMemo(() => {
    const q = invalidSearchQuery.trim().toLowerCase();
    if (!q) return invalidEntries;
    return invalidEntries.filter((entry) =>
      [
        entry.order_id,
        entry.customer_name,
        entry.company_name,
        entry.raw_phone,
        entry.reason,
        entry.owner_sale_name,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [invalidEntries, invalidSearchQuery]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, categoryFilter, onlyMultiName, onlyMissingName, pageSize]);

  const totalPages = useMemo(() => {
    if (pageSize <= 0) return 1;
    return Math.max(1, Math.ceil(filteredContacts.length / pageSize));
  }, [filteredContacts.length, pageSize]);

  const paginatedContacts = useMemo(() => {
    if (pageSize <= 0) return filteredContacts;
    const start = (page - 1) * pageSize;
    return filteredContacts.slice(start, start + pageSize);
  }, [filteredContacts, page, pageSize]);

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectPage = () => {
    const pageIds = paginatedContacts.map((c) => c.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleExportCsv = () => {
    const headers = [
      "เบอร์โทร",
      "เบอร์มาตรฐาน",
      "ชื่อแสดงผล",
      "บริษัท",
      "ประเภท",
      "เซลล์ที่ดูแล",
      "จำนวนออเดอร์",
      "ชื่ออื่นที่พบในระบบ",
      "โครงการ",
      "สถานะรีเช็ก",
      "หมายเหตุ",
    ];
    const lines = [
      headers.map(escapeCsvCell).join(","),
      ...filteredContacts.map((c) =>
        [
          c.phone_display,
          c.phone_normalized,
          c.display_name,
          c.company_name,
          getCategoryMeta(c.contact_category).label,
          c.owner_sale_name,
          c.order_count,
          (c.alternate_names || []).join(" | "),
          (c.project_names || []).join(" | "),
          c.review_status,
          c.notes,
        ]
          .map(escapeCsvCell)
          .join(",")
      ),
    ];

    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wallcraft_customer_contacts_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[1440px] mx-auto space-y-6 pb-14">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-100 shrink-0">
            <Phone size={24} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-900">
                สมุดเบอร์ลูกค้ากลาง (Caller ID Directory)
              </h1>
              {previewMode && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  Live Preview (ยังไม่สร้างตาราง)
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              รวบรวมและทำความสะอาดเบอร์จาก Orders, Order Projects และ Team Profiles เพื่อให้แอดมินรีเช็กก่อนเปิดให้เซลล์ทุกคนใช้แสดงชื่อสายเรียกเข้า
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setAddForm({
                phone: "",
                display_name: "",
                company_name: "",
                contact_category: "general",
                owner_sale_name: "",
                review_status: "verified",
                notes: "",
              });
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-sm transition-colors"
          >
            <Plus size={16} />
            เพิ่มเบอร์ใหม่
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredContacts.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold transition-colors disabled:opacity-40"
          >
            <Download size={16} />
            ส่งออก CSV
          </button>

          <button
            type="button"
            onClick={() => void handleSyncContacts()}
            disabled={syncing || loading}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
          >
            <Sparkles size={16} className={syncing ? "animate-spin" : ""} />
            {syncing ? "กำลังวิเคราะห์ & นำเข้า..." : "วิเคราะห์ & ซิงค์จาก Orders"}
          </button>

          <button
            type="button"
            onClick={() => void fetchData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold transition-colors disabled:opacity-50"
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
                  ยังไม่ได้สร้างตาราง <code className="px-1.5 py-0.5 bg-amber-100 rounded">public.customer_contacts</code> ใน Supabase
                </div>
                <div className="text-xs text-amber-800 mt-1">
                  ตอนนี้ระบบดึงข้อมูลตัวอย่าง Live มาให้ตรวจดูได้ทันทีครับ หากต้องการ <strong>บันทึกสถานะรีเช็ก / แก้ไขชื่อ</strong> กรุณาคัดลอกคำสั่ง SQL ด้านล่างไปวางใน Supabase SQL Editor แล้วกด Run 1 ครั้ง จากนั้นกดปุ่ม <strong>รีเฟรช</strong> (ระบบจะนำเข้าเบอร์ทั้งหมดให้อัตโนมัติทันที)
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

      {/* Banner */}
      {banner && (
        <div
          className={`rounded-2xl px-4 py-3.5 border text-sm font-semibold flex items-center justify-between gap-2.5 ${
            banner.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {banner.type === "success" ? (
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle size={18} className="text-rose-600 shrink-0" />
            )}
            <span>{banner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="p-1 rounded-lg hover:bg-black/5"
            aria-label="ปิดแจ้งเตือน"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <button
          type="button"
          onClick={() => {
            setActiveTab("contacts");
            setStatusFilter("all");
            setOnlyMultiName(false);
            setOnlyMissingName(false);
          }}
          className={`text-left p-4 rounded-2xl border transition-all bg-white shadow-sm hover:border-blue-300 ${
            activeTab === "contacts" && statusFilter === "all" && !onlyMultiName && !onlyMissingName
              ? "border-blue-500 ring-2 ring-blue-100"
              : "border-slate-200"
          }`}
        >
          <div className="text-xs font-bold text-slate-500">เบอร์ทั้งหมด</div>
          <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">{summary.total}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">เบอร์มาตรฐาน 9-10 หลัก</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("contacts");
            setStatusFilter("pending_review");
            setOnlyMultiName(false);
            setOnlyMissingName(false);
          }}
          className={`text-left p-4 rounded-2xl border transition-all bg-white shadow-sm hover:border-amber-300 ${
            activeTab === "contacts" && statusFilter === "pending_review"
              ? "border-amber-500 ring-2 ring-amber-100"
              : "border-slate-200"
          }`}
        >
          <div className="text-xs font-bold text-amber-700">รอรีเช็ก</div>
          <div className="text-2xl font-black text-amber-600 mt-1 tabular-nums">
            {summary.pendingReview}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">ยังไม่ได้กดยืนยัน</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("contacts");
            setStatusFilter("verified");
            setOnlyMultiName(false);
            setOnlyMissingName(false);
          }}
          className={`text-left p-4 rounded-2xl border transition-all bg-white shadow-sm hover:border-emerald-300 ${
            activeTab === "contacts" && statusFilter === "verified"
              ? "border-emerald-500 ring-2 ring-emerald-100"
              : "border-slate-200"
          }`}
        >
          <div className="text-xs font-bold text-emerald-700">ยืนยันแล้ว (พร้อมใช้)</div>
          <div className="text-2xl font-black text-emerald-600 mt-1 tabular-nums">
            {summary.verified}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">แชร์ให้ทีมขายดูได้</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("contacts");
            setStatusFilter("all");
            setOnlyMultiName((v) => !v);
            setOnlyMissingName(false);
          }}
          className={`text-left p-4 rounded-2xl border transition-all bg-white shadow-sm hover:border-purple-300 ${
            activeTab === "contacts" && onlyMultiName
              ? "border-purple-500 ring-2 ring-purple-100"
              : "border-slate-200"
          }`}
        >
          <div className="text-xs font-bold text-purple-700">พบหลายชื่อใน 1 เบอร์</div>
          <div className="text-2xl font-black text-purple-600 mt-1 tabular-nums">
            {summary.multiNameCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">กดเพื่อคัดแยกชื่อหลัก</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("contacts");
            setStatusFilter("ignored");
            setOnlyMultiName(false);
            setOnlyMissingName(false);
          }}
          className={`text-left p-4 rounded-2xl border transition-all bg-white shadow-sm hover:border-slate-400 ${
            activeTab === "contacts" && statusFilter === "ignored"
              ? "border-slate-600 ring-2 ring-slate-200"
              : "border-slate-200"
          }`}
        >
          <div className="text-xs font-bold text-slate-500">ซ่อน / ไม่ใช้งาน</div>
          <div className="text-2xl font-black text-slate-600 mt-1 tabular-nums">
            {summary.ignored}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">เบอร์ผิด / ไม่ใช้ Caller ID</div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("invalid_orders")}
          className={`text-left p-4 rounded-2xl border transition-all bg-white shadow-sm hover:border-rose-300 ${
            activeTab === "invalid_orders"
              ? "border-rose-500 ring-2 ring-rose-100"
              : "border-slate-200"
          }`}
        >
          <div className="text-xs font-bold text-rose-700">ไม่ใช่เบอร์โทรใน Orders</div>
          <div className="text-2xl font-black text-rose-600 mt-1 tabular-nums">
            {summary.invalidOrderPhoneCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">เช่น Line ID / ข้อความ</div>
        </button>
      </div>

      {/* Mode Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("contacts")}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-bold border-b-2 transition-colors ${
            activeTab === "contacts"
              ? "border-blue-600 text-blue-700 bg-blue-50/70"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users size={16} />
          สมุดเบอร์กลาง ({summary.total})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("invalid_orders")}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-bold border-b-2 transition-colors ${
            activeTab === "invalid_orders"
              ? "border-rose-600 text-rose-700 bg-rose-50/70"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileWarning size={16} />
          ข้อมูลช่องเบอร์ใน Orders ที่ไม่ใช่เบอร์โทร ({invalidEntries.length})
        </button>
      </div>

      {activeTab === "contacts" ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Search & Filter Toolbar */}
          <div className="p-4 md:p-5 border-b border-slate-100 space-y-3.5">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="relative flex-1">
                <Search
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหา เบอร์โทร, ชื่อลูกค้า, บริษัท, โครงการ, ชื่อเดิมที่เคยกรอก, หรือชื่อเซลล์..."
                  className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none text-sm"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-bold text-slate-700 focus:border-blue-500 focus:outline-none"
                >
                  <option value="all">ทุกประเภทลูกค้า</option>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} ({summary.byCategory[opt.value] || 0})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setOnlyMultiName((v) => !v)}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-colors ${
                    onlyMultiName
                      ? "bg-purple-50 border-purple-400 text-purple-800"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  พบหลายชื่อ ({summary.multiNameCount})
                </button>

                <button
                  type="button"
                  onClick={() => setOnlyMissingName((v) => !v)}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-colors ${
                    onlyMissingName
                      ? "bg-amber-50 border-amber-400 text-amber-800"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  ยังไม่มีชื่อ ({summary.missingNameCount})
                </button>
              </div>
            </div>

            {/* Bulk Selection Bar */}
            {selectedIds.size > 0 && !previewMode && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-200">
                <div className="text-xs sm:text-sm font-bold text-blue-900">
                  เลือกอยู่ {selectedIds.size} เบอร์
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleBulkStatus("verified")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
                  >
                    <Check size={14} />
                    ยืนยันที่เลือก
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleBulkStatus("ignored")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold disabled:opacity-50"
                  >
                    <Ban size={14} />
                    ซ่อน/ไม่ใช้ที่เลือก
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleBulkStatus("pending_review")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold disabled:opacity-50"
                  >
                    <RotateCcw size={14} />
                    กลับเป็นรอรีเช็ก
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs font-bold text-slate-500 hover:text-slate-700 px-2"
                  >
                    ยกเลิกการเลือก
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              กำลังวิเคราะห์และโหลดข้อมูลเบอร์ลูกค้า...
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="text-slate-400 text-sm font-semibold">
                {contacts.length === 0
                  ? "ยังไม่มีข้อมูลในสมุดเบอร์กลาง — กดปุ่ม 'วิเคราะห์ & ซิงค์จาก Orders' ด้านบนเพื่อดึงข้อมูล"
                  : "ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา"}
              </div>
              {contacts.length === 0 && !migrationRequired && (
                <button
                  type="button"
                  onClick={() => void handleSyncContacts()}
                  disabled={syncing}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
                >
                  <Sparkles size={16} />
                  วิเคราะห์ & นำเข้าเบอร์ตอนนี้เลย
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 pl-4 pr-2 w-10">
                      <input
                        type="checkbox"
                        checked={
                          paginatedContacts.length > 0 &&
                          paginatedContacts.every((c) => selectedIds.has(c.id))
                        }
                        onChange={toggleSelectPage}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        aria-label="เลือกทั้งหมดในหน้านี้"
                      />
                    </th>
                    <th className="py-3 px-3 min-w-[165px]">เบอร์โทร & แหล่งข้อมูล</th>
                    <th className="py-3 px-3 min-w-[290px]">ชื่อแสดงผล / บริษัท / ชื่ออื่นที่พบ</th>
                    <th className="py-3 px-3 min-w-[175px]">ประเภท & เซลล์ที่ดูแล</th>
                    <th className="py-3 px-3 min-w-[125px]">สถานะรีเช็ก</th>
                    <th className="py-3 pl-3 pr-4 text-right min-w-[215px]">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {paginatedContacts.map((c) => {
                    const catMeta = getCategoryMeta(c.contact_category);
                    const hasMultipleNames = (c.alternate_names || []).length > 1;
                    const hasMultiRawPhone = (c.raw_phones || []).some((rp) =>
                      /[,/;|&\n]/.test(rp)
                    );
                    const hasMultiRawMixedText = (c.raw_phones || []).some(
                      (rp) => /[,/;|&\n]/.test(rp) && /[a-zA-Zก-๙]/.test(rp)
                    );
                    const isShortName =
                      c.display_name.trim().length > 0 && c.display_name.trim().length < 3;
                    const callerIdPreview = formatCallerIdPreview(
                      c.display_name,
                      c.company_name
                    );
                    const hasDistinctCallerIdPair =
                      Boolean(c.display_name.trim()) &&
                      Boolean(c.company_name.trim()) &&
                      c.display_name.trim() !== c.company_name.trim() &&
                      !c.display_name.trim().includes(c.company_name.trim());
                    const extraAlts = (c.alternate_names || []).filter(
                      (alt) => alt.trim() && alt.trim() !== c.display_name.trim()
                    );

                    return (
                      <tr
                        key={c.id}
                        className={`hover:bg-slate-50/80 transition-colors align-top ${
                          c.review_status === "ignored" ? "opacity-60 bg-slate-50/40" : ""
                        }`}
                      >
                        <td className="py-3.5 pl-4 pr-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(c.id)}
                            onChange={() => toggleSelectRow(c.id)}
                            disabled={previewMode}
                            className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                          />
                        </td>

                        {/* Phone & Source */}
                        <td className="py-3.5 px-3">
                          <div className="font-extrabold text-slate-900 text-[15px] tabular-nums">
                            {c.phone_display || c.phone_normalized}
                          </div>
                          <div className="flex flex-wrap items-center gap-1 mt-1.5">
                            {(c.source_tables || []).map((src) => (
                              <span
                                key={src}
                                className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold"
                              >
                                {getSourceLabel(src)}
                              </span>
                            ))}
                            {c.order_count > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold tabular-nums">
                                {c.order_count} ออเดอร์
                              </span>
                            )}
                          </div>
                          {c.raw_phones && c.raw_phones.length > 0 && (
                            <div
                              className="text-[11px] text-slate-400 mt-1 truncate max-w-[180px]"
                              title={c.raw_phones.join(", ")}
                            >
                              เดิม: {c.raw_phones[0]}
                              {c.raw_phones.length > 1 ? ` (+${c.raw_phones.length - 1})` : ""}
                            </div>
                          )}
                        </td>

                        {/* Name, Company, Projects, Alternates */}
                        <td className="py-3.5 px-3 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {c.display_name ? (
                              <span className="font-bold text-slate-900">{c.display_name}</span>
                            ) : (
                              <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                                ยังไม่มีชื่อผู้ติดต่อ (คลิกแก้ไข)
                              </span>
                            )}
                            {c.manually_edited && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                แก้ไขแล้ว
                              </span>
                            )}
                            {hasMultipleNames && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold">
                                พบ {c.alternate_names.length} ชื่อ
                              </span>
                            )}
                            {hasMultiRawMixedText && c.review_status === "pending_review" && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                                ช่องเดิมมีหลายเบอร์/ข้อความผสม
                              </span>
                            )}
                            {hasMultiRawPhone && !hasMultiRawMixedText && (
                              <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold">
                                1 บ. หลายเบอร์
                              </span>
                            )}
                            {isShortName && c.review_status === "pending_review" && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                                ชื่อสั้น (ควรเช็ก)
                              </span>
                            )}
                          </div>

                          {c.company_name && (
                            <div className="flex items-center gap-1 text-xs text-slate-600">
                              <Building2 size={13} className="text-slate-400 shrink-0" />
                              <span>{c.company_name}</span>
                            </div>
                          )}

                          {hasDistinctCallerIdPair && (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50/70 border border-emerald-200/80 text-[11px] font-semibold text-emerald-800">
                              <Phone size={11} className="text-emerald-600 shrink-0" />
                              <span>สายเข้าแสดง: {callerIdPreview}</span>
                            </div>
                          )}

                          {c.project_names && c.project_names.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                              {c.project_names.slice(0, 3).map((p) => (
                                <span
                                  key={p}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50/70 text-indigo-700 text-[11px] font-semibold"
                                >
                                  <FolderKanban size={11} />
                                  {p}
                                </span>
                              ))}
                              {c.project_names.length > 3 && (
                                <span className="text-[11px] text-slate-400">
                                  +{c.project_names.length - 3} โครงการ
                                </span>
                              )}
                            </div>
                          )}

                          {extraAlts.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1 pt-0.5">
                              <span className="text-[11px] text-slate-400">ชื่ออื่นที่พบ:</span>
                              {extraAlts.slice(0, 4).map((alt) => (
                                <span
                                  key={alt}
                                  className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px]"
                                >
                                  {alt}
                                </span>
                              ))}
                              {extraAlts.length > 4 && (
                                <span className="text-[11px] text-slate-400">
                                  +{extraAlts.length - 4}
                                </span>
                              )}
                            </div>
                          )}

                          {c.notes && (
                            <div className="text-[11px] text-amber-800 bg-amber-50/70 border border-amber-100 rounded-lg px-2 py-1">
                              โน้ต: {c.notes}
                            </div>
                          )}
                        </td>

                        {/* Category & Owner Sale */}
                        <td className="py-3.5 px-3 space-y-1.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${catMeta.badgeClass}`}
                          >
                            {catMeta.label}
                          </span>
                          {c.owner_sale_name && (
                            <div className="flex items-center gap-1 text-xs text-slate-600">
                              <UserCheck size={13} className="text-slate-400 shrink-0" />
                              <span>{c.owner_sale_name}</span>
                            </div>
                          )}
                          {c.last_order_at && (
                            <div className="text-[11px] text-slate-400">
                              ล่าสุด: {formatDateTh(c.last_order_at)}
                            </div>
                          )}
                        </td>

                        {/* Review Status */}
                        <td className="py-3.5 px-3">
                          {c.review_status === "verified" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                              <CheckCircle2 size={13} />
                              ยืนยันแล้ว
                            </span>
                          ) : c.review_status === "ignored" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold">
                              <Ban size={13} />
                              ไม่ใช้งาน
                            </span>
                          ) : (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                                <AlertTriangle size={13} />
                                รอรีเช็ก
                              </span>
                              {getPendingReviewReasons(c).map((reason) => (
                                <div
                                  key={reason}
                                  className="text-[11px] font-medium text-amber-800 leading-tight"
                                >
                                  • {reason}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Row Actions */}
                        <td className="py-3.5 pl-3 pr-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {c.review_status !== "verified" ? (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => void handleQuickStatus(c, "verified")}
                                title="กดยืนยันว่าเบอร์และชื่อนี้ถูกต้อง"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
                              >
                                <Check size={14} />
                                ยืนยัน
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => void handleQuickStatus(c, "pending_review")}
                                title="ส่งกลับสถานะรอรีเช็ก"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold transition-colors disabled:opacity-50"
                              >
                                <RotateCcw size={13} />
                                รอเช็ก
                              </button>
                            )}

                            {c.review_status !== "ignored" && (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => void handleQuickStatus(c, "ignored")}
                                title="ซ่อน / ไม่ใช้งานเบอร์นี้"
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 transition-colors disabled:opacity-50"
                              >
                                <Ban size={15} />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => openEditModal(c)}
                              title="แก้ไขชื่อ / ประเภท / โน้ต"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors"
                            >
                              <Edit3 size={14} />
                              แก้
                            </button>

                            {!previewMode && (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => void handleDeleteContact(c)}
                                title="ลบถาวร"
                                className="p-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 transition-colors disabled:opacity-50"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {filteredContacts.length > 0 && (
            <div className="px-4 py-3.5 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span>
                  แสดง{" "}
                  <strong>
                    {pageSize <= 0
                      ? `1-${filteredContacts.length}`
                      : `${(page - 1) * pageSize + 1}-${Math.min(
                          page * pageSize,
                          filteredContacts.length
                        )}`}
                  </strong>{" "}
                  จาก <strong>{filteredContacts.length}</strong> เบอร์
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold"
                >
                  <option value={50}>50 / หน้า</option>
                  <option value={100}>100 / หน้า</option>
                  <option value={0}>ทั้งหมด</option>
                </select>
              </div>

              {pageSize > 0 && totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-bold disabled:opacity-40"
                  >
                    ก่อนหน้า
                  </button>
                  <span className="px-2 font-bold">
                    หน้า {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-bold disabled:opacity-40"
                  >
                    ถัดไป
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Tab 2: Invalid / Non-phone entries from Orders */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="font-extrabold text-slate-900 text-sm">
                รายการใน <code className="px-1.5 py-0.5 bg-slate-100 rounded">orders.phone</code> ที่ไม่สามารถแปลงเป็นเบอร์โทร 9-10 หลักได้
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                เช่น ใส่ Line ID, ข้อความ หรือเบอร์ไม่ครบหลัก — คุณสามารถเช็กออเดอร์แล้วกด "+ เพิ่มเบอร์ที่ถูกต้อง" เข้าสมุดเบอร์กลางได้ทันที
              </div>
            </div>

            <div className="relative w-full sm:w-80">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={invalidSearchQuery}
                onChange={(e) => setInvalidSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อลูกค้า, ค่าเดิม, เซลล์..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none text-sm"
              />
            </div>
          </div>

          {filteredInvalidEntries.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              ไม่พบข้อมูลที่ไม่สมบูรณ์
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase">
                    <th className="py-3 pl-4 pr-3">วันที่สั่ง / Order ID</th>
                    <th className="py-3 px-3">ชื่อลูกค้า / บริษัท</th>
                    <th className="py-3 px-3">ข้อความที่กรอกในช่องเบอร์</th>
                    <th className="py-3 px-3">สาเหตุ</th>
                    <th className="py-3 px-3">เซลล์ที่รับผิดชอบ</th>
                    <th className="py-3 pl-3 pr-4 text-right">เพิ่มเข้าสมุดเบอร์</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredInvalidEntries.map((entry) => (
                    <tr key={entry.order_id} className="hover:bg-slate-50/70">
                      <td className="py-3 pl-4 pr-3">
                        <div className="text-xs font-bold text-slate-700">
                          {formatDateTh(entry.created_at)}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          #{entry.order_id.slice(0, 8)}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{entry.customer_name}</div>
                        {entry.company_name && (
                          <div className="text-xs text-slate-500">{entry.company_name}</div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold max-w-xs break-all">
                          {entry.raw_phone}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600">{entry.reason}</td>
                      <td className="py-3 px-3 text-xs text-slate-700">
                        {entry.owner_sale_name || "-"}
                      </td>
                      <td className="py-3 pl-3 pr-4 text-right">
                        <button
                          type="button"
                          onClick={() => openAddModalFromInvalid(entry)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                        >
                          <Plus size={14} />
                          เพิ่มเบอร์ที่ถูก
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editingContact && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  แก้ไข / รีเช็กเบอร์ลูกค้า
                </h3>
                <p className="text-xs text-slate-500">
                  เบอร์มาตรฐาน: {editingContact.phone_normalized}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingContact(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div className="rounded-xl bg-slate-900 text-white px-3.5 py-2.5 flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 shrink-0">
                  <Phone size={15} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                    ตัวอย่างสายเรียกเข้าบนมือถือเซลล์
                  </div>
                  <div className="text-sm font-bold truncate">
                    {formatCallerIdPreview(editForm.display_name, editForm.company_name)}
                  </div>
                </div>
              </div>

              {editingContact.alternate_names && editingContact.alternate_names.length > 0 && (
                <div className="rounded-xl bg-purple-50/70 border border-purple-200 p-3 space-y-2">
                  <div className="text-xs font-bold text-purple-900">
                    ชื่อที่พบในระบบสำหรับเบอร์นี้ (คลิกเพื่อเลือกใช้เป็นชื่อหลัก):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {editingContact.alternate_names.map((alt) => (
                      <button
                        key={alt}
                        type="button"
                        onClick={() => setEditForm((f) => ({ ...f, display_name: alt }))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                          editForm.display_name.trim() === alt.trim()
                            ? "bg-purple-600 text-white border-purple-600"
                            : "bg-white text-purple-800 border-purple-200 hover:bg-purple-100"
                        }`}
                      >
                        {alt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    เบอร์โทรศัพท์ *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.phone}
                    onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ประเภทผู้ติดต่อ
                  </label>
                  <select
                    value={editForm.contact_category}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, contact_category: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold bg-white focus:border-blue-500 focus:outline-none"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อแสดงผลเมื่อโทรเข้า (Display Name)
                </label>
                <input
                  type="text"
                  value={editForm.display_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, display_name: e.target.value }))}
                  placeholder="เช่น คุณสมชาย (บ.ดีไซน์)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">บริษัท</label>
                  <input
                    type="text"
                    value={editForm.company_name}
                    onChange={(e) => setEditForm((f) => ({ ...f, company_name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    เซลล์ที่ดูแล
                  </label>
                  <input
                    type="text"
                    value={editForm.owner_sale_name}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, owner_sale_name: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">สถานะรีเช็ก</label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: "pending_review", label: "รอรีเช็ก" },
                      { value: "verified", label: "ยืนยันแล้ว" },
                      { value: "ignored", label: "ไม่ใช้งาน" },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.value}
                      type="button"
                      onClick={() => setEditForm((f) => ({ ...f, review_status: st.value }))}
                      className={`py-2 rounded-xl border text-xs font-bold transition-colors ${
                        editForm.review_status === st.value
                          ? st.value === "verified"
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : st.value === "ignored"
                            ? "bg-slate-700 text-white border-slate-700"
                            : "bg-amber-500 text-white border-amber-500"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  หมายเหตุเพิ่มเติม (โน้ตให้ทีมขายเห็น)
                </label>
                <textarea
                  rows={2}
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="เช่น ติดต่อเวลาทำการ 09:00-17:00, ลูกค้า VIP โปรเจกต์สุขุมวิท"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              {editingContact.raw_phones && editingContact.raw_phones.length > 0 && (
                <div className="text-[11px] text-slate-400">
                  ข้อมูลดิบที่พบในระบบ: {editingContact.raw_phones.join(" , ")}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingContact(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-50"
                >
                  {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                เพิ่มเบอร์ติดต่อใหม่เข้าสมุดเบอร์กลาง
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateContact} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    เบอร์โทรศัพท์ (9-10 หลัก) *
                  </label>
                  <input
                    type="text"
                    required
                    value={addForm.phone}
                    onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="เช่น 081-234-5678"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ประเภท</label>
                  <select
                    value={addForm.contact_category}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, contact_category: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold bg-white focus:border-blue-500 focus:outline-none"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อผู้ติดต่อ *
                </label>
                <input
                  type="text"
                  required
                  value={addForm.display_name}
                  onChange={(e) => setAddForm((f) => ({ ...f, display_name: e.target.value }))}
                  placeholder="เช่น คุณเอ - บริษัท ABC"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">บริษัท</label>
                  <input
                    type="text"
                    value={addForm.company_name}
                    onChange={(e) => setAddForm((f) => ({ ...f, company_name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    เซลล์ที่ดูแล
                  </label>
                  <input
                    type="text"
                    value={addForm.owner_sale_name}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, owner_sale_name: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">หมายเหตุ</label>
                <textarea
                  rows={2}
                  value={addForm.notes}
                  onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50"
                >
                  {saving ? "กำลังเพิ่ม..." : "เพิ่มเบอร์ติดต่อ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

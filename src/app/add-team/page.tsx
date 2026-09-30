"use client";

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  Users,
  UserPlus,
  Plus,
  X,
  Search,
  XCircle,
  Loader2,
  ShieldCheck,
  UserCheck,
  Trash2,
  Pencil,
  Eye,
  EyeOff,
  RefreshCw,
  KeyRound,
  Mail,
  User,
  Settings2,
  Building2,
} from "lucide-react";

interface Team {
  id: string;
  team_name: string;
  description: string | null;
  created_at?: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: "user" | "admin" | string | null;
  team_id: string | null;
  avatar_url?: string | null;
}

export default function TeamAndEmployeeHubPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ตัวกรองบนหัวตาราง (กระชับในแถวเดียว)
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("ALL"); // "ALL" | "UNASSIGNED" | team.id
  const [roleFilter, setRoleFilter] = useState<"ALL" | "user" | "admin">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal: จัดการรายชื่อทีม (ซ่อนไว้ เปิดเมื่อกดปุ่ม "จัดการทีม")
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamDesc, setTeamDesc] = useState("");
  const [isSavingTeam, setIsSavingTeam] = useState(false);

  // Modal: เพิ่มพนักงานใหม่
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newRole, setNewRole] = useState<"user" | "admin">("user");
  const [newTeamId, setNewTeamId] = useState<string>("");
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userFormError, setUserFormError] = useState<string | null>(null);

  // Modal: แก้ไขข้อมูลพนักงาน
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editRole, setEditRole] = useState<"user" | "admin">("user");
  const [editTeamId, setEditTeamId] = useState<string>("");
  const [editNewPassword, setEditNewPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editFormError, setEditFormError] = useState<string | null>(null);

  useEffect(() => {
    void fetchAllData();
  }, []);

  const getAuthHeaders = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
    return headers;
  };

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [teamRes, profileRes] = await Promise.all([
        supabase.from("teams").select("*").order("team_name", { ascending: true }),
        supabase.from("profiles").select("*").order("full_name", { ascending: true }),
      ]);

      if (teamRes.error) throw teamRes.error;
      if (profileRes.error) throw profileRes.error;

      setTeams(teamRes.data || []);
      setProfiles(profileRes.data || []);
    } catch (err: any) {
      console.error("Error loading data:", err);
      alert("โหลดข้อมูลไม่สำเร็จ: " + (err?.message || "ไม่ทราบสาเหตุ"));
    } finally {
      setIsLoading(false);
    }
  };

  // ─────────────────────────────────────────────
  // แผนที่ชื่อทีม & จำนวนคนในแต่ละทีม
  // ─────────────────────────────────────────────
  const teamMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of teams) {
      map[t.id] = t.team_name;
    }
    return map;
  }, [teams]);

  const teamMemberCounts = useMemo(() => {
    const counts: Record<string, number> = { UNASSIGNED: 0 };
    for (const t of teams) counts[t.id] = 0;

    for (const p of profiles) {
      if (p.team_id && counts[p.team_id] !== undefined) {
        counts[p.team_id] += 1;
      } else {
        counts.UNASSIGNED += 1;
      }
    }
    return counts;
  }, [teams, profiles]);

  // ─────────────────────────────────────────────
  // จัดการทีม (สร้าง / ลบ ใน Modal)
  // ─────────────────────────────────────────────
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) {
      alert("กรุณาระบุชื่อทีมครับ");
      return;
    }

    setIsSavingTeam(true);
    try {
      const { data, error } = await supabase
        .from("teams")
        .insert([{ team_name: teamName.trim(), description: teamDesc.trim() || null }])
        .select("*")
        .single();

      if (error) throw error;

      if (data) {
        setTeams((prev) => [...prev, data].sort((a, b) => a.team_name.localeCompare(b.team_name)));
        // ถ้าเปิดการ์ดเพิ่มหรือแก้ไขพนักงานค้างไว้ ให้เลือกทีมที่เพิ่งสร้างให้อัตโนมัติ
        if (isAddUserModalOpen) setNewTeamId(data.id);
        if (editingUser) setEditTeamId(data.id);
      } else {
        await fetchAllData();
      }
      setTeamName("");
      setTeamDesc("");
    } catch (err: any) {
      alert("สร้างทีมไม่สำเร็จ: " + err.message);
    } finally {
      setIsSavingTeam(false);
    }
  };

  const handleDeleteTeam = async (id: string, name: string, memberCount: number) => {
    const warnMsg =
      memberCount > 0
        ? `⚠️ ทีม "${name}" มีพนักงานสังกัดอยู่ ${memberCount} คน\nหากลบทีมนี้ พนักงานในทีมจะกลายเป็น "ยังไม่มีทีม"\n\nยืนยันการลบทีมใช่ไหมครับ?`
        : `ยืนยันการลบทีม "${name}" ใช่ไหมครับ?`;

    if (!confirm(warnMsg)) return;

    try {
      if (memberCount > 0) {
        await supabase.from("profiles").update({ team_id: null }).eq("team_id", id);
      }

      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) throw error;

      if (selectedTeamFilter === id) setSelectedTeamFilter("ALL");
      setTeams((prev) => prev.filter((t) => t.id !== id));
      setProfiles((prev) => prev.map((p) => (p.team_id === id ? { ...p, team_id: null } : p)));
    } catch (err: any) {
      alert("ลบทีมไม่สำเร็จ: " + err.message);
    }
  };

  // ─────────────────────────────────────────────
  // เพิ่มพนักงานใหม่ & แก้ไขพนักงาน
  // ─────────────────────────────────────────────
  const openAddEmployeeModal = () => {
    setUserFormError(null);
    setNewFullName("");
    setNewEmail("");
    setNewPassword("");
    setShowNewPassword(false);
    setNewRole("user");
    setNewTeamId(
      selectedTeamFilter !== "ALL" && selectedTeamFilter !== "UNASSIGNED"
        ? selectedTeamFilter
        : ""
    );
    setIsAddUserModalOpen(true);
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);

    if (!newFullName.trim()) {
      setUserFormError("กรุณากรอกชื่อ-นามสกุลพนักงาน");
      return;
    }
    if (!newEmail.trim()) {
      setUserFormError("กรุณากรอกอีเมลสำหรับเข้าสู่ระบบ");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setUserFormError("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }

    setIsCreatingUser(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/employees", {
        method: "POST",
        headers,
        body: JSON.stringify({
          full_name: newFullName.trim(),
          email: newEmail.trim().toLowerCase(),
          password: newPassword,
          role: newRole,
          team_id: newTeamId || null,
        }),
      });

      const result = await res.json();
      if (!res.ok || result.error) {
        setUserFormError(result.error || "ไม่สามารถเพิ่มพนักงานได้");
        return;
      }

      if (result.profile) {
        setProfiles((prev) =>
          [...prev, result.profile].sort((a, b) =>
            (a.full_name || "").localeCompare(b.full_name || "")
          )
        );
      } else {
        await fetchAllData();
      }

      setIsAddUserModalOpen(false);
    } catch (err: any) {
      setUserFormError(err?.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setIsCreatingUser(false);
    }
  };

  const openEditEmployeeModal = (user: Profile) => {
    setEditingUser(user);
    setEditFullName(user.full_name || "");
    setEditRole(user.role === "admin" ? "admin" : "user");
    setEditTeamId(user.team_id || "");
    setEditNewPassword("");
    setShowEditPassword(false);
    setEditFormError(null);
  };

  const handleSaveEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditFormError(null);

    if (!editFullName.trim()) {
      setEditFormError("กรุณาระบุชื่อ-นามสกุล");
      return;
    }
    if (editNewPassword.trim().length > 0 && editNewPassword.trim().length < 6) {
      setEditFormError("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }

    setIsSavingEdit(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/employees", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          id: editingUser.id,
          full_name: editFullName.trim(),
          role: editRole,
          team_id: editTeamId || null,
          password: editNewPassword.trim() || undefined,
        }),
      });

      const result = await res.json();
      if (!res.ok || result.error) {
        // Fallback กรณีเปลี่ยนแค่ทีมหรือชื่อผ่าน client
        if (!editNewPassword.trim()) {
          const { error: directErr } = await supabase
            .from("profiles")
            .update({
              full_name: editFullName.trim(),
              role: editRole,
              team_id: editTeamId || null,
            })
            .eq("id", editingUser.id);

          if (directErr) {
            setEditFormError(result.error || directErr.message || "บันทึกการแก้ไขไม่สำเร็จ");
            return;
          }
        } else {
          setEditFormError(result.error || "บันทึกการแก้ไขไม่สำเร็จ");
          return;
        }
      }

      setProfiles((prev) =>
        prev.map((p) =>
          p.id === editingUser.id
            ? {
                ...p,
                full_name: editFullName.trim(),
                role: editRole,
                team_id: editTeamId || null,
              }
            : p
        )
      );
      setEditingUser(null);
    } catch (err: any) {
      setEditFormError(err?.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ─────────────────────────────────────────────
  // กรองรายชื่อพนักงานสำหรับตารางหลัก
  // ─────────────────────────────────────────────
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      if (selectedTeamFilter === "UNASSIGNED") {
        if (p.team_id && teamMap[p.team_id]) return false;
      } else if (selectedTeamFilter !== "ALL") {
        if (p.team_id !== selectedTeamFilter) return false;
      }

      const normalizedRole = p.role === "admin" ? "admin" : "user";
      if (roleFilter !== "ALL" && normalizedRole !== roleFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (p.full_name || "").toLowerCase().includes(q);
        const matchEmail = (p.email || "").toLowerCase().includes(q);
        const matchTeam = (p.team_id ? teamMap[p.team_id] || "" : "").toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchTeam) return false;
      }

      return true;
    });
  }, [profiles, teamMap, selectedTeamFilter, roleFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-4 md:p-6 lg:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* 🌟 Header คลีนๆ แถวเดียว */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs shrink-0">
              <Users size={22} />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">
                จัดการพนักงานและทีมสังกัด
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                พนักงานทั้งหมด {profiles.length} คน · ทีมทั้งหมด {teams.length} ทีม
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={fetchAllData}
              disabled={isLoading}
              className="p-2.5 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={17} className={isLoading ? "animate-spin" : ""} />
            </button>

            <button
              type="button"
              onClick={() => setIsTeamModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-semibold rounded-xl transition-all cursor-pointer"
            >
              <Settings2 size={16} className="text-slate-500" />
              จัดการรายชื่อทีม ({teams.length})
            </button>

            <button
              type="button"
              onClick={openAddEmployeeModal}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <UserPlus size={17} />
              เพิ่มพนักงานใหม่
            </button>
          </div>
        </div>

        {/* 🌟 ตารางรายชื่อพนักงาน (ขึ้นแสดงเต็มหน้าจอทันที ไม่มีการ์ดทีมรกด้านบน) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* แถบค้นหา + Dropdown กรองทีม */}
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
            {/* ช่องค้นหา */}
            <div className="relative flex-1 max-w-md">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อพนักงาน, อีเมล หรือชื่อทีม..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-xl text-sm outline-none transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* ตัวกรองทีม (Dropdown) + ตัวกรอง Role */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Dropdown กรองตามทีม */}
              <select
                value={selectedTeamFilter}
                onChange={(e) => setSelectedTeamFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 hover:border-slate-300 focus:bg-white focus:border-blue-500 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-700 outline-none cursor-pointer"
              >
                <option value="ALL">ทุกทีม ({profiles.length} คน)</option>
                <option value="UNASSIGNED">
                  ยังไม่มีทีม ({teamMemberCounts.UNASSIGNED || 0} คน)
                </option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.team_name} ({teamMemberCounts[t.id] || 0} คน)
                  </option>
                ))}
              </select>

              {/* ปุ่มกรองสิทธิ์ user / admin */}
              <div className="inline-flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setRoleFilter("ALL")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    roleFilter === "ALL"
                      ? "bg-white text-slate-800 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  ทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter("user")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    roleFilter === "user"
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  user
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter("admin")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    roleFilter === "admin"
                      ? "bg-white text-purple-600 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  admin
                </button>
              </div>
            </div>
          </div>

          {/* ตารางรายชื่อพนักงาน */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-6">ชื่อ-นามสกุล</th>
                  <th className="py-3.5 px-6">อีเมล</th>
                  <th className="py-3.5 px-6">ทีมที่สังกัด</th>
                  <th className="py-3.5 px-6">สิทธิ์ (Role)</th>
                  <th className="py-3.5 px-6 text-right w-32">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-500">
                      <div className="flex justify-center items-center gap-3">
                        <Loader2 size={20} className="animate-spin text-blue-600" />
                        <span>กำลังโหลดรายชื่อพนักงาน...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredProfiles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <Users size={34} className="text-slate-300" />
                        <p className="font-medium text-slate-600">ไม่พบข้อมูลพนักงาน</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredProfiles.map((user) => {
                    const isAdminRole = user.role === "admin";
                    const initial = (user.full_name || user.email || "U").charAt(0).toUpperCase();
                    const teamNameLabel = user.team_id ? teamMap[user.team_id] : null;

                    return (
                      <tr
                        key={user.id}
                        onClick={() => openEditEmployeeModal(user)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        {/* ชื่อพนักงาน */}
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                                isAdminRole
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {initial}
                            </div>
                            <span className="font-bold text-slate-800">
                              {user.full_name || "ไม่ระบุชื่อ"}
                            </span>
                          </div>
                        </td>

                        {/* อีเมล */}
                        <td className="py-3.5 px-6 text-slate-600">{user.email || "-"}</td>

                        {/* ทีมที่สังกัด */}
                        <td className="py-3.5 px-6">
                          {teamNameLabel ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Building2 size={13} />
                              {teamNameLabel}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              ยังไม่มีทีม
                            </span>
                          )}
                        </td>

                        {/* สิทธิ์ Role */}
                        <td className="py-3.5 px-6">
                          {isAdminRole ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              <ShieldCheck size={13} />
                              admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <UserCheck size={13} />
                              user
                            </span>
                          )}
                        </td>

                        {/* ปุ่มแก้ไข */}
                        <td
                          className="py-3.5 px-6 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => openEditEmployeeModal(user)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-blue-600 hover:text-white bg-blue-50 hover:bg-blue-600 rounded-lg transition-colors cursor-pointer"
                          >
                            <Pencil size={13} />
                            แก้ไข / จัดทีม
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────
          🌟 MODAL 1: เพิ่มพนักงานใหม่ (เลือกทีมจาก Dropdown ในนี้ได้เลย)
      ───────────────────────────────────────────── */}
      {isAddUserModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          onClick={() => !isCreatingUser && setIsAddUserModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <UserPlus size={20} />
                </div>
                เพิ่มพนักงานใหม่
              </h2>
              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(false)}
                disabled={isCreatingUser}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee}>
              <div className="p-6 space-y-4">
                {userFormError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-medium rounded-xl flex items-start gap-2">
                    <XCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{userFormError}</span>
                  </div>
                )}

                {/* ชื่อ-นามสกุล */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <User size={14} className="text-slate-400" />
                    ชื่อ-นามสกุล <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    disabled={isCreatingUser}
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="เช่น คุณสมชาย ใจดี"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>

                {/* อีเมล */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Mail size={14} className="text-slate-400" />
                    อีเมลสำหรับเข้าสู่ระบบ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    disabled={isCreatingUser}
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="เช่น somchai@wallcraft.com"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>

                {/* รหัสผ่าน */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <KeyRound size={14} className="text-slate-400" />
                    รหัสผ่าน (อย่างน้อย 6 ตัวอักษร) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      disabled={isCreatingUser}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="ตั้งรหัสผ่านสำหรับล็อกอิน"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Dropdown เลือกทีมที่สังกัด */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Building2 size={14} className="text-slate-400" />
                      ทีมที่สังกัด
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsTeamModalOpen(true)}
                      className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus size={12} /> เพิ่มทีมใหม่
                    </button>
                  </div>
                  <select
                    value={newTeamId}
                    onChange={(e) => setNewTeamId(e.target.value)}
                    disabled={isCreatingUser}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none cursor-pointer"
                  >
                    <option value="">-- ยังไม่ระบุทีม (อิสระ) --</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.team_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* เลือกสิทธิ์ (Role: user / admin) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    ระดับสิทธิ์ในระบบ (Role) <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setNewRole("user")}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        newRole === "user"
                          ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                        <UserCheck size={15} className="text-blue-600" />
                        user
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">พนักงาน / เซลล์</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewRole("admin")}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        newRole === "admin"
                          ? "border-purple-600 bg-purple-50/70 ring-2 ring-purple-500/20"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                        <ShieldCheck size={15} className="text-purple-600" />
                        admin
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">ผู้ดูแลระบบ</p>
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  disabled={isCreatingUser}
                  className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isCreatingUser ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      กำลังสร้าง...
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      บันทึกพนักงาน
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────
          🌟 MODAL 2: แก้ไขข้อมูลพนักงาน & เลือกทีมจาก Dropdown
      ───────────────────────────────────────────── */}
      {editingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          onClick={() => !isSavingEdit && setEditingUser(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Pencil size={18} />
                </div>
                แก้ไขพนักงาน / กำหนดทีม
              </h2>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                disabled={isSavingEdit}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditEmployee}>
              <div className="p-6 space-y-4">
                {editFormError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-medium rounded-xl flex items-start gap-2">
                    <XCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{editFormError}</span>
                  </div>
                )}

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                  อีเมลบัญชี: <span className="font-bold text-slate-800">{editingUser.email}</span>
                </div>

                {/* ชื่อ-นามสกุล */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    ชื่อ-นามสกุล <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isSavingEdit}
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>

                {/* Dropdown เลือกทีมที่สังกัด */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Building2 size={14} className="text-slate-400" />
                      ทีมที่สังกัด
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsTeamModalOpen(true)}
                      className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus size={12} /> เพิ่มทีมใหม่
                    </button>
                  </div>
                  <select
                    value={editTeamId}
                    onChange={(e) => setEditTeamId(e.target.value)}
                    disabled={isSavingEdit}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
                  >
                    <option value="">-- ยังไม่มีทีม (อิสระ) --</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.team_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* สิทธิ์ Role */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">ระดับสิทธิ์ (Role)</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setEditRole("user")}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        editRole === "user"
                          ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                        <UserCheck size={15} className="text-blue-600" />
                        user
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">พนักงาน / เซลล์</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditRole("admin")}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        editRole === "admin"
                          ? "border-purple-600 bg-purple-50/70 ring-2 ring-purple-500/20"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                        <ShieldCheck size={15} className="text-purple-600" />
                        admin
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">ผู้ดูแลระบบ</p>
                    </button>
                  </div>
                </div>

                {/* ตั้งรหัสผ่านใหม่ (ตัวเลือก) */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <KeyRound size={14} className="text-slate-400" />
                    ตั้งรหัสผ่านใหม่ (เว้นว่างไว้หากไม่ต้องการเปลี่ยน)
                  </label>
                  <div className="relative">
                    <input
                      type={showEditPassword ? "text" : "password"}
                      disabled={isSavingEdit}
                      value={editNewPassword}
                      onChange={(e) => setEditNewPassword(e.target.value)}
                      placeholder="กรอกรหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  disabled={isSavingEdit}
                  className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSavingEdit ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      กำลังบันทึก...
                    </>
                  ) : (
                    "บันทึกการแก้ไข"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────
          🌟 MODAL 3: จัดการรายชื่อทีม (ซ่อนไว้ในปุ่ม กดเมื่อต้องการเพิ่ม/ลบทีม)
      ───────────────────────────────────────────── */}
      {isTeamModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          onClick={() => !isSavingTeam && setIsTeamModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-5 border-b border-slate-100 shrink-0">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
                  <Settings2 size={18} />
                </div>
                จัดการรายชื่อทีม ({teams.length} ทีม)
              </h2>
              <button
                type="button"
                onClick={() => setIsTeamModalOpen(false)}
                disabled={isSavingTeam}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* ฟอร์มเพิ่มทีมด่วน */}
            <form onSubmit={handleCreateTeam} className="p-5 bg-slate-50 border-b border-slate-200 shrink-0">
              <label className="text-xs font-bold text-slate-700 block mb-2">
                สร้างทีมใหม่
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  required
                  disabled={isSavingTeam}
                  placeholder="ชื่อทีม (เช่น Team-B2B)"
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:border-blue-500 outline-none"
                />
                <input
                  type="text"
                  value={teamDesc}
                  onChange={(e) => setTeamDesc(e.target.value)}
                  disabled={isSavingTeam}
                  placeholder="คำอธิบาย (ตัวเลือก)"
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:border-blue-500 outline-none"
                />
                <button
                  type="submit"
                  disabled={isSavingTeam}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {isSavingTeam ? <Loader2 size={15} className="animate-spin" /> : <Plus size={16} />}
                  เพิ่มทีม
                </button>
              </div>
            </form>

            {/* รายการทีมที่มีอยู่ */}
            <div className="overflow-y-auto p-4 divide-y divide-slate-100 flex-1">
              {teams.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">
                  ยังไม่มีทีมในระบบ
                </div>
              ) : (
                teams.map((t) => {
                  const count = teamMemberCounts[t.id] || 0;
                  return (
                    <div
                      key={t.id}
                      className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-slate-50 rounded-xl transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-800 truncate">
                            {t.team_name}
                          </span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {count} คน
                          </span>
                        </div>
                        {t.description && (
                          <p className="text-xs text-slate-400 truncate mt-0.5">{t.description}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteTeam(t.id, t.team_name, count)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="ลบทีม"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
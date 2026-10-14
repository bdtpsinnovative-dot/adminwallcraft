"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Building2, Sparkles, Plus, Trash2, Save, ArrowLeft, 
  Search, CheckCircle2, AlertCircle, Loader2, ExternalLink,
  ChevronRight, RefreshCw, X, ShieldAlert, ArrowRight, Layers, Edit2
} from 'lucide-react';
import Link from 'next/link';
import { MappingGroup } from '@/lib/company-utils';

export default function CompanyMappingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastApprovedName, setLastApprovedName] = useState<string | null>(null);

  // Groups
  const [configuredGroups, setConfiguredGroups] = useState<MappingGroup[]>([]);
  const [suggestedGroups, setSuggestedGroups] = useState<MappingGroup[]>([]);
  const [orderCountMap, setOrderCountMap] = useState<Record<string, number>>({});
  const [companyMap, setCompanyMap] = useState<Record<string, string>>({});

  // Master company list for search dropdown
  const [allCompanies, setAllCompanies] = useState<{ id: string; name: string }[]>([]);
  
  // UI filter & tab
  const [activeTab, setActiveTab] = useState<'configured' | 'suggested'>('configured');
  const [searchTerm, setSearchTerm] = useState('');

  // Add Company Modal / Dropdown state per group
  const [searchingGroupId, setSearchingGroupId] = useState<string | null>(null);
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  // Create New Group Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newGroupTargetName, setNewGroupTargetName] = useState('');
  const [newGroupSelectedCompanies, setNewGroupSelectedCompanies] = useState<{ id: string; name: string }[]>([]);
  const [newGroupSearch, setNewGroupSearch] = useState('');

  const loadData = async (retryCount = 0) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Fetch from API
      const res = await fetch('/api/company-mappings');
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `โหลดข้อมูลล้มเหลว (รหัสสถานะ: ${res.status})`);
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'โหลดข้อมูลล้มเหลว');

      setConfiguredGroups(data.configuredGroups || []);
      setSuggestedGroups(data.suggestedGroups || []);
      setOrderCountMap(data.orderCountMap || {});
      setCompanyMap(data.companyMap || {});
      if (Array.isArray(data.allCompanies)) {
        setAllCompanies(data.allCompanies);
      }
    } catch (err: any) {
      console.warn('loadData notice:', err);
      if (retryCount < 1) {
        // Retry once automatically after 800ms
        setTimeout(() => loadData(retryCount + 1), 800);
        return;
      }
      setErrorMsg(err.message || 'ไม่สามารถโหลดข้อมูลการแมพได้ กรุณากดลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save changes to API
  const handleSave = async (overrideGroups?: MappingGroup[]) => {
    setSaving(true);
    setSaveSuccess(false);
    setErrorMsg(null);
    try {
      const groupsToSave = overrideGroups || configuredGroups;
      const res = await fetch('/api/company-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups: groupsToSave })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `บันทึกล้มเหลว (รหัสสถานะ: ${res.status})`);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
      // Reload to refresh suggestions
      await loadData();
    } catch (err: any) {
      console.error('handleSave error:', err);
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  };

  // Accept a suggested group into configured groups
  const handleApproveSuggestion = (suggested: MappingGroup) => {
    const newGroup: MappingGroup = {
      ...suggested,
      id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      isSuggested: false
    };
    const updated = [newGroup, ...configuredGroups];
    setConfiguredGroups(updated);
    setSuggestedGroups(prev => prev.filter(g => g.id !== suggested.id));
    setLastApprovedName(newGroup.targetName);
    // Auto-save
    handleSave(updated);
  };

  // Approve all suggestions
  const handleApproveAllSuggestions = () => {
    const newGroups: MappingGroup[] = suggestedGroups.map(s => ({
      ...s,
      id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      isSuggested: false
    }));
    const updated = [...newGroups, ...configuredGroups];
    setConfiguredGroups(updated);
    setSuggestedGroups([]);
    setLastApprovedName(`ทั้งหมด ${newGroups.length} กลุ่ม`);
    handleSave(updated);
    setActiveTab('configured');
  };

  // Update target name in configured group
  const handleUpdateTargetName = (groupId: string, newName: string) => {
    setConfiguredGroups(prev => prev.map(g => {
      if (g.id === groupId) return { ...g, targetName: newName };
      return g;
    }));
  };

  // Update target name in suggested group
  const handleUpdateSuggestedTargetName = (groupId: string, newName: string) => {
    setSuggestedGroups(prev => prev.map(g => {
      if (g.id === groupId) return { ...g, targetName: newName };
      return g;
    }));
  };

  // Remove a specific company from a group
  const handleRemoveCompanyFromGroup = (groupId: string, companyId: string) => {
    setConfiguredGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      const filteredIds = g.companyIds.filter(id => id !== companyId);
      return { ...g, companyIds: filteredIds };
    }).filter(g => g.companyIds.length > 0)); // Remove empty groups
  };

  // Add a company to a group
  const handleAddCompanyToGroup = (groupId: string, comp: { id: string; name: string }) => {
    setConfiguredGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      if (g.companyIds.includes(comp.id)) return g;
      return {
        ...g,
        companyIds: [...g.companyIds, comp.id],
        aliasNames: Array.from(new Set([...(g.aliasNames || []), comp.name]))
      };
    }));
    setSearchingGroupId(null);
    setCompanySearchQuery('');
  };

  // Delete an entire group
  const handleDeleteGroup = (groupId: string) => {
    if (!confirm('คุณต้องการยกเลิกการแมพของกลุ่มนี้ใช่หรือไม่?')) return;
    const updated = configuredGroups.filter(g => g.id !== groupId);
    setConfiguredGroups(updated);
    handleSave(updated);
  };

  // Create new group
  const handleCreateGroup = () => {
    if (!newGroupTargetName.trim()) {
      alert('กรุณาระบุชื่อมาตรฐานที่ต้องการให้แสดงผล');
      return;
    }
    if (newGroupSelectedCompanies.length === 0) {
      alert('กรุณาเลือกบริษัทอย่างน้อย 1 รายการเพื่อนำมาเข้ากลุ่ม');
      return;
    }

    const newGroup: MappingGroup = {
      id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      targetName: newGroupTargetName.trim(),
      companyIds: newGroupSelectedCompanies.map(c => c.id),
      aliasNames: newGroupSelectedCompanies.map(c => c.name),
      isSuggested: false
    };

    const updated = [newGroup, ...configuredGroups];
    setConfiguredGroups(updated);
    setIsCreateModalOpen(false);
    setNewGroupTargetName('');
    setNewGroupSelectedCompanies([]);
    setNewGroupSearch('');
    handleSave(updated);
  };

  // Helper to safely get clean company name (NEVER displays UUID!)
  const getCompanyName = (id: string, group?: MappingGroup, idx?: number) => {
    if (companyMap[id]) return companyMap[id];
    if (group?.aliasNames && idx !== undefined && group.aliasNames[idx]) {
      return group.aliasNames[idx];
    }
    return group?.targetName || 'ไม่ระบุชื่อบริษัท';
  };

  // Filtered lists (sorted by highest order count first)
  const filterGroupList = (list: MappingGroup[]) => {
    let result = list;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = list.filter(g => {
        const matchTarget = g.targetName.toLowerCase().includes(q);
        const matchAlias = (g.aliasNames || []).some(a => a.toLowerCase().includes(q));
        const matchComps = g.companyIds.some((id, idx) => getCompanyName(id, g, idx).toLowerCase().includes(q));
        return matchTarget || matchAlias || matchComps;
      });
    }

    // Sort by highest total orders first
    return [...result].sort((a, b) => {
      const ordersA = a.companyIds.reduce((sum, id) => sum + (orderCountMap[id] || 0), 0);
      const ordersB = b.companyIds.reduce((sum, id) => sum + (orderCountMap[id] || 0), 0);
      return ordersB - ordersA;
    });
  };

  const filteredConfigured = useMemo(() => filterGroupList(configuredGroups), [configuredGroups, searchTerm, companyMap, orderCountMap]);
  const filteredSuggested = useMemo(() => filterGroupList(suggestedGroups), [suggestedGroups, searchTerm, companyMap, orderCountMap]);

  // Quick search candidates for adding into group
  const candidateCompanies = useMemo(() => {
    if (!companySearchQuery.trim()) return [];
    const q = companySearchQuery.toLowerCase().trim();
    return allCompanies.filter(c => c.name.toLowerCase().includes(q)).slice(0, 15);
  }, [allCompanies, companySearchQuery]);

  // Modal candidate companies
  const modalCandidateCompanies = useMemo(() => {
    if (!newGroupSearch.trim()) return [];
    const q = newGroupSearch.toLowerCase().trim();
    const selectedSet = new Set(newGroupSelectedCompanies.map(c => c.id));
    return allCompanies
      .filter(c => !selectedSet.has(c.id) && c.name.toLowerCase().includes(q))
      .slice(0, 15);
  }, [allCompanies, newGroupSearch, newGroupSelectedCompanies]);

  return (
    <main className="p-4 md:p-8 bg-slate-50 min-h-screen text-slate-800 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Link 
              href="/dashboard" 
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs"
            >
              <ArrowLeft size={14} /> กลับแดชบอร์ด
            </Link>
            <Link 
              href="/companies" 
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs"
            >
              <Building2 size={14} /> จัดการบริษัทคู่ค้า
            </Link>
          </div>

          <Link
            href="/dashboard"
            target="_blank"
            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors border border-indigo-200/50"
          >
            <span>ดูผลบนหน้า Dashboard</span>
            <ExternalLink size={12} />
          </Link>
        </div>

        {/* Hero Header Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0 mt-0.5">
              <Sparkles size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-black tracking-tight text-slate-800">
                  ระบบตั้งค่าการแมพชื่อบริษัท
                </h1>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                  Auto & Custom Mapping
                </span>
              </div>
              <p className="text-slate-500 text-sm mt-1 leading-relaxed">
                กำหนดว่าบริษัทชื่อไหน (พิมพ์เล็ก/ใหญ่/เคาะวรรคต่างกัน) จะให้แมพรวมยอดเข้าด้วยกัน และให้แสดงผลเป็นคำว่าอะไรบน Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
            >
              <Plus size={16} />
              <span>สร้างกลุ่มแมพใหม่</span>
            </button>

            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-md shadow-indigo-200 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}</span>
            </button>
          </div>
        </div>

        {/* Approved Success Banner with Tab Switch Button */}
        {lastApprovedName && (
          <div className="mb-6 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-400 text-emerald-950 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <p className="text-base font-bold text-emerald-950">
                  อนุมัติกลุ่ม "{lastApprovedName}" สำเร็จแล้ว! 🎉
                </p>
                <p className="text-xs text-emerald-800 mt-0.5">
                  ระบบบันทึกขึ้น Supabase เรียบร้อยแล้ว และย้ายรายการนี้ไปอยู่ที่แท็บ <strong>"กลุ่มที่ตั้งค่าแล้ว"</strong> (แท็บซ้ายมือ)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setActiveTab('configured');
                  setLastApprovedName(null);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <span>กดดูที่แท็บกลุ่มที่ตั้งค่าแล้ว</span>
                <ArrowRight size={14} />
              </button>
              <button
                onClick={() => setLastApprovedName(null)}
                className="p-2 text-emerald-700 hover:bg-emerald-200/50 rounded-xl transition cursor-pointer"
                title="ปิดการแจ้งเตือน"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Alerts */}
        {saveSuccess && !lastApprovedName && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3 animate-fade-in shadow-xs">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span className="text-sm font-semibold">บันทึกการตั้งค่าการแมพชื่อบริษัทสำเร็จแล้ว! ข้อมูลบน Dashboard จะรวมยอดตามนี้ทันที</span>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <AlertCircle size={18} className="text-rose-600 shrink-0" />
              <span className="text-sm font-semibold">{errorMsg}</span>
            </div>
            <button
              onClick={() => loadData()}
              className="px-3 py-1.5 bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
            >
              <RefreshCw size={13} />
              ลองใหม่อีกครั้ง
            </button>
          </div>
        )}

        {/* Stats & Search Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          {/* Tabs */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-200/60 rounded-xl border border-slate-200 w-fit">
            <button
              onClick={() => setActiveTab('configured')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'configured'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers size={14} />
              <span>กลุ่มที่ตั้งค่าแล้ว ({configuredGroups.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('suggested')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'suggested'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles size={14} />
              <span>ระบบตรวจพบอัตโนมัติ ({suggestedGroups.length})</span>
              {suggestedGroups.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อบริษัท หรือชื่อเป้าหมาย..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 shadow-xs"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center flex flex-col items-center justify-center">
            <Loader2 size={32} className="animate-spin text-indigo-600 mb-3" />
            <p className="text-slate-500 text-sm font-medium">กำลังโหลดข้อมูลบริษัทและการตั้งค่า...</p>
          </div>
        ) : activeTab === 'suggested' ? (
          /* =========================================================================
             TAB 2: AUTO-SUGGESTED GROUPS
             ========================================================================= */
          <div>
            {suggestedGroups.length > 0 && (
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/80 p-4 rounded-2xl mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-amber-950 text-sm">
                      ระบบตรวจพบคู่บริษัทที่ชื่อคล้ายกัน {suggestedGroups.length} กลุ่ม
                    </h3>
                    <p className="text-amber-800 text-xs mt-0.5">
                      คุณสามารถกดอนุมัติเพื่อดึงเข้ามาเป็นกลุ่มที่ตั้งค่าถาวร หรือปรับแต่งชื่อเป้าหมายได้ตามต้องการ
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleApproveAllSuggestions}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all shrink-0 cursor-pointer active:scale-95"
                >
                  อนุมัติทั้งหมดเข้ากลุ่มที่ตั้งค่า ({suggestedGroups.length})
                </button>
              </div>
            )}

            {filteredSuggested.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center">
                <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-3" />
                <h3 className="font-bold text-slate-700 text-base">ไม่พบคู่บริษัทที่รอการอนุมัติ</h3>
                <p className="text-slate-400 text-xs mt-1">
                  ชื่อบริษัททั้งหมดได้รับการจัดกลุ่ม หรือไม่มีชื่อที่เขียนคล้ายกันแล้ว
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredSuggested.map((group, idx) => {
                  const totalGroupOrders = group.companyIds.reduce((sum, id) => sum + (orderCountMap[id] || 0), 0);
                  const sortedIds = [...group.companyIds].sort((a, b) => (orderCountMap[b] || 0) - (orderCountMap[a] || 0));

                  return (
                    <div 
                      key={group.id} 
                      className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-indigo-200 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
                            ตรวจพบอัตโนมัติ #{idx + 1}
                          </span>
                          {totalGroupOrders > 0 && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              รวม {totalGroupOrders} ออเดอร์
                            </span>
                          )}
                          <ArrowRight size={14} className="text-slate-400 shrink-0" />
                          <div className="inline-flex items-center gap-1.5 bg-indigo-50/70 border border-indigo-200/90 px-2.5 py-1 rounded-xl">
                            <span className="text-xs font-bold text-slate-600 shrink-0">จะแปลงเป็นชื่อ:</span>
                            <div className="relative">
                              <input
                                type="text"
                                value={group.targetName}
                                onChange={e => handleUpdateSuggestedTargetName(group.id, e.target.value)}
                                placeholder="พิมพ์ชื่อที่ต้องการเองได้เลย..."
                                className="font-black text-indigo-700 text-xs bg-white border border-indigo-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500 pl-2.5 pr-7 py-1 rounded-lg outline-none min-w-[220px] shadow-2xs"
                                title="คุณสามารถคลิกพิมพ์แก้ไขชื่อนี้เองได้ตามต้องการ"
                              />
                              <Edit2 size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" />
                            </div>
                          </div>
                        </div>

                        {/* List of matched company variants (highest orders first) */}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {sortedIds.map((id, idIdx) => {
                            const name = getCompanyName(id, group, idIdx);
                            const orders = orderCountMap[id] || 0;
                            return (
                              <div 
                                key={id}
                                className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl text-xs"
                              >
                                <Building2 size={13} className="text-slate-400 shrink-0" />
                                <span className="font-bold text-slate-800">{name}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  orders > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200/60 text-slate-500'
                                }`}>
                                  {orders} ออเดอร์
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                      <button
                        onClick={() => handleApproveSuggestion(group)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <CheckCircle2 size={14} />
                        <span>อนุมัติกลุ่มนี้</span>
                      </button>
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </div>
        ) : (
          /* =========================================================================
             TAB 1: CONFIGURED MAPPINGS
             ========================================================================= */
          <div>
            {filteredConfigured.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center">
                <Layers size={36} className="mx-auto text-slate-300 mb-3" />
                <h3 className="font-bold text-slate-700 text-base">ยังไม่มีกลุ่มที่ตั้งค่าไว้</h3>
                <p className="text-slate-400 text-xs mt-1 mb-4">
                  คุณสามารถกด &ldquo;สร้างกลุ่มแมพใหม่&rdquo; หรือไปที่แท็บ &ldquo;ระบบตรวจพบอัตโนมัติ&rdquo; เพื่อเลือกกลุ่มที่ต้องการแมพ
                </p>
                {suggestedGroups.length > 0 && (
                  <button
                    onClick={() => setActiveTab('suggested')}
                    className="px-4 py-2 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-xl hover:bg-indigo-100 transition-colors border border-indigo-200/50 cursor-pointer"
                  >
                    ดูคู่ที่ตรวจพบอัตโนมัติ ({suggestedGroups.length} กลุ่ม)
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5">
                {filteredConfigured.map((group, idx) => {
                  const totalOrders = group.companyIds.reduce((sum, id) => sum + (orderCountMap[id] || 0), 0);

                  return (
                    <div 
                      key={group.id} 
                      className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col gap-4"
                    >
                      {/* Group Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-100">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                              ชื่อมาตรฐานบน Dashboard:
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <div className="relative">
                                <input
                                  type="text"
                                  value={group.targetName}
                                  onChange={e => handleUpdateTargetName(group.id, e.target.value)}
                                  placeholder="ระบุชื่อมาตรฐานที่ต้องการ..."
                                  className="font-bold text-slate-800 text-sm bg-white hover:border-indigo-400 focus:bg-white pl-3 pr-8 py-1.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all w-72 md:w-80 shadow-2xs"
                                  title="คลิกเพื่อพิมพ์แก้ไขชื่อมาตรฐานได้เลย"
                                />
                                <Edit2 size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="text-[11px] text-slate-400 block font-medium">ยอดออเดอร์รวม</span>
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/50 inline-block">
                              {totalOrders} ออเดอร์
                            </span>
                          </div>

                          <button
                            onClick={() => handleDeleteGroup(group.id)}
                            className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            title="ยกเลิกกลุ่มนี้"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Mapped Companies List */}
                      <div>
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-xs font-bold text-slate-600">
                            บริษัทที่ถูกรวมเข้ากลุ่มนี้ ({group.companyIds.length} รายการ):
                          </span>

                          <button
                            onClick={() => {
                              setSearchingGroupId(searchingGroupId === group.id ? null : group.id);
                              setCompanySearchQuery('');
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            <Plus size={13} />
                            <span>เพิ่มบริษัทเข้ากลุ่มนี้</span>
                          </button>
                        </div>

                        {/* Inline Add Company Search Box */}
                        {searchingGroupId === group.id && (
                          <div className="bg-indigo-50/40 p-3 rounded-xl border border-indigo-100 mb-3 animate-fade-in">
                            <div className="relative">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input
                                type="text"
                                placeholder="พิมพ์ค้นหาชื่อบริษัทเพื่อนำมารวม..."
                                value={companySearchQuery}
                                onChange={e => setCompanySearchQuery(e.target.value)}
                                autoFocus
                                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                              <button
                                onClick={() => setSearchingGroupId(null)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                              >
                                <X size={14} />
                              </button>
                            </div>

                            {/* Dropdown Candidate Results */}
                            {candidateCompanies.length > 0 && (
                              <div className="mt-2 bg-white rounded-lg border border-slate-200 shadow-md max-h-48 overflow-y-auto divide-y divide-slate-100">
                                {candidateCompanies.map(comp => (
                                  <div
                                    key={comp.id}
                                    onClick={() => handleAddCompanyToGroup(group.id, comp)}
                                    className="p-2.5 hover:bg-indigo-50 flex items-center justify-between text-xs cursor-pointer transition-colors"
                                  >
                                    <span className="font-semibold text-slate-800">{comp.name}</span>
                                    <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded">
                                      + เลือกเข้ากลุ่ม
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Badges of mapped company IDs */}
                        <div className="flex flex-wrap items-center gap-2">
                          {group.companyIds.map((id, idIdx) => {
                            const name = getCompanyName(id, group, idIdx);
                            const orders = orderCountMap[id] || 0;

                            return (
                              <div 
                                key={id}
                                className="inline-flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl text-xs transition-colors"
                              >
                                <Building2 size={14} className="text-indigo-500 shrink-0" />
                                <span className="font-bold text-slate-800 text-xs">{name}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  orders > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200/60 text-slate-500'
                                }`}>
                                  {orders} ออเดอร์
                                </span>

                                {group.companyIds.length > 1 && (
                                  <button
                                    onClick={() => handleRemoveCompanyFromGroup(group.id, id)}
                                    className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors ml-1 cursor-pointer"
                                    title="นำออกจากกลุ่มนี้"
                                  >
                                    <X size={13} />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            CREATE NEW GROUP MODAL
           ========================================================================= */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-scale-in">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Plus size={18} />
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg">สร้างกลุ่มแมพชื่อบริษัทใหม่</h3>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Input 1: Target Name */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  1. ชื่อมาตรฐานที่จะให้แสดงผลบน Dashboard:
                </label>
                <input
                  type="text"
                  placeholder="เช่น Showroom BTV"
                  value={newGroupTargetName}
                  onChange={e => setNewGroupTargetName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Form Input 2: Search & Pick Companies */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  2. เลือกบริษัทที่จะนำมารวมเข้ากลุ่มนี้:
                </label>
                
                <div className="relative mb-2">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="พิมพ์ค้นหาบริษัท..."
                    value={newGroupSearch}
                    onChange={e => setNewGroupSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Candidate List */}
                {modalCandidateCompanies.length > 0 && (
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-1 max-h-36 overflow-y-auto mb-3 divide-y divide-slate-100">
                    {modalCandidateCompanies.map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setNewGroupSelectedCompanies(prev => [...prev, c]);
                          if (!newGroupTargetName) setNewGroupTargetName(c.name);
                        }}
                        className="p-2 hover:bg-indigo-50 rounded-lg flex items-center justify-between text-xs cursor-pointer"
                      >
                        <span className="font-semibold text-slate-800">{c.name}</span>
                        <span className="text-[10px] text-indigo-600 font-bold">+ เลือก</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Selected Badges */}
                <div className="min-h-[50px] p-2.5 bg-slate-50/70 border border-slate-200 rounded-xl flex flex-wrap gap-1.5 items-center">
                  {newGroupSelectedCompanies.length === 0 ? (
                    <span className="text-slate-400 text-xs italic">ยังไม่ได้เลือกบริษัท</span>
                  ) : (
                    newGroupSelectedCompanies.map(c => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-1 rounded-lg text-xs border border-indigo-200/50"
                      >
                        <span>{c.name}</span>
                        <button
                          type="button"
                          onClick={() => setNewGroupSelectedCompanies(prev => prev.filter(x => x.id !== c.id))}
                          className="hover:text-rose-600"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleCreateGroup}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  ยืนยันสร้างกลุ่ม
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}

"use client";

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Calendar, CheckCircle2, Clock, AlertTriangle, EyeOff, Eye, Search,
  Filter, Users, RefreshCw, ChevronDown, ChevronUp, CheckSquare, Square,
  Building2, FolderKanban, ArrowUpDown, ChevronLeft, ChevronRight,
  ShieldAlert, Sparkles, BarChart3, Layers, UserCheck, X, Bot, CalendarPlus
} from 'lucide-react';

interface Props {
  currentUserRole?: string;
  profiles?: any[];
  filterSales?: string;
  onRefreshParent?: () => void;
}

export interface VisitPlanItem {
  id: string;
  planned_date: string;
  start_time?: string | null;
  end_time?: string | null;
  project_concept?: string | null;
  status: 'pending' | 'completed' | 'cancelled' | string;
  is_deleted: boolean;
  user_id: string;
  company_id: string;
  project_id?: string | null;
  project_type_id?: string | null;
  product_category_id?: string | null;
  profiles?: {
    id: string;
    full_name?: string | null;
    avatar_url?: string | null;
    email?: string | null;
  } | null;
  companies?: {
    id: string;
    name?: string | null;
  } | null;
  projects?: {
    id: string;
    project_name?: string | null;
  } | null;
  project_types?: {
    id: string;
    name?: string | null;
  } | null;
  product_categories?: {
    id: string;
    name?: string | null;
  } | null;
}

export default function VisitPlansBacklogManager({
  currentUserRole = 'user',
  profiles = [],
  filterSales = 'ALL',
  onRefreshParent,
}: Props) {
  const AUTO_DROP_DAYS = 20; // 🤖 เกณฑ์ซ่อนจากแอปอัตโนมัติเมื่อเลยกำหนดเกิน 20 วัน

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<VisitPlanItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSalesId, setSelectedSalesId] = useState<string>(filterSales === 'ALL' ? 'all' : filterSales);
  const [activeTab, setActiveTab] = useState<'overdue_grace' | 'auto_dropped' | 'hidden' | 'upcoming' | 'completed' | 'all'>('overdue_grace');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  // Reschedule Modal State
  const [reschedulePlan, setReschedulePlan] = useState<VisitPlanItem | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Sync prop filterSales when changed from parent
  useEffect(() => {
    if (filterSales && filterSales !== 'ALL') {
      setSelectedSalesId(filterSales);
    }
  }, [filterSales]);

  // Fetch visit plans
  const fetchPlans = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('visit_plans')
        .select(`
          id, planned_date, start_time, end_time, project_concept, status, is_deleted, user_id, company_id, project_id, project_type_id, product_category_id,
          profiles (id, full_name, avatar_url, email),
          companies (id, name),
          projects (id, project_name),
          project_types (id, name),
          product_categories (id, name)
        `)
        .eq('is_deleted', false)
        .order('planned_date', { ascending: false });

      if (error) throw error;
      setPlans((data as any[]) || []);
    } catch (err: any) {
      console.error('Fetch visit plans error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Check if a plan is overdue
  const isOverdue = (plan: VisitPlanItem) => {
    if (plan.status !== 'pending') return false;
    if (!plan.planned_date) return false;
    const dateStr = String(plan.planned_date).split('T')[0];
    const timeStr = plan.end_time ? String(plan.end_time).slice(0, 5) : '23:59';
    const deadline = new Date(`${dateStr}T${timeStr}:00`);
    return !Number.isNaN(deadline.getTime()) && deadline.getTime() < Date.now();
  };

  // Calculate overdue days
  const getOverdueDays = (plannedDate: string) => {
    const pDate = new Date(plannedDate.split('T')[0]);
    const today = new Date(new Date().toISOString().split('T')[0]);
    const diffTime = today.getTime() - pDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  // Effective status classification with 20-day rule
  const getPlanCategory = (plan: VisitPlanItem): 'overdue_grace' | 'auto_dropped' | 'hidden' | 'upcoming' | 'completed' => {
    if (plan.status === 'cancelled') return 'hidden';
    if (plan.status === 'completed') return 'completed';
    if (isOverdue(plan)) {
      const days = getOverdueDays(plan.planned_date);
      if (days > AUTO_DROP_DAYS) return 'auto_dropped';
      return 'overdue_grace';
    }
    return 'upcoming';
  };

  // Summary Metrics
  const summary = useMemo(() => {
    let total = plans.length;
    let completed = 0;
    let overdueGrace = 0;
    let autoDropped = 0;
    let hiddenManual = 0;
    let upcoming = 0;

    plans.forEach(p => {
      const cat = getPlanCategory(p);
      if (cat === 'completed') completed++;
      else if (cat === 'hidden') hiddenManual++;
      else if (cat === 'auto_dropped') autoDropped++;
      else if (cat === 'overdue_grace') overdueGrace++;
      else upcoming++;
    });

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      total,
      completed,
      overdueGrace,
      autoDropped,
      hiddenManual,
      upcoming,
      completionRate,
      totalHidden: autoDropped + hiddenManual,
    };
  }, [plans]);

  // Sales Leaderboard Breakdown
  const salesLeaderboard = useMemo(() => {
    const map = new Map<string, {
      userId: string;
      name: string;
      email: string;
      avatarUrl?: string;
      total: number;
      completed: number;
      overdueGrace: number;
      autoDropped: number;
      hiddenManual: number;
      upcoming: number;
      completionRate: number;
    }>();

    profiles.forEach(pr => {
      if (!map.has(pr.id)) {
        map.set(pr.id, {
          userId: pr.id,
          name: pr.full_name || pr.email || 'ไม่ระบุชื่อ',
          email: pr.email || '',
          avatarUrl: pr.avatar_url,
          total: 0,
          completed: 0,
          overdueGrace: 0,
          autoDropped: 0,
          hiddenManual: 0,
          upcoming: 0,
          completionRate: 0,
        });
      }
    });

    plans.forEach(p => {
      const uid = p.user_id || 'unknown';
      if (!map.has(uid)) {
        const pObj = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
        map.set(uid, {
          userId: uid,
          name: pObj?.full_name || pObj?.email || uid,
          email: pObj?.email || '',
          avatarUrl: pObj?.avatar_url,
          total: 0,
          completed: 0,
          overdueGrace: 0,
          autoDropped: 0,
          hiddenManual: 0,
          upcoming: 0,
          completionRate: 0,
        });
      }

      const stat = map.get(uid)!;
      stat.total++;
      const cat = getPlanCategory(p);
      if (cat === 'completed') stat.completed++;
      else if (cat === 'hidden') stat.hiddenManual++;
      else if (cat === 'auto_dropped') stat.autoDropped++;
      else if (cat === 'overdue_grace') stat.overdueGrace++;
      else stat.upcoming++;
    });

    const list = Array.from(map.values()).filter(s => s.total > 0);
    list.forEach(s => {
      s.completionRate = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
    });

    // Sort by AutoDropped + OverdueGrace desc, then Total desc
    return list.sort((a, b) => {
      const pendingA = a.autoDropped + a.overdueGrace;
      const pendingB = b.autoDropped + b.overdueGrace;
      if (pendingB !== pendingA) return pendingB - pendingA;
      return b.total - a.total;
    });
  }, [plans, profiles]);

  // Filtered plans list
  const filteredPlans = useMemo(() => {
    return plans.filter(plan => {
      // Sales filter
      if (selectedSalesId !== 'all' && plan.user_id !== selectedSalesId) {
        return false;
      }

      // Tab filter
      const cat = getPlanCategory(plan);
      if (activeTab === 'overdue_grace' && cat !== 'overdue_grace') return false;
      if (activeTab === 'auto_dropped' && cat !== 'auto_dropped') return false;
      if (activeTab === 'hidden' && cat !== 'hidden') return false;
      if (activeTab === 'upcoming' && cat !== 'upcoming') return false;
      if (activeTab === 'completed' && cat !== 'completed') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const pObj = Array.isArray(plan.profiles) ? plan.profiles[0] : plan.profiles;
        const cObj = Array.isArray(plan.companies) ? plan.companies[0] : plan.companies;
        const projObj = Array.isArray(plan.projects) ? plan.projects[0] : plan.projects;

        const sName = (pObj?.full_name || '').toLowerCase();
        const cName = (cObj?.name || '').toLowerCase();
        const projName = (projObj?.project_name || '').toLowerCase();
        const concept = (plan.project_concept || '').toLowerCase();

        if (!sName.includes(q) && !cName.includes(q) && !projName.includes(q) && !concept.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [plans, selectedSalesId, activeTab, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredPlans.length / PAGE_SIZE) || 1;
  const paginatedPlans = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredPlans.slice(start, start + PAGE_SIZE);
  }, [filteredPlans, currentPage]);

  // Handle single action
  const handleUpdateStatus = async (planId: string, newStatus: 'cancelled' | 'pending' | 'completed') => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('visit_plans')
        .update({ status: newStatus })
        .eq('id', planId);

      if (error) throw error;

      setPlans(prev => prev.map(p => p.id === planId ? { ...p, status: newStatus } : p));
      
      const label = newStatus === 'cancelled' ? 'ซ่อนจากแอปแล้ว (ไม่แสดงในแอป)' : newStatus === 'pending' ? 'ดึงกลับมาแสดงในแอปแล้ว' : 'บันทึกเป็นเข้าพบสำเร็จแล้ว';
      showToast(`✅ ${label}`);
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Reschedule
  const handleConfirmReschedule = async () => {
    if (!reschedulePlan || !rescheduleDate) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('visit_plans')
        .update({
          planned_date: rescheduleDate,
          status: 'pending',
        })
        .eq('id', reschedulePlan.id);

      if (error) throw error;

      setPlans(prev => prev.map(p => p.id === reschedulePlan.id ? { ...p, planned_date: rescheduleDate, status: 'pending' } : p));
      setReschedulePlan(null);
      showToast(`🎉 เลื่อนนัดไปเป็นวันที่ ${rescheduleDate} เรียบร้อยแล้ว! แพลนจะเด้งกลับไปแสดงในแอปทันที`);
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาดในการเลื่อนนัด: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Batch action
  const handleBatchUpdate = async (newStatus: 'cancelled' | 'pending' | 'completed') => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const actionLabel = newStatus === 'cancelled' 
      ? 'ซ่อนจากแอป (ไม่แสดงในแอปแล้ว)' 
      : newStatus === 'pending' 
        ? 'ดึงกลับมาแสดงในแอป' 
        : 'ทำเครื่องหมายว่าสำเร็จแล้ว';

    if (!window.confirm(`⚠️ คุณต้องการ "${actionLabel}" สำหรับ ${ids.length} รายการที่เลือกใช่หรือไม่?`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('visit_plans')
        .update({ status: newStatus })
        .in('id', ids);

      if (error) throw error;

      setPlans(prev => prev.map(p => ids.includes(p.id) ? { ...p, status: newStatus } : p));
      setSelectedIds(new Set());
      showToast(`🎉 ดำเนินการ "${actionLabel}" ให้ ${ids.length} รายการเรียบร้อยแล้ว!`);
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาดในการอัปเดตแบบกลุ่ม: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleSelectAll = () => {
    const pageIds = paginatedPlans.map(p => p.id);
    const allSelected = pageIds.every(id => selectedIds.has(id));

    const next = new Set(selectedIds);
    if (allSelected) {
      pageIds.forEach(id => next.delete(id));
    } else {
      pageIds.forEach(id => next.add(id));
    }
    setSelectedIds(next);
  };

  const handleToggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div className="bg-white border border-slate-200 shadow-sm flex flex-col w-full overflow-hidden mt-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-slate-900 text-white px-4 py-3 fixed bottom-6 right-6 z-50 rounded-lg shadow-xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-4">
          <Sparkles className="text-amber-400" size={18} />
          <span className="text-sm font-semibold">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Reschedule Modal */}
      {reschedulePlan && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CalendarPlus className="text-indigo-600" size={20} />
                <h3 className="font-bold text-slate-900 text-base">เลื่อนวันนัดหมาย (Reschedule)</h3>
              </div>
              <button onClick={() => setReschedulePlan(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div>
                <span className="text-slate-500 font-medium">บริษัทลูกค้า:</span>
                <span className="font-bold text-slate-800 ml-1.5">{reschedulePlan.companies?.name || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">เซลส์:</span>
                <span className="font-bold text-slate-800 ml-1.5">{reschedulePlan.profiles?.full_name || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">วันนัดเดิม:</span>
                <span className="font-bold text-rose-600 ml-1.5">{reschedulePlan.planned_date?.split('T')[0]}</span>
              </div>

              <div className="pt-2">
                <label className="block text-slate-700 font-bold mb-1.5">
                  เลือกวันนัดหมายใหม่ (แพลนจะกลับไปแสดงในแอปทันที):
                </label>
                <input
                  type="date"
                  value={rescheduleDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setRescheduleDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[11px] leading-relaxed">
                💡 <b>คำแนะนำ:</b> เมื่อเลื่อนวันมาเป็นปัจจุบันหรือในอนาคต ระบบจะยกเลิกการซ่อนและดึงแพลนนี้กลับไปแสดงในแอปมือถือของเซลส์ทันที!
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setReschedulePlan(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-md"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmReschedule}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 size={14} />
                <span>ยืนยันเลื่อนนัด</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-lg">
              <Bot className="text-indigo-400" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2 flex-wrap">
                ระบบวิเคราะห์ & เคลียร์ยอดแพลนค้างสะสม
                <span className="bg-indigo-500 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <Bot size={12} />
                  สูตรคำนวณออโต้ 20 วัน
                </span>
                <span className="bg-slate-700 text-slate-200 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  ซ่อนออโต้แล้ว {summary.autoDropped} แพลน
                </span>
              </h2>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                แพลนที่เลยกำหนดเกิน 20 วันและไม่มีการเช็คอิน ระบบจะ <b>ซ่อนจากแอปมือถืออัตโนมัติ</b> ทันที เพื่อไม่ให้รกหน้าจอเซลส์ (ข้อมูลไม่ถูกลบออกจากระบบ)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={() => fetchPlans()}
            disabled={loading}
            className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-md flex items-center gap-1.5 transition border border-white/10 cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>รีเฟรชข้อมูล</span>
          </button>
        </div>
      </div>

      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 p-5 bg-slate-50 border-b border-slate-100">
        <div className="bg-white p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">แพลนทั้งหมด</span>
            <Calendar size={16} className="text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{summary.total}</div>
          <div className="text-[11px] text-slate-500 mt-1">บันทึกสะสมทั้งระบบ</div>
        </div>

        <div className="bg-white p-4 border border-emerald-200 shadow-sm bg-gradient-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">เข้าพบสำเร็จ</span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{summary.completed}</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">คิดเป็น {summary.completionRate}% ของทั้งหมด</div>
        </div>

        <div className="bg-white p-4 border border-slate-300 shadow-sm bg-gradient-to-br from-white to-slate-100/50">
          <div className="flex items-center justify-between text-slate-700 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              <Bot size={13} className="text-indigo-600" />
              ซ่อนออโต้ (&gt;20 วัน)
            </span>
            <EyeOff size={16} className="text-slate-500" />
          </div>
          <div className="text-2xl font-black text-slate-700">{summary.autoDropped}</div>
          <div className="text-[11px] text-indigo-600 font-semibold mt-1">ตัดออกจากแอปมือถือแล้ว</div>
        </div>

        <div className="bg-white p-4 border border-rose-300 shadow-sm bg-gradient-to-br from-white to-rose-50/40">
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">ค้างในแอป (&le;20 วัน)</span>
            <AlertTriangle size={16} className="text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600">{summary.overdueGrace}</div>
          <div className="text-[11px] text-rose-600 font-semibold mt-1">อยู่ในช่วงผ่อนปรนให้ตาม</div>
        </div>

        <div className="bg-white p-4 border border-amber-200 shadow-sm col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">รอพบในอนาคต</span>
            <Clock size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-700">{summary.upcoming}</div>
          <div className="text-[11px] text-amber-600 font-semibold mt-1">ตามกำหนดนัดหมาย</div>
        </div>
      </div>

      {/* Section 1: Sales Leaderboard / Breakdown */}
      <div className="p-5 border-b border-slate-100 bg-white">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Users size={16} className="text-indigo-600" />
              สรุปยอดสะสมแพลนค้าง & อัตราความสำเร็จรายบุคคล (Sales Breakdown)
            </h3>
            <p className="text-xs text-slate-500">คลิกที่รายชื่อเซลล์เพื่อกรองดูเฉพาะแพลนของคนนั้นในตารางด้านล่าง</p>
          </div>

          {selectedSalesId !== 'all' && (
            <button
              onClick={() => setSelectedSalesId('all')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200 flex items-center gap-1 cursor-pointer"
            >
              <span>ล้างตัวกรองเซลส์ (แสดงทั้งหมด)</span>
              <X size={12} />
            </button>
          )}
        </div>

        <div className="overflow-x-auto border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3 min-w-[180px]">ชื่อเซลส์</th>
                <th className="py-2.5 px-3 min-w-[200px]">สัดส่วนสถานะแพลนงาน</th>
                <th className="py-2.5 px-3 text-center">สำเร็จ</th>
                <th className="py-2.5 px-3 text-center text-slate-700 bg-slate-100/60">
                  <span className="flex items-center justify-center gap-1">
                    <Bot size={11} className="text-indigo-600" />
                    ซ่อนออโต้ (&gt;20ว.)
                  </span>
                </th>
                <th className="py-2.5 px-3 text-center text-rose-600 bg-rose-50/50">ค้างในแอป (&le;20ว.)</th>
                <th className="py-2.5 px-3 text-center text-slate-500">ซ่อนเอง</th>
                <th className="py-2.5 px-3 text-center">รอพบ</th>
                <th className="py-2.5 px-3 text-center">รวมทั้งหมด</th>
                <th className="py-2.5 px-3 text-right">ความสำเร็จ</th>
                <th className="py-2.5 px-3 text-center w-24">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salesLeaderboard.map((sale, idx) => {
                const isSelected = selectedSalesId === sale.userId;
                return (
                  <tr
                    key={sale.userId}
                    onClick={() => setSelectedSalesId(isSelected ? 'all' : sale.userId)}
                    className={`hover:bg-indigo-50/40 transition cursor-pointer ${
                      isSelected ? 'bg-indigo-50/80 font-semibold' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        {sale.avatarUrl ? (
                          <img src={sale.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                            {sale.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className={`text-xs ${isSelected ? 'text-indigo-900 font-bold' : 'text-slate-800'}`}>
                            {sale.name}
                          </div>
                          {sale.email && <div className="text-[10px] text-slate-400">{sale.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-slate-100">
                        {sale.completed > 0 && (
                          <div
                            className="bg-emerald-500"
                            style={{ width: `${(sale.completed / sale.total) * 100}%` }}
                            title={`สำเร็จ: ${sale.completed}`}
                          />
                        )}
                        {sale.overdueGrace > 0 && (
                          <div
                            className="bg-rose-500"
                            style={{ width: `${(sale.overdueGrace / sale.total) * 100}%` }}
                            title={`ค้างในแอป (<=20 วัน): ${sale.overdueGrace}`}
                          />
                        )}
                        {sale.autoDropped > 0 && (
                          <div
                            className="bg-slate-400"
                            style={{ width: `${(sale.autoDropped / sale.total) * 100}%` }}
                            title={`ซ่อนออโต้ (>20 วัน): ${sale.autoDropped}`}
                          />
                        )}
                        {sale.upcoming > 0 && (
                          <div
                            className="bg-amber-400"
                            style={{ width: `${(sale.upcoming / sale.total) * 100}%` }}
                            title={`รอพบ: ${sale.upcoming}`}
                          />
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-600">{sale.completed}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-700 bg-slate-100/60">
                      {sale.autoDropped > 0 ? (
                        <span className="bg-slate-200 text-slate-800 px-2 py-0.5 rounded-full text-[11px]">
                          {sale.autoDropped}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-black text-rose-600 bg-rose-50/50">
                      {sale.overdueGrace > 0 ? (
                        <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full text-[11px]">
                          {sale.overdueGrace}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                      {sale.hiddenManual > 0 ? sale.hiddenManual : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center text-amber-700">{sale.upcoming}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-900">{sale.total}</td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-800">
                      {sale.completionRate}%
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}>
                        {isSelected ? 'กำลังกรอง' : 'เจาะลึก'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Detailed Drill-Down Table with Tabs & Actions */}
      <div className="p-5 bg-slate-50 flex-1">
        {/* Filter Tabs */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => { setActiveTab('overdue_grace'); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-t flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'overdue_grace'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-rose-50 border border-slate-200'
              }`}
            >
              <AlertTriangle size={13} />
              <span>ค้างในแอป (&le; 20 วัน)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'overdue_grace' ? 'bg-white text-rose-600' : 'bg-rose-100 text-rose-700'
              }`}>
                {summary.overdueGrace}
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('auto_dropped'); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-t flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'auto_dropped'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Bot size={13} className="text-indigo-400" />
              <span>ซ่อนออโต้แล้ว (&gt; 20 วัน)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'auto_dropped' ? 'bg-white text-slate-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {summary.autoDropped}
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('hidden'); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-t flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'hidden'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <EyeOff size={13} />
              <span>ปิดงาน/ซ่อนเอง ({summary.hiddenManual})</span>
            </button>

            <button
              onClick={() => { setActiveTab('upcoming'); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-t flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'upcoming'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-amber-50 border border-slate-200'
              }`}
            >
              <Clock size={13} />
              <span>รอพบในอนาคต ({summary.upcoming})</span>
            </button>

            <button
              onClick={() => { setActiveTab('completed'); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-t flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'completed'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-emerald-50 border border-slate-200'
              }`}
            >
              <CheckCircle2 size={13} />
              <span>สำเร็จแล้ว ({summary.completed})</span>
            </button>

            <button
              onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-t flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-indigo-50 border border-slate-200'
              }`}
            >
              <Layers size={13} />
              <span>ทั้งหมด ({summary.total})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาบริษัท, โครงการ, เซลส์..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 text-xs rounded outline-none focus:border-indigo-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold">
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Batch Action Toolbar */}
        {selectedIds.size > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 p-3 mt-3 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
              <CheckSquare size={16} className="text-indigo-600" />
              <span>เลือกอยู่ {selectedIds.size} รายการ</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleBatchUpdate('cancelled')}
                disabled={isProcessing}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded shadow-sm flex items-center gap-1.5 transition cursor-pointer"
              >
                <EyeOff size={13} />
                <span>ซ่อนจากแอปทั้งหมดที่เลือก</span>
              </button>

              <button
                onClick={() => handleBatchUpdate('completed')}
                disabled={isProcessing}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow-sm flex items-center gap-1.5 transition cursor-pointer"
              >
                <CheckCircle2 size={13} />
                <span>ทำเครื่องหมายสำเร็จ</span>
              </button>

              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-700 font-semibold"
              >
                ยกเลิกการเลือก
              </button>
            </div>
          </div>
        )}

        {/* Detailed Table */}
        <div className="overflow-x-auto border border-slate-200 bg-white mt-3 shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-2.5 px-3 w-8 text-center">
                  <input
                    type="checkbox"
                    checked={paginatedPlans.length > 0 && paginatedPlans.every(p => selectedIds.has(p.id))}
                    onChange={handleToggleSelectAll}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="py-2.5 px-3 min-w-[130px]">วันนัดหมายเดิม</th>
                <th className="py-2.5 px-3 min-w-[140px]">เซลส์ผู้รับผิดชอบ</th>
                <th className="py-2.5 px-3 min-w-[180px]">บริษัทลูกค้า</th>
                <th className="py-2.5 px-3 min-w-[180px]">โครงการ / Concept</th>
                <th className="py-2.5 px-3 min-w-[120px]">หมวดหมู่สินค้า</th>
                <th className="py-2.5 px-3 text-center min-w-[160px]">สถานะการแสดงผล</th>
                <th className="py-2.5 px-3 text-right min-w-[200px]">จัดการ (Actions)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="animate-spin inline-block mr-2" size={18} />
                    กำลังโหลดข้อมูลแผนงาน...
                  </td>
                </tr>
              ) : paginatedPlans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    ไม่พบแผนงานในหมวดหมู่นี้
                  </td>
                </tr>
              ) : (
                paginatedPlans.map(plan => {
                  const cat = getPlanCategory(plan);
                  const isChecked = selectedIds.has(plan.id);
                  const pObj = Array.isArray(plan.profiles) ? plan.profiles[0] : plan.profiles;
                  const cObj = Array.isArray(plan.companies) ? plan.companies[0] : plan.companies;
                  const projObj = Array.isArray(plan.projects) ? plan.projects[0] : plan.projects;
                  const overdueDays = getOverdueDays(plan.planned_date);

                  return (
                    <tr
                      key={plan.id}
                      className={`hover:bg-slate-50 transition ${
                        isChecked ? 'bg-indigo-50/50' : cat === 'auto_dropped' || cat === 'hidden' ? 'bg-slate-50/60 opacity-80' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectOne(plan.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-800">
                          {plan.planned_date ? plan.planned_date.split('T')[0] : '-'}
                        </div>
                        {(cat === 'auto_dropped' || cat === 'overdue_grace') && (
                          <div className={`text-[10px] font-black mt-0.5 flex items-center gap-1 ${
                            cat === 'auto_dropped' ? 'text-slate-500' : 'text-rose-600'
                          }`}>
                            <Clock size={11} />
                            <span>เลยมาแล้ว {overdueDays} วัน</span>
                          </div>
                        )}
                        {plan.start_time && (
                          <div className="text-[10px] text-slate-400">
                            {plan.start_time.slice(0, 5)} - {plan.end_time?.slice(0, 5) || ''}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">
                          {pObj?.full_name || pObj?.email || 'ไม่ระบุ'}
                        </div>
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Building2 size={13} className="text-slate-400 flex-shrink-0" />
                          <span>{cObj?.name || 'ไม่ระบุชื่อบริษัท'}</span>
                        </div>
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="text-slate-800 font-semibold">
                          {projObj?.project_name || '-'}
                        </div>
                        {plan.project_concept && (
                          <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                            {plan.project_concept}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        <span className="text-[11px] text-slate-600">
                          {plan.product_categories?.name || plan.project_types?.name || '-'}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        {cat === 'auto_dropped' ? (
                          <span className="bg-slate-100 text-slate-700 border border-slate-300 px-2.5 py-0.5 rounded text-[11px] font-bold inline-flex items-center gap-1" title="เลยกำหนดเกิน 20 วัน ระบบคำนวณซ่อนจากแอปมือถืออัตโนมัติ">
                            <Bot size={12} className="text-indigo-600" />
                            <span>ซ่อนออโต้ (&gt;20 วัน)</span>
                          </span>
                        ) : cat === 'hidden' ? (
                          <span className="bg-slate-100 text-slate-700 border border-slate-300 px-2.5 py-0.5 rounded text-[11px] font-bold inline-flex items-center gap-1">
                            <EyeOff size={11} />
                            <span>ปิดงาน/ซ่อนเอง</span>
                          </span>
                        ) : cat === 'overdue_grace' ? (
                          <span className="bg-rose-100 text-rose-700 border border-rose-300 px-2.5 py-0.5 rounded text-[11px] font-bold inline-flex items-center gap-1 animate-pulse" title="เลยกำหนดไม่เกิน 20 วัน ยังคงแสดงในแอปเพื่อให้เซลส์ตามผล">
                            <AlertTriangle size={11} />
                            <span>ค้างในแอป (&le;20 วัน)</span>
                          </span>
                        ) : cat === 'completed' ? (
                          <span className="bg-emerald-100 text-emerald-700 border border-emerald-300 px-2.5 py-0.5 rounded text-[11px] font-bold inline-flex items-center gap-1">
                            <CheckCircle2 size={11} />
                            <span>เข้าพบสำเร็จ</span>
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded text-[11px] font-bold inline-flex items-center gap-1">
                            <Clock size={11} />
                            <span>รอพบตามนัด</span>
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* ปุ่มเลื่อนนัดเพื่อเปิดกลับมาทำต่อ */}
                          <button
                            onClick={() => {
                              setReschedulePlan(plan);
                              setRescheduleDate(new Date().toISOString().split('T')[0]);
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold rounded shadow-sm inline-flex items-center gap-1 transition cursor-pointer"
                            title="เลื่อนวันนัดหมายใหม่ (จะเด้งกลับไปแสดงในแอปทันที)"
                          >
                            <CalendarPlus size={12} />
                            <span>เลื่อนนัด</span>
                          </button>

                          {/* สลับซ่อน/แสดงแมนนวล */}
                          {cat === 'hidden' ? (
                            <button
                              onClick={() => handleUpdateStatus(plan.id, 'pending')}
                              disabled={isProcessing}
                              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[11px] font-bold rounded shadow-sm inline-flex items-center gap-1 transition cursor-pointer"
                              title="ดึงกลับมาแสดงในแอป"
                            >
                              <Eye size={12} />
                              <span>แสดงในแอป</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateStatus(plan.id, 'cancelled')}
                              disabled={isProcessing}
                              className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-medium rounded inline-flex items-center gap-1 transition cursor-pointer"
                              title="ซ่อนจากแอปทันที"
                            >
                              <EyeOff size={11} />
                              <span>ซ่อน</span>
                            </button>
                          )}

                          {cat !== 'completed' && (
                            <button
                              onClick={() => handleUpdateStatus(plan.id, 'completed')}
                              disabled={isProcessing}
                              className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold rounded shadow-sm inline-flex items-center gap-1 transition cursor-pointer"
                              title="เปลี่ยนเป็นเข้าพบสำเร็จแล้ว"
                            >
                              <CheckCircle2 size={12} />
                              <span>สำเร็จ</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
            <div>
              แสดง {(currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, filteredPlans.length)} จากทั้งหมด {filteredPlans.length} รายการ
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-600 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2 font-bold text-slate-700">
                หน้า {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-600 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

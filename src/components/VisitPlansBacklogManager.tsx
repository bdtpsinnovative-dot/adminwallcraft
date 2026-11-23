"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Calendar, CheckCircle2, Clock, AlertTriangle, EyeOff, Eye, Search,
  Users, RefreshCw, ChevronDown, ChevronUp, Building2, CalendarPlus,
  Bot, Sparkles, X, Check, ArrowRight, Lock
} from 'lucide-react';

interface Props {
  currentUserRole?: string;
  currentUserTeamId?: string | null;
  currentUserId?: string;
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
}

export default function VisitPlansBacklogManager({
  currentUserRole = 'user',
  currentUserTeamId = null,
  currentUserId = '',
  profiles = [],
  filterSales = 'ALL',
  onRefreshParent,
}: Props) {
  const AUTO_DROP_DAYS = 20; // 🤖 เกณฑ์ซ่อนจากแอปอัตโนมัติเมื่อเลยกำหนดเกิน 20 วัน

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<VisitPlanItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSalesId, setExpandedSalesId] = useState<string | null>(null);
  const [expandedFilterTab, setExpandedFilterTab] = useState<'overdue_all' | 'today' | 'overdue_grace' | 'auto_dropped' | 'all'>('overdue_all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Reschedule Modal
  const [reschedulePlan, setReschedulePlan] = useState<VisitPlanItem | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

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
          projects (id, project_name)
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

  const getTodayStr = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getOverdueDays = (plannedDate: string) => {
    if (!plannedDate) return 0;
    const pDateStr = plannedDate.split('T')[0];
    const todayStr = getTodayStr();
    const pDate = new Date(`${pDateStr}T00:00:00`);
    const today = new Date(`${todayStr}T00:00:00`);
    const diffTime = today.getTime() - pDate.getTime();
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  };

  const getPlanCategory = (plan: VisitPlanItem): 'completed' | 'hidden' | 'today' | 'upcoming' | 'overdue_grace' | 'auto_dropped' => {
    if (plan.status === 'cancelled') return 'hidden';
    if (plan.status === 'completed') return 'completed';
    if (!plan.planned_date) return 'upcoming';

    const pDateStr = String(plan.planned_date).split('T')[0];
    const todayStr = getTodayStr();

    // 🟢 ถ้าเป็นนัดหมายวันนี้ และยัง pending -> รอดำเนินการ (สีเขียว ไม่ใช่งานค้างหลุด)
    if (pDateStr === todayStr) {
      return 'today';
    }

    // 🔵 ถ้าเป็นนัดหมายในอนาคต -> รอพบในอนาคต
    if (pDateStr > todayStr) {
      return 'upcoming';
    }

    // ⚠️ ถ้าเป็นนัดหมายในอดีต (ตั้งแต่เมื่อวานย้อนไป) -> งานค้างจริง
    const overdueDays = getOverdueDays(pDateStr);
    if (overdueDays > AUTO_DROP_DAYS) {
      return 'auto_dropped';
    }
    return 'overdue_grace';
  };

  // 🛡️ สิทธิ์การมองเห็น: ถ้าไม่ใช่ Admin จะเห็นเฉพาะคนในทีมที่ได้รับอนุญาต (profiles)
  const allowedUserIds = useMemo(() => {
    if (currentUserRole === 'admin') return null; // Admin เห็นหมด
    return new Set(profiles.map(p => p.id));
  }, [currentUserRole, profiles]);

  // 🛡️ สิทธิ์การแก้ไข (Option 2):
  // - Admin / Manager: แก้ไขของทุกคนในทีมได้
  // - เซลล์ทั่วไป (user): แก้ไขได้เฉพาะงานของตัวเอง (plan.user_id === currentUserId) เท่านั้น!
  const canEditPlan = (plan: VisitPlanItem) => {
    if (currentUserRole === 'admin') return true;
    if (currentUserRole === 'manager') return true;
    return Boolean(currentUserId && plan.user_id === currentUserId);
  };

  // Top Summary Cards
  const summary = useMemo(() => {
    const relevantPlans = allowedUserIds
      ? plans.filter(p => allowedUserIds.has(p.user_id))
      : plans;

    let total = relevantPlans.length;
    let completed = 0;
    let todayActive = 0;
    let overdueGrace = 0;
    let autoDropped = 0;
    let upcoming = 0;

    relevantPlans.forEach(p => {
      const cat = getPlanCategory(p);
      if (cat === 'completed') completed++;
      else if (cat === 'today') todayActive++;
      else if (cat === 'auto_dropped') autoDropped++;
      else if (cat === 'overdue_grace') overdueGrace++;
      else if (cat === 'upcoming') upcoming++;
    });

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, todayActive, overdueGrace, autoDropped, upcoming, completionRate };
  }, [plans, allowedUserIds]);

  // Sales List with Grouped Plans
  const salesList = useMemo(() => {
    const map = new Map<string, {
      userId: string;
      name: string;
      email: string;
      avatarUrl?: string;
      total: number;
      completed: number;
      todayActive: number;
      overdueGrace: number;
      autoDropped: number;
      hiddenManual: number;
      upcoming: number;
      completionRate: number;
      plans: VisitPlanItem[];
    }>();

    profiles.forEach(pr => {
      map.set(pr.id, {
        userId: pr.id,
        name: pr.full_name || pr.email || 'ไม่ระบุชื่อ',
        email: pr.email || '',
        avatarUrl: pr.avatar_url,
        total: 0,
        completed: 0,
        todayActive: 0,
        overdueGrace: 0,
        autoDropped: 0,
        hiddenManual: 0,
        upcoming: 0,
        completionRate: 0,
        plans: [],
      });
    });

    plans.forEach(p => {
      const uid = p.user_id || 'unknown';
      // ถ้าไม่ใช่แอดมิน และไม่ใช่คนในทีมที่อนุญาต -> ข้าม ไม่นำมาแสดง
      if (allowedUserIds && !allowedUserIds.has(uid)) return;

      if (!map.has(uid)) {
        const pObj = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
        map.set(uid, {
          userId: uid,
          name: pObj?.full_name || pObj?.email || uid,
          email: pObj?.email || '',
          avatarUrl: pObj?.avatar_url,
          total: 0,
          completed: 0,
          todayActive: 0,
          overdueGrace: 0,
          autoDropped: 0,
          hiddenManual: 0,
          upcoming: 0,
          completionRate: 0,
          plans: [],
        });
      }

      const s = map.get(uid)!;
      s.total++;
      s.plans.push(p);

      const cat = getPlanCategory(p);
      if (cat === 'completed') s.completed++;
      else if (cat === 'today') s.todayActive++;
      else if (cat === 'auto_dropped') s.autoDropped++;
      else if (cat === 'overdue_grace') s.overdueGrace++;
      else if (cat === 'hidden') s.hiddenManual++;
      else s.upcoming++;
    });

    let list = Array.from(map.values()).filter(s => s.total > 0);
    list.forEach(s => {
      s.completionRate = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
    });

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
    }

    // Sort: เซลล์ที่มีงานค้างในแอปมากที่สุดขึ้นก่อน ตามด้วยงานที่รอดำเนินการวันนี้
    return list.sort((a, b) => {
      if (b.overdueGrace !== a.overdueGrace) return b.overdueGrace - a.overdueGrace;
      if (b.todayActive !== a.todayActive) return b.todayActive - a.todayActive;
      if (b.autoDropped !== a.autoDropped) return b.autoDropped - a.autoDropped;
      return b.total - a.total;
    });
  }, [plans, profiles, searchQuery]);

  // Handle single action
  const handleUpdateStatus = async (planId: string, newStatus: 'cancelled' | 'pending' | 'completed') => {
    const targetPlan = plans.find(p => p.id === planId);
    if (targetPlan && !canEditPlan(targetPlan)) {
      alert('⚠️ คุณไม่มีสิทธิ์จัดการแผนงานของเพื่อนร่วมทีม (แก้ไขได้เฉพาะงานของตัวเองเท่านั้น)');
      return;
    }

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('visit_plans')
        .update({ status: newStatus })
        .eq('id', planId);

      if (error) throw error;

      setPlans(prev => prev.map(p => p.id === planId ? { ...p, status: newStatus } : p));
      const label = newStatus === 'cancelled' ? 'ซ่อนจากแอปแล้ว (ปล่อยงาน)' : newStatus === 'pending' ? 'ดึงกลับมาแสดงในแอปแล้ว' : 'บันทึกเป็นเข้าพบสำเร็จแล้ว';
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
    if (!canEditPlan(reschedulePlan)) {
      alert('⚠️ คุณไม่มีสิทธิ์เลื่อนนัดแผนงานของเพื่อนร่วมทีม (แก้ไขได้เฉพาะงานของตัวเองเท่านั้น)');
      return;
    }

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
      alert(`เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
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
                💡 <b>ผลลัพธ์:</b> เมื่อเลื่อนวันมาเป็นปัจจุบันหรือในอนาคต แพลนนี้จะ <b>เด้งกลับไปแสดงในแอปมือถือของเซลส์ทันที!</b>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setReschedulePlan(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer"
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
                ระบบจัดการและเคลียร์แพลนค้างสะสม
                <span className="bg-indigo-500 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  คำนวณออโต้ 20 วัน
                </span>
              </h2>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                คลิกที่ชื่อเซลส์คนไหน ➔ จะคลี่เปิดดูรายชื่อบริษัทที่ค้างอยู่ใต้ชื่อคนนั้นทันที จัดการง่ายในที่เดียว
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

      {/* 5 Clean Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 p-5 bg-slate-50 border-b border-slate-100">
        <div className="bg-white p-4 border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">แพลนทั้งหมดในระบบ</div>
          <div className="text-2xl font-black text-slate-900">{summary.total}</div>
          <div className="text-[11px] text-slate-400 mt-1">บันทึกสะสมทั้งระบบ</div>
        </div>

        <div className="bg-white p-4 border border-emerald-200 shadow-xs bg-gradient-to-br from-white to-emerald-50/30">
          <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1 flex items-center gap-1">
            <CheckCircle2 size={13} className="text-emerald-600" />
            เข้าพบสำเร็จแล้ว
          </div>
          <div className="text-2xl font-black text-emerald-700">{summary.completed}</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">คิดเป็น {summary.completionRate}% ของทั้งหมด</div>
        </div>

        <div className="bg-white p-4 border border-emerald-400 shadow-xs bg-gradient-to-br from-white to-emerald-50/60">
          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            นัดวันนี้ (รอดำเนินการ)
          </div>
          <div className="text-2xl font-black text-emerald-700">{summary.todayActive}</div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1">กำลังดำเนินการวันนี้ ไม่ใช่งานหลุด</div>
        </div>

        <div className="bg-white p-4 border border-amber-300 shadow-xs bg-gradient-to-br from-white to-amber-50/40">
          <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Clock size={13} className="text-amber-600" />
            ยังไม่เข้าพบ (1-20 วัน)
          </div>
          <div className="text-2xl font-black text-amber-700">{summary.overdueGrace}</div>
          <div className="text-[11px] text-amber-700 font-semibold mt-1">เลยวันนัดหมายแล้ว ยังไม่ได้ไปพบ</div>
        </div>

        <div className="bg-white p-4 border border-slate-300 shadow-xs bg-gradient-to-br from-white to-slate-100/50">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Bot size={13} className="text-indigo-600" />
            ซ่อนออโต้แล้ว (&gt;20 วัน)
          </div>
          <div className="text-2xl font-black text-slate-700">{summary.autoDropped}</div>
          <div className="text-[11px] text-slate-500 font-semibold mt-1">ตัดออกจากแอปมือถือแล้ว</div>
        </div>
      </div>

      {/* Main Single Master Table: Sales Breakdown with In-Place Accordion Drill-Down */}
      <div className="p-5 bg-white flex-1">
        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Users size={16} className="text-indigo-600" />
              รายชื่อเซลส์ & สถานะแพลนงาน (คลิกที่แถวเพื่อเปิดดูรายละเอียดใต้ชื่อ)
            </h3>
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อเซลส์..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 text-xs rounded-md outline-none focus:border-indigo-500 focus:bg-white transition"
            />
          </div>
        </div>

        {/* Master Table */}
        <div className="overflow-x-auto border border-slate-200 shadow-xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3 min-w-[170px]">ชื่อเซลส์</th>
                <th className="py-3 px-3 min-w-[160px]">สัดส่วนความคืบหน้า</th>
                <th className="py-3 px-3 text-center">สำเร็จแล้ว</th>
                <th className="py-3 px-3 text-center text-emerald-800 bg-emerald-50/70 font-black min-w-[120px]">
                  🟢 นัดวันนี้
                </th>
                <th className="py-3 px-3 text-center text-amber-800 bg-amber-50/60 font-black min-w-[130px]">
                  ยังไม่เข้าพบ (1-20 วัน)
                </th>
                <th className="py-3 px-3 text-center text-slate-700 bg-slate-100/60 min-w-[130px]">
                  ซ่อนออโต้ (&gt;20 วัน) 🤖
                </th>
                <th className="py-3 px-3 text-center">รอพบในอนาคต</th>
                <th className="py-3 px-3 text-center font-bold">รวมทั้งหมด</th>
                <th className="py-3 px-3 text-center w-36">เปิดดูรายการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <RefreshCw className="animate-spin inline-block mr-2" size={16} />
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              ) : salesList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    ไม่พบข้อมูลเซลส์
                  </td>
                </tr>
              ) : (
                salesList.map((sale, idx) => {
                  const isExpanded = expandedSalesId === sale.userId;

                  // Filter plans for this sales rep based on the mini tab inside accordion
                  const salePlans = sale.plans
                    .filter(p => {
                      const cat = getPlanCategory(p);
                      if (expandedFilterTab === 'overdue_all') return cat === 'today' || cat === 'overdue_grace' || cat === 'auto_dropped';
                      if (expandedFilterTab === 'today') return cat === 'today';
                      if (expandedFilterTab === 'overdue_grace') return cat === 'overdue_grace';
                      if (expandedFilterTab === 'auto_dropped') return cat === 'auto_dropped';
                      return true;
                    })
                    .sort((a, b) => {
                      const catA = getPlanCategory(a);
                      const catB = getPlanCategory(b);
                      if (catA === 'today' && catB !== 'today') return -1;
                      if (catB === 'today' && catA !== 'today') return 1;
                      if (catA === 'overdue_grace' && catB !== 'overdue_grace') return -1;
                      if (catB === 'overdue_grace' && catA !== 'overdue_grace') return 1;
                      if (catA === 'auto_dropped' && catB !== 'auto_dropped') return -1;
                      if (catB === 'auto_dropped' && catA !== 'auto_dropped') return 1;
                      return (b.planned_date || '').localeCompare(a.planned_date || '');
                    });

                  return (
                    <React.Fragment key={sale.userId}>
                      {/* Master Row */}
                      <tr
                        onClick={() => setExpandedSalesId(isExpanded ? null : sale.userId)}
                        className={`transition cursor-pointer ${
                          isExpanded 
                            ? 'bg-indigo-50/70 border-b-2 border-indigo-200' 
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            {sale.avatarUrl ? (
                              <img src={sale.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                                {sale.name.slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-slate-900 text-xs">{sale.name}</div>
                              {sale.email && <div className="text-[10px] text-slate-400">{sale.email}</div>}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-slate-100">
                            {sale.completed > 0 && (
                              <div
                                className="bg-emerald-500"
                                style={{ width: `${(sale.completed / sale.total) * 100}%` }}
                                title={`สำเร็จ: ${sale.completed}`}
                              />
                            )}
                            {sale.todayActive > 0 && (
                              <div
                                className="bg-emerald-300"
                                style={{ width: `${(sale.todayActive / sale.total) * 100}%` }}
                                title={`รอดำเนินการวันนี้: ${sale.todayActive}`}
                              />
                            )}
                            {sale.overdueGrace > 0 && (
                              <div
                                className="bg-amber-500"
                                style={{ width: `${(sale.overdueGrace / sale.total) * 100}%` }}
                                title={`ยังไม่เข้าพบ: ${sale.overdueGrace}`}
                              />
                            )}
                            {sale.autoDropped > 0 && (
                              <div
                                className="bg-slate-400"
                                style={{ width: `${(sale.autoDropped / sale.total) * 100}%` }}
                                title={`ซ่อนออโต้: ${sale.autoDropped}`}
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
                          <div className="text-[10px] text-slate-500 font-semibold mt-1">
                            ความสำเร็จ {sale.completionRate}%
                          </div>
                        </td>

                        <td className="py-3 px-3 text-center font-bold text-emerald-600">
                          {sale.completed > 0 ? sale.completed : '-'}
                        </td>

                        <td className="py-3 px-3 text-center bg-emerald-50/70 font-black">
                          {sale.todayActive > 0 ? (
                            <span className="bg-emerald-600 text-white px-2.5 py-0.5 rounded-full text-xs font-black shadow-xs">
                              {sale.todayActive}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-center bg-amber-50/60 font-black">
                          {sale.overdueGrace > 0 ? (
                            <span className="bg-amber-600 text-white px-2.5 py-0.5 rounded-full text-xs font-black shadow-xs">
                              {sale.overdueGrace}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-center bg-slate-100/60 font-bold text-slate-700">
                          {sale.autoDropped > 0 ? (
                            <span className="bg-slate-200 text-slate-800 px-2 py-0.5 rounded-full text-xs">
                              {sale.autoDropped}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-center text-amber-700">
                          {sale.upcoming > 0 ? sale.upcoming : '-'}
                        </td>

                        <td className="py-3 px-3 text-center font-black text-slate-900">
                          {sale.total}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedSalesId(isExpanded ? null : sale.userId);
                            }}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 w-full cursor-pointer ${
                              isExpanded
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : sale.overdueGrace > 0
                                  ? 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100'
                                  : sale.todayActive > 0
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                                    : sale.autoDropped > 0
                                      ? 'bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-200'
                                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                            }`}
                          >
                            <span>
                              {isExpanded
                                ? 'หุบเก็บ'
                                : sale.overdueGrace > 0
                                  ? `ยังไม่เข้าพบ (${sale.overdueGrace})`
                                  : sale.todayActive > 0
                                    ? `นัดวันนี้ (${sale.todayActive})`
                                    : sale.autoDropped > 0
                                      ? `ซ่อนออโต้ (${sale.autoDropped})`
                                      : `ดูทั้งหมด (${sale.total})`}
                            </span>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>
                      </tr>

                      {/* Accordion Detail: Expands right beneath the salesperson! */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b-2 border-indigo-200 animate-in fade-in">
                          <td colSpan={10} className="p-4 sm:p-6">
                            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                              {/* Sub Header inside Accordion */}
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
                                <div>
                                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                    <Building2 size={16} className="text-indigo-600" />
                                    <span>รายการแผนงานของ <span className="text-indigo-600 underline font-black">{sale.name}</span></span>
                                  </h4>
                                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 mt-1">
                                    <span className="inline-flex items-center gap-1.5">
                                      <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                                      <b className="text-emerald-800">แถบสีเขียว</b>: นัดหมายวันนี้ (รอดำเนินการ)
                                    </span>
                                    <span className="text-slate-300">|</span>
                                    <span className="inline-flex items-center gap-1.5">
                                      <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
                                      <b className="text-amber-800">แถบสีส้ม</b>: ยังไม่เข้าพบ (1-20 วัน)
                                    </span>
                                    <span className="text-slate-300">|</span>
                                    <span className="inline-flex items-center gap-1.5">
                                      <span className="w-2.5 h-2.5 rounded-xs bg-slate-400" />
                                      <b className="text-slate-700">แถบสีเทา</b>: ซ่อนออโต้แล้ว (&gt;20 วัน)
                                    </span>
                                  </div>
                                </div>

                                {/* Filter Pills for this Sales Rep */}
                                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-md text-xs font-semibold">
                                  <button
                                    onClick={() => setExpandedFilterTab('overdue_all')}
                                    className={`px-2.5 py-1 rounded transition cursor-pointer ${
                                      expandedFilterTab === 'overdue_all'
                                        ? 'bg-indigo-600 text-white font-bold shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                  >
                                    งานที่ต้องทำ ({sale.todayActive + sale.overdueGrace + sale.autoDropped})
                                  </button>

                                  {sale.todayActive > 0 && (
                                    <button
                                      onClick={() => setExpandedFilterTab('today')}
                                      className={`px-2.5 py-1 rounded transition cursor-pointer ${
                                        expandedFilterTab === 'today'
                                          ? 'bg-emerald-600 text-white font-bold shadow-xs'
                                          : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                      }`}
                                    >
                                      🟢 นัดวันนี้ รอดำเนินการ ({sale.todayActive})
                                    </button>
                                  )}

                                  <button
                                    onClick={() => setExpandedFilterTab('overdue_grace')}
                                    className={`px-2.5 py-1 rounded transition cursor-pointer ${
                                      expandedFilterTab === 'overdue_grace'
                                        ? 'bg-amber-600 text-white font-bold shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                  >
                                    🕒 ยังไม่เข้าพบ ({sale.overdueGrace})
                                  </button>

                                  <button
                                    onClick={() => setExpandedFilterTab('auto_dropped')}
                                    className={`px-2.5 py-1 rounded transition cursor-pointer ${
                                      expandedFilterTab === 'auto_dropped'
                                        ? 'bg-slate-800 text-white font-bold shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                  >
                                    🤖 ซ่อนออโต้แล้ว ({sale.autoDropped})
                                  </button>

                                  <button
                                    onClick={() => setExpandedFilterTab('all')}
                                    className={`px-2.5 py-1 rounded transition cursor-pointer ${
                                      expandedFilterTab === 'all'
                                        ? 'bg-slate-700 text-white font-bold shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                  >
                                    ทั้งหมด ({sale.total})
                                  </button>
                                </div>
                              </div>

                              {/* Simple List of Plans for this Sales Rep */}
                              <div className="mt-3 space-y-2.5">
                                {salePlans.length === 0 ? (
                                  <div className="py-6 text-center text-slate-400 text-xs">
                                    ไม่มีรายการแผนงานในหมวดนี้
                                  </div>
                                ) : (
                                  salePlans.map(plan => {
                                    const cat = getPlanCategory(plan);
                                    const overdueDays = getOverdueDays(plan.planned_date);

                                    // 🎨 สไตล์แถบสีด้านซ้ายและพื้นหลัง แยกตามสถานะงาน ชัดเจนในแวบเดียว
                                    const cardStyle = cat === 'today'
                                      ? 'bg-emerald-50/60 hover:bg-emerald-50 border border-emerald-300 border-l-[6px] border-l-emerald-500'
                                      : cat === 'overdue_grace'
                                        ? 'bg-amber-50/60 hover:bg-amber-50 border border-amber-300 border-l-[6px] border-l-amber-500'
                                        : cat === 'auto_dropped'
                                          ? 'bg-slate-50/80 hover:bg-slate-100 border border-slate-200 border-l-[6px] border-l-slate-400'
                                          : cat === 'completed'
                                            ? 'bg-emerald-50/20 hover:bg-emerald-50/40 border border-emerald-200 border-l-[6px] border-l-emerald-600'
                                            : 'bg-sky-50/40 hover:bg-sky-50 border border-sky-200 border-l-[6px] border-l-sky-500';

                                    return (
                                      <div
                                        key={plan.id}
                                        className={`p-3.5 rounded-lg shadow-2xs transition flex flex-col md:flex-row md:items-center justify-between gap-3 ${cardStyle}`}
                                      >
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-slate-900 text-xs">
                                              {plan.companies?.name || 'ไม่ระบุชื่อบริษัท'}
                                            </span>

                                            {plan.projects?.project_name && (
                                              <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                                                โครงการ: {plan.projects.project_name}
                                              </span>
                                            )}

                                            {/* Status Badge */}
                                            {cat === 'today' ? (
                                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-300 px-2.5 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1.5 shadow-2xs">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                <span>🟢 รอดำเนินการ (นัดหมายวันนี้)</span>
                                              </span>
                                            ) : cat === 'overdue_grace' ? (
                                              <span className="bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1.5 shadow-2xs">
                                                <Clock size={12} className="text-amber-600" />
                                                <span>🕒 ยังไม่เข้าพบ (เลยกำหนด {overdueDays} วัน)</span>
                                              </span>
                                            ) : cat === 'auto_dropped' ? (
                                              <span className="bg-slate-100 text-slate-700 border border-slate-300 px-2.5 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1.5 shadow-2xs">
                                                <Bot size={12} className="text-indigo-600" />
                                                <span>🤖 ซ่อนออโต้แล้ว (เกินกำหนด {overdueDays} วัน)</span>
                                              </span>
                                            ) : cat === 'completed' ? (
                                              <span className="bg-emerald-100 text-emerald-700 border border-emerald-300 px-2.5 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1.5">
                                                <CheckCircle2 size={12} />
                                                <span>เข้าพบสำเร็จ</span>
                                              </span>
                                            ) : (
                                              <span className="bg-sky-50 text-sky-800 border border-sky-300 px-2.5 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1.5">
                                                <Clock size={12} />
                                                <span>รอพบในอนาคต</span>
                                              </span>
                                            )}
                                          </div>

                                          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1.5 flex-wrap">
                                            <span>
                                              {cat === 'today' ? (
                                                <>📅 วันนัดหมาย: <b className="text-emerald-700 font-bold">วันนี้ ({plan.planned_date?.split('T')[0]})</b></>
                                              ) : (
                                                <>📅 วันนัดเดิม: <b className="text-slate-700">{plan.planned_date ? plan.planned_date.split('T')[0] : '-'}</b> {overdueDays > 0 && <span className="text-amber-700 font-semibold">(ยังไม่เข้าพบ - เลยมา {overdueDays} วัน)</span>}</>
                                              )}
                                              {plan.start_time && ` เวลา ${plan.start_time.slice(0, 5)} น.`}
                                            </span>

                                            {plan.project_concept && (
                                              <span className="text-slate-400 italic line-clamp-1">
                                                - {plan.project_concept}
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        {/* Action Buttons with Permission Lock */}
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          {canEditPlan(plan) ? (
                                            <>
                                              {/* ปุ่มเลื่อนนัด */}
                                              <button
                                                onClick={() => {
                                                  setReschedulePlan(plan);
                                                  setRescheduleDate(new Date().toISOString().split('T')[0]);
                                                }}
                                                disabled={isProcessing}
                                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded shadow-xs flex items-center gap-1 transition cursor-pointer"
                                                title="เลื่อนวันนัดหมายใหม่ แพลนจะเด้งกลับไปแสดงในแอปทันที"
                                              >
                                                <CalendarPlus size={13} />
                                                <span>เลื่อนนัด</span>
                                              </button>

                                              {/* ปุ่มปล่อยงาน / ซ่อน */}
                                              {cat === 'hidden' || cat === 'auto_dropped' ? (
                                                <button
                                                  onClick={() => handleUpdateStatus(plan.id, 'pending')}
                                                  disabled={isProcessing}
                                                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold rounded shadow-xs flex items-center gap-1 transition cursor-pointer"
                                                  title="ดึงกลับมาแสดงในแอป"
                                                >
                                                  <Eye size={13} />
                                                  <span>แสดงในแอป</span>
                                                </button>
                                              ) : (
                                                <button
                                                  onClick={() => handleUpdateStatus(plan.id, 'cancelled')}
                                                  disabled={isProcessing}
                                                  className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold rounded shadow-xs flex items-center gap-1 transition cursor-pointer"
                                                  title="ปล่อยงานนี้ ซ่อนออกจากแอปมือถือทันที"
                                                >
                                                  <EyeOff size={13} />
                                                  <span>ปล่อยงาน/ซ่อน</span>
                                                </button>
                                              )}
                                            </>
                                          ) : (
                                            <div
                                              className="px-2.5 py-1.5 bg-slate-100 text-slate-400 border border-slate-200 text-xs font-semibold rounded flex items-center gap-1.5 cursor-not-allowed select-none"
                                              title="คุณสามารถดูข้อมูลงานของเพื่อนร่วมทีมได้ แต่แก้ไขได้เฉพาะงานของตัวเองเท่านั้น"
                                            >
                                              <Lock size={12} className="text-slate-400" />
                                              <span>เฉพาะเจ้าของงาน</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

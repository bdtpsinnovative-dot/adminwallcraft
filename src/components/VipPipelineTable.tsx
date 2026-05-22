'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Star, List, Map, ArrowDownWideNarrow, ArrowUpNarrowWide, 
  User, Target, Trophy, Maximize2, LayoutList, BarChart3, 
  CalendarDays, Smartphone, FileText,
  Edit2, Check, X, Loader2
} from 'lucide-react'; 

interface Props {
  projects: any[];
  profilesMap: Record<string, string>;
  salesStats: any[];
  customerTypes: { id: string; name: string }[]; 
  projectTypes: { id: string; name: string }[];
  productCategories: { id: string; name: string }[];
}

export default function VipPipelineTable({ projects, profilesMap, salesStats, customerTypes = [], projectTypes = [], productCategories = [] }: Props) {
  const router = useRouter();
  
  const [viewMode, setViewMode] = useState<'projects' | 'performance'>('projects');
  const [tab, setTab] = useState(2);
  const [sortArea, setSortArea] = useState<'desc' | 'asc' | 'none'>('none');
  const [sortBySales, setSortBySales] = useState<'projects' | 'area'>('projects');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  
  // 🌟 State แก้ไขหมายเหตุ (Comment)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState<string>('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  
  // State แก้ไขชื่อโครงการ
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [isSavingName, setIsSavingName] = useState(false);

  // State แก้ไขพื้นที่
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [editArea, setEditArea] = useState<string>('');
  const [isSavingArea, setIsSavingArea] = useState(false);

  // State แก้ไขชื่อลูกค้า
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editCustomerName, setEditCustomerName] = useState<string>('');
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  // State แก้ไขประเภทโครงการ (Project Type)
  const [editingProjectTypeId, setEditingProjectTypeId] = useState<string | null>(null);
  const [editProjectType, setEditProjectType] = useState<string>('');
  const [isSavingProjectType, setIsSavingProjectType] = useState(false);

  // State แก้ไขหมวดหมู่สินค้า (Product Category)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState<string>('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const formatDate = (isoString?: string) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear() + 543; 
    return `${day}/${month}/${year}`;
  };

  const handleToggleVip = async (projId: string, currentIsVip: boolean) => {
    if (!projId) return;
    try {
      setLoadingId(projId);
      const newVipStatus = !currentIsVip;
      const { error } = await supabase.from('order_item_projects').update({ is_important: newVipStatus }).eq('id', projId);
      if (error) throw error;
      router.refresh();
    } catch (error) {
      console.error("Error updating VIP status:", error);
      alert("เกิดข้อผิดพลาดในการอัปเดตดาวครับ");
    } finally { setLoadingId(null); }
  };

  const handleSaveName = async (projId: string) => {
    if (!editName.trim()) { alert("ชื่อโครงการไม่สามารถเป็นค่าว่างได้ครับ"); return; }
    try {
      setIsSavingName(true);
      const { error } = await supabase.from('order_item_projects').update({ project_name: editName.trim() }).eq('id', projId);
      if (error) throw error;
      router.refresh();
      setEditingId(null); 
    } catch (error) { console.error("Error updating project name:", error); alert("เกิดข้อผิดพลาดในการบันทึกชื่อโครงการครับ");
    } finally { setIsSavingName(false); }
  };

  const handleSaveArea = async (projId: string) => {
    try {
      setIsSavingArea(true);
      const newArea = Number(editArea) || 0; 
      const { error } = await supabase.from('order_item_projects').update({ area_sqm: newArea }).eq('id', projId);
      if (error) throw error;
      router.refresh();
      setEditingAreaId(null); 
    } catch (error) { console.error("Error updating project area:", error); alert("เกิดข้อผิดพลาดในการบันทึกพื้นที่ครับ");
    } finally { setIsSavingArea(false); }
  };

  const handleSaveCustomer = async (orderId: string) => {
    if (!orderId) return;
    if (!editCustomerName.trim()) { alert("ชื่อลูกค้าไม่สามารถเป็นค่าว่างได้ครับ"); return; }
    try {
      setIsSavingCustomer(true);
      const { error } = await supabase.from('orders').update({ customer_name: editCustomerName.trim() }).eq('id', orderId);
      if (error) throw error;
      router.refresh();
      setEditingCustomerId(null); 
    } catch (error) { console.error("Error updating customer name:", error); alert("เกิดข้อผิดพลาดในการบันทึกชื่อลูกค้าครับ");
    } finally { setIsSavingCustomer(false); }
  };

  // 🌟 ฟังก์ชันบันทึก หมายเหตุ
  const handleSaveNote = async (projId: string) => {
    try {
      setIsSavingNote(true);
      const { error } = await supabase
        .from('order_item_projects')
        .update({ project_note: editNote.trim() })
        .eq('id', projId);

      if (error) throw error;
      router.refresh();
      setEditingNoteId(null); 
    } catch (error) { 
      console.error("Error updating note:", error); 
      alert("เกิดข้อผิดพลาดในการบันทึกหมายเหตุครับ");
    } finally { 
      setIsSavingNote(false); 
    }
  };

  // 🌟 ฟังก์ชันบันทึก ประเภทโครงการ (รับค่า value เข้ามาเซฟเลย)
  const handleSaveProjectType = async (projId: string, newValue: string) => {
    try {
      setIsSavingProjectType(true);
      const { error } = await supabase
        .from('order_item_projects')
        .update({ project_type_id: newValue || null })
        .eq('id', projId);

      if (error) throw error;
      router.refresh();
    } catch (error) {
      console.error("Error updating project type:", error);
      alert("เกิดข้อผิดพลาดในการบันทึกประเภทโครงการครับ");
    } finally {
      setIsSavingProjectType(false);
      setEditingProjectTypeId(null); // ซ่อน Dropdown ทันทีเมื่อเซฟเสร็จ
    }
  };

  // 🌟 ฟังก์ชันบันทึก หมวดหมู่สินค้า (รับค่า value เข้ามาเซฟเลย)
  const handleSaveProductCategory = async (orderItemId: string, newValue: string) => {
    if (!orderItemId) return;
    try {
      setIsSavingCategory(true);
      const { error } = await supabase
        .from('order_items')
        .update({ product_category_id: newValue || null })
        .eq('id', orderItemId);

      if (error) throw error;
      router.refresh();
    } catch (error) {
      console.error("Error updating product category:", error);
      alert("เกิดข้อผิดพลาดในการบันทึกประเภทสินค้าครับ");
    } finally {
      setIsSavingCategory(false);
      setEditingCategoryId(null); // ซ่อน Dropdown ทันทีเมื่อเซฟเสร็จ
    }
  };

  let displayProjects = projects.filter(proj => {
    const isVip = proj.is_important === true || proj.is_important === 'true' || proj.is_important === 1;
    const pName = proj.project_name ? proj.project_name.trim() : "";
    const isNoName = !pName || pName === "" || pName === "-" || pName.includes("ไม่มีการระบุโครงการ") || pName.includes("ไม่ระบุ");

    if (tab === 1) return isVip;       
    if (tab === 2) return true;        
    if (tab === 3) return !isNoName;   
    if (tab === 4) return isNoName;    
    return true;
  });

  displayProjects = [...displayProjects].sort((a, b) => {
    const areaA = Number(a.area_sqm) || 0;
    const areaB = Number(b.area_sqm) || 0;
    if (sortArea === 'desc') return areaB - areaA;
    if (sortArea === 'asc') return areaA - areaB;
    return 0; 
  });

  const sortedSalesStats = [...salesStats].sort((a, b) => {
    if (sortBySales === 'projects') return b.projects - a.projects;
    if (sortBySales === 'area') return b.area - a.area;
    return 0;
  });

  const getRoleColor = (roleName: string) => {
    const name = roleName.toLowerCase();
    if (name.includes('dev')) return 'bg-blue-100 text-blue-700';
    if (name.includes('arch')) return 'bg-purple-100 text-purple-700';
    if (name.includes('interior')) return 'bg-pink-100 text-pink-700';
    if (name.includes('contractor')) return 'bg-orange-100 text-orange-700';
    if (name.includes('office')) return 'bg-emerald-100 text-emerald-700';
    return 'bg-slate-100 text-slate-700'; 
  };

  const getActiveAccount = (proj: any) => {
    for (const type of customerTypes) {
      const key = `account_${type.name.toLowerCase()}`;
      const accountName = proj[key];

      if (accountName && typeof accountName === 'string' && accountName.trim()) {
        return { role: type.name, name: accountName.trim(), color: getRoleColor(type.name) };
      }
    }
    return null;
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden flex flex-col mb-8">
      <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${viewMode === 'projects' ? 'bg-rose-500' : 'bg-indigo-600'} text-white shadow-lg`}>
              {viewMode === 'projects' ? <LayoutList size={24} /> : <BarChart3 size={24} />}
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">
                {viewMode === 'projects' ? 'ระบบติดตามโครงการ (Project Tracker)' : 'ผลงานทีมปฏิบัติการขาย (Sales Ranking)'}
              </h2>
              <p className="text-slate-500 text-sm font-medium">จัดการข้อมูลและวิเคราะห์ผลงานแบบรวมศูนย์</p>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-inner">
            <button
              onClick={() => setViewMode('projects')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'projects' ? 'bg-white text-rose-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Star size={16} fill={viewMode === 'projects' ? "currentColor" : "none"} /> ข้อมูลโปรเจกต์
            </button>
            <button
              onClick={() => setViewMode('performance')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'performance' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Trophy size={16} /> อันดับเซลส์
            </button>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-between items-center gap-4">
          {viewMode === 'projects' ? (
            <>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setTab(1)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border flex items-center gap-1 ${tab === 1 ? 'bg-yellow-400 text-yellow-900 border-yellow-400 shadow-md' : 'bg-white text-slate-600 border-slate-200'}`}>
                  <Star size={14} fill={tab === 1 ? "currentColor" : "none"} /> โครงการติดดาว
                </button>
                <button onClick={() => setTab(2)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${tab === 2 ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-600 border-slate-200'}`}>ทั้งหมด</button>
                <button onClick={() => setTab(3)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${tab === 3 ? 'bg-emerald-500 text-white border-emerald-500 shadow-md' : 'bg-white text-slate-600 border-slate-200'}`}>ทั้งหมด แบบมีโครงการ</button>
                <button onClick={() => setTab(4)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${tab === 4 ? 'bg-rose-500 text-white border-rose-500 shadow-md' : 'bg-white text-slate-600 border-slate-200'}`}>ทั้งหมด แบบไม่มีโครงการ</button>
              </div>

              <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                <button onClick={() => setSortArea(sortArea === 'desc' ? 'none' : 'desc')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${sortArea === 'desc' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500'}`}><ArrowDownWideNarrow size={14} /> มากไปน้อย</button>
                <button onClick={() => setSortArea(sortArea === 'asc' ? 'none' : 'asc')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${sortArea === 'asc' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500'}`}><ArrowUpNarrowWide size={14} /> น้อยไปมาก</button>
              </div>
            </>
          ) : (
            <div className="flex gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
              <button onClick={() => setSortBySales('projects')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${sortBySales === 'projects' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}><Trophy size={14} /> จำนวนงานเยอะสุด</button>
              <button onClick={() => setSortBySales('area')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${sortBySales === 'area' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500'}`}><Maximize2 size={14} /> พื้นที่รวมเยอะสุด</button>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
        {viewMode === 'projects' ? (
          // 🌟 ขยายความกว้างตารางเป็น 1600px เพื่อให้มีพื้นที่สำหรับคอลัมน์หมายเหตุ
          <table className="w-full text-left text-sm table-fixed min-w-[1600px]">
           <thead className="text-slate-500 text-xs uppercase font-black tracking-widest sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-5 py-4 border-b border-slate-200 bg-slate-50 w-[8%]">วันที่</th>
              <th className="px-5 py-4 border-b border-slate-200 bg-slate-50 w-[10%]">เซลส์</th>
              <th className="px-5 py-4 border-b border-slate-200 bg-slate-50 w-[12%]">ผู้ดูแล (ACCOUNT)</th>
              <th className="px-5 py-4 border-b border-slate-200 bg-slate-50 w-[20%]">โปรเจกต์</th>
              
              {/* 🌟 คอลัมน์ใหม่: หมายเหตุ */}
              <th className="px-5 py-4 border-b border-slate-200 bg-slate-50 w-[15%]">คอมเมนต์</th>
              
              <th className="px-5 py-4 border-b border-slate-200 bg-slate-50 w-[12%]">ประเภทโครงการ</th>
              <th className="px-3 py-4 border-b border-slate-200 bg-slate-50 w-[8%]">ประเภทสินค้า</th>
              <th className="px-3 py-4 border-b border-slate-200 bg-slate-50 text-right w-[6%]">(ตร.ม.)</th>
              <th className="px-3 py-4 border-b border-slate-200 bg-slate-50 w-[5%]">ลูกค้า</th>
              <th className="px-3 py-4 border-b border-slate-200 bg-slate-50 text-center w-[4%]">ช่องทาง</th>
            </tr>
          </thead>
            <tbody className="divide-y divide-slate-100">
              {displayProjects.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-10 text-slate-400">ไม่พบข้อมูลโครงการในหมวดนี้ครับ</td></tr>
              ) : (
                displayProjects.map((proj, idx) => {
                  const item = Array.isArray(proj.order_items) ? proj.order_items[0] : proj.order_items;
                  const order = item?.orders;
                  const activeAccount = getActiveAccount(proj);
                  const salesName = profilesMap[order?.user_id] || 'ไม่ระบุ';
                  
                  const hasAuditLog = !!order?.audit_log;
                  const isVip = proj.is_important === true || proj.is_important === 'true' || proj.is_important === 1;
                  const isLoading = loadingId === proj.id;
                  
                  const isEditingName = editingId === proj.id;
                  const isEditingNote = editingNoteId === proj.id; // 🌟 เช็คสถานะการแก้ไขหมายเหตุ
                  const isEditingArea = editingAreaId === proj.id;
                  const isEditingCustomer = editingCustomerId === proj.id; 
                  
                  const isEditingProjectType = editingProjectTypeId === proj.id;
                  const isEditingCategory = editingCategoryId === item?.id;

                  const projectTypeName = proj.project_types?.name || '-';
                  const productCategoryName = item?.product_categories?.name || '-';

                  return (
                    <tr key={proj.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 align-middle">
                        <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                          <CalendarDays size={14} className="text-slate-400" />
                          {formatDate(proj.created_at)}
                        </div>
                      </td>
                      
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold bg-slate-100 w-fit px-2 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                          <User size={12} className="shrink-0" /> 
                          <span className="whitespace-normal break-words" title={salesName}>{salesName}</span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {activeAccount ? (
                          <div className="flex flex-col items-start gap-1.5">
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${activeAccount.color} shrink-0 w-fit`}>{activeAccount.role}</span>
                            <span className="text-slate-700 font-medium whitespace-normal break-words">{activeAccount.name}</span>
                          </div>
                        ) : <span className="text-slate-300">-</span>}
                      </td>

                      <td className="px-5 py-4 align-middle">
                        <div className="font-bold text-slate-800 flex items-start gap-2">
                          <button 
                            onClick={() => handleToggleVip(proj.id, isVip)}
                            disabled={isLoading}
                            className={`mt-0.5 shrink-0 transition-all ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-125'}`}
                            title={isVip ? "คลิกเพื่อเอาดาวออก" : "คลิกเพื่อติดดาวให้โปรเจกต์นี้"}
                          >
                            <Star size={18} className={isVip ? "text-rose-500 fill-rose-500" : "text-slate-300 hover:text-rose-400 hover:fill-rose-100"} />
                          </button>
                          
                          {isEditingName ? (
                            <div className="flex items-center gap-1 w-full max-w-full">
                              <input 
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="border border-indigo-300 rounded px-2 py-1 text-sm outline-none w-full focus:ring-2 focus:ring-indigo-100"
                                autoFocus
                                disabled={isSavingName}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveName(proj.id);
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                              />
                              <div className="flex flex-col gap-0.5 shrink-0">
                                <button onClick={() => handleSaveName(proj.id)} disabled={isSavingName} className="p-1 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 transition-colors" title="บันทึก (Enter)"><Check size={12} /></button>
                                <button onClick={() => setEditingId(null)} disabled={isSavingName} className="p-1 bg-rose-100 text-rose-700 rounded hover:bg-rose-200 transition-colors" title="ยกเลิก (Esc)"><X size={12} /></button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 group w-full cursor-pointer" onClick={() => { setEditingId(proj.id); setEditName(proj.project_name || ''); }}>
                              <span className="line-clamp-2 border-b border-dashed border-transparent group-hover:border-slate-400 transition-colors" title="คลิกเพื่อแก้ไขชื่อโครงการ">
                                {proj.project_name || 'ไม่ได้ระบุชื่อ'}
                              </span>
                              <Edit2 size={12} className="text-slate-300 group-hover:text-indigo-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0" />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 🌟 เซลล์ข้อมูลใหม่: หมายเหตุ */}
                      <td className="px-5 py-4 align-middle text-slate-600 text-sm">
                        {isEditingNote ? (
                          <div className="flex items-center gap-1 w-full max-w-full">
                            <input 
                              type="text"
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              className="border border-amber-300 rounded px-2 py-1 text-sm outline-none w-full focus:ring-2 focus:ring-amber-100 bg-amber-50"
                              autoFocus
                              disabled={isSavingNote}
                              placeholder="พิมพ์หมายเหตุ..."
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveNote(proj.id);
                                if (e.key === 'Escape') setEditingNoteId(null);
                              }}
                            />
                            <div className="flex flex-col gap-0.5 shrink-0">
                              <button onClick={() => handleSaveNote(proj.id)} disabled={isSavingNote} className="p-1 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 transition-colors" title="บันทึก (Enter)"><Check size={12} /></button>
                              <button onClick={() => setEditingNoteId(null)} disabled={isSavingNote} className="p-1 bg-rose-100 text-rose-700 rounded hover:bg-rose-200 transition-colors" title="ยกเลิก (Esc)"><X size={12} /></button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group w-full cursor-pointer" onClick={() => { setEditingNoteId(proj.id); setEditNote(proj.project_note || ''); }}>
                            <span className="line-clamp-2 border-b border-dashed border-transparent group-hover:border-slate-400 transition-colors" title="คลิกเพื่อแก้ไขหมายเหตุ">
                              {proj.project_note || <span className="text-slate-300 italic">แสดงความคิดเห็น</span>}
                            </span>
                            <Edit2 size={12} className="text-slate-300 group-hover:text-amber-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0" />
                          </div>
                        )}
                      </td>

                      {/* 🌟 แสดง/แก้ไข ข้อมูล ประเภทโครงการ */}
                      <td className="px-5 py-4 align-middle text-slate-600 text-sm font-medium relative">
                        {isEditingProjectType ? (
                          <div className="w-full relative">
                            <select 
                              autoFocus
                              value={editProjectType} 
                              onChange={(e) => {
                                setEditProjectType(e.target.value);
                                handleSaveProjectType(proj.id, e.target.value); // เซฟทันทีที่เลือก
                              }}
                              onBlur={() => setEditingProjectTypeId(null)} // ปิดถ้ายกเลิก/คลิกที่อื่น
                              className="border border-indigo-400 rounded px-2 py-1.5 text-sm outline-none w-full focus:ring-2 focus:ring-indigo-200 bg-white shadow-sm appearance-none"
                              disabled={isSavingProjectType}
                            >
                              <option value="">- เลือกระบุ -</option>
                              {projectTypes.map(pt => (
                                <option key={pt.id} value={pt.id}>{pt.name}</option>
                              ))}
                            </select>
                            {isSavingProjectType && <Loader2 size={14} className="absolute right-2 top-2 text-indigo-500 animate-spin" />}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => {
                            setEditingProjectTypeId(proj.id);
                            setEditProjectType(proj.project_type_id || '');
                          }}>
                            <span className="line-clamp-2 border-b border-dashed border-transparent group-hover:border-slate-400 transition-colors" title="คลิกเพื่อแก้ไขประเภทโครงการ">
                              {projectTypeName}
                            </span>
                            <Edit2 size={12} className="text-slate-300 group-hover:text-indigo-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0" />
                          </div>
                        )}
                      </td>

                      {/* 🌟 แสดง/แก้ไข ข้อมูล ประเภทสินค้า */}
                      <td className="px-5 py-4 align-middle text-slate-600 text-sm font-medium relative">
                        {isEditingCategory ? (
                          <div className="w-full relative">
                            <select 
                              autoFocus
                              value={editCategory} 
                              onChange={(e) => {
                                setEditCategory(e.target.value);
                                handleSaveProductCategory(item?.id, e.target.value); // เซฟทันทีที่เลือก
                              }}
                              onBlur={() => setEditingCategoryId(null)} // ปิดถ้ายกเลิก/คลิกที่อื่น
                              className="border border-sky-400 rounded px-2 py-1.5 text-sm outline-none w-full focus:ring-2 focus:ring-sky-200 bg-white shadow-sm appearance-none"
                              disabled={isSavingCategory}
                            >
                              <option value="">- เลือกระบุ -</option>
                              {productCategories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                              ))}
                            </select>
                            {isSavingCategory && <Loader2 size={14} className="absolute right-2 top-2 text-sky-500 animate-spin" />}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => {
                            if (item?.id) {
                              setEditingCategoryId(item.id);
                              setEditCategory(item.product_category_id || '');
                            }
                          }}>
                            <span className="line-clamp-2 border-b border-dashed border-transparent group-hover:border-slate-400 transition-colors" title="คลิกเพื่อแก้ไขหมวดหมู่สินค้า">
                              {productCategoryName}
                            </span>
                            {item?.id && <Edit2 size={12} className="text-slate-300 group-hover:text-sky-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0" />}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 align-middle text-right">
                        {isEditingArea ? (
                          <div className="flex items-center justify-end gap-1 w-full">
                            <input 
                              type="number"
                              value={editArea}
                              onChange={(e) => setEditArea(e.target.value)}
                              className="border border-emerald-300 rounded px-2 py-1 text-sm outline-none w-20 text-right focus:ring-2 focus:ring-emerald-100 font-bold text-emerald-700"
                              autoFocus
                              disabled={isSavingArea}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveArea(proj.id);
                                if (e.key === 'Escape') setEditingAreaId(null);
                              }}
                            />
                            <div className="flex flex-col gap-0.5">
                              <button onClick={() => handleSaveArea(proj.id)} disabled={isSavingArea} className="p-1 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 transition-colors" title="บันทึก (Enter)"><Check size={12} /></button>
                              <button onClick={() => setEditingAreaId(null)} disabled={isSavingArea} className="p-1 bg-rose-100 text-rose-700 rounded hover:bg-rose-200 transition-colors" title="ยกเลิก (Esc)"><X size={12} /></button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2 group cursor-pointer" onClick={() => { setEditingAreaId(proj.id); setEditArea(proj.area_sqm?.toString() || '0'); }}>
                            <Edit2 size={12} className="text-slate-300 group-hover:text-emerald-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0" />
                            <span className="font-black text-emerald-600 text-base border-b border-dashed border-transparent group-hover:border-emerald-300 transition-colors" title="คลิกเพื่อแก้ไขพื้นที่">
                              {Number(proj.area_sqm).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 text-slate-600 font-medium whitespace-normal break-words">
                        {isEditingCustomer ? (
                          <div className="flex items-center gap-1 w-full max-w-full">
                            <input 
                              type="text"
                              value={editCustomerName}
                              onChange={(e) => setEditCustomerName(e.target.value)}
                              className="border border-sky-300 rounded px-2 py-1 text-sm outline-none w-full focus:ring-2 focus:ring-sky-100 text-slate-700 font-semibold"
                              autoFocus
                              disabled={isSavingCustomer}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveCustomer(order?.id);
                                if (e.key === 'Escape') setEditingCustomerId(null);
                              }}
                            />
                            <div className="flex flex-col gap-0.5 shrink-0">
                              <button onClick={() => handleSaveCustomer(order?.id)} disabled={isSavingCustomer} className="p-1 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 transition-colors" title="บันทึก (Enter)"><Check size={12} /></button>
                              <button onClick={() => setEditingCustomerId(null)} disabled={isSavingCustomer} className="p-1 bg-rose-100 text-rose-700 rounded hover:bg-rose-200 transition-colors" title="ยกเลิก (Esc)"><X size={12} /></button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group w-full cursor-pointer" onClick={() => {
                            if(order?.id) { 
                              setEditingCustomerId(proj.id);
                              setEditCustomerName(order?.customer_name || '');
                            }
                          }}>
                            <span className="line-clamp-2 border-b border-dashed border-transparent group-hover:border-slate-400 transition-colors" title="คลิกเพื่อแก้ไขชื่อลูกค้า">
                              {order?.customer_name || '-'}
                            </span>
                            {order?.id && <Edit2 size={12} className="text-slate-300 group-hover:text-sky-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0" />}
                          </div>
                        )}
                      </td>
                      
                      <td className="px-5 py-4 align-middle text-center">
                        {hasAuditLog ? (
                          <div className="mx-auto flex items-center justify-center gap-1.5 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-md w-fit shadow-sm">
                            <Smartphone size={12} /> Mobile App
                          </div>
                        ) : (
                          <div className="mx-auto flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md w-fit shadow-sm">
                            <FileText size={12} /> CSV File
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left text-sm table-fixed min-w-[800px]">
            <thead className="text-slate-500 text-xs uppercase font-black tracking-widest sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-8 py-4 border-b border-slate-200 bg-slate-50 w-[10%] text-center">อันดับ</th>
                <th className="px-8 py-4 border-b border-slate-200 bg-slate-50 w-[45%]">รายชื่อพนักงานขาย</th>
                <th className="px-8 py-4 border-b border-slate-200 bg-slate-50 w-[20%] text-center">จำนวนงาน</th>
                <th className="px-8 py-4 border-b border-slate-200 bg-slate-50 w-[25%] text-right">พื้นที่รวม (ตร.ม.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedSalesStats.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-10 text-slate-400">ไม่มีข้อมูลผลงานเซลส์ครับ</td></tr>
              ) : (
                sortedSalesStats.map((stat, idx) => (
                  <tr key={stat.id || idx} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-8 py-5 text-center">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-black text-sm shadow-sm ${idx === 0 ? 'bg-yellow-400 text-white ring-4 ring-yellow-100' : 'bg-slate-100 text-slate-500'}`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black shadow-inner">
                          {stat.name.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-800 text-base">{stat.name}</span>
                      </div>
                    </td>
                    <td className={`px-8 py-5 text-center text-lg font-black ${sortBySales === 'projects' ? 'text-indigo-600' : 'text-slate-600'}`}>
                      {stat.projects} <span className="text-xs font-bold text-slate-400 ml-1">งาน</span>
                    </td>
                    <td className={`px-8 py-5 text-right text-lg font-black ${sortBySales === 'area' ? 'text-emerald-600' : 'text-slate-700'}`}>
                      {stat.area.toLocaleString()} <span className="text-xs font-bold text-slate-400 ml-1">ตร.ม.</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
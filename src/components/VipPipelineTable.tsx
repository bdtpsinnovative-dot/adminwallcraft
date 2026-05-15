'use client';
import { useState } from 'react';
import { 
  Star, List, Map, ArrowDownWideNarrow, ArrowUpNarrowWide, 
  User, Target, Trophy, Maximize2, LayoutList, BarChart3, 
  CalendarDays, Smartphone, FileText 
} from 'lucide-react';

// 🌟 เพิ่ม customerTypes เข้ามาใน Props
interface Props {
  projects: any[];
  profilesMap: Record<string, string>;
  salesStats: any[];
  customerTypes: { id: string; name: string }[]; 
}

export default function VipPipelineTable({ projects, profilesMap, salesStats, customerTypes = [] }: Props) {
  const [viewMode, setViewMode] = useState<'projects' | 'performance'>('projects');
  const [tab, setTab] = useState(2);
  const [sortArea, setSortArea] = useState<'desc' | 'asc' | 'none'>('none');
  const [sortBySales, setSortBySales] = useState<'projects' | 'area'>('projects');

  const formatDate = (isoString?: string) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear() + 543; 
    return `${day}/${month}/${year}`;
  };

  let displayProjects = projects.filter(proj => {
    const isVip = proj.is_important === true || proj.is_important === 'true' || proj.is_important === 1;
    
    const pName = proj.project_name ? proj.project_name.trim() : "";
    const isNoName = !pName || 
                     pName === "" || 
                     pName === "-" || 
                     pName.includes("ไม่มีการระบุโครงการ") ||
                     pName.includes("ไม่ระบุ");

    if (tab === 1) return isVip; 
    if (tab === 2) return !isNoName; 
    if (tab === 3) {
      const hasArea = Number(proj.area_sqm) > 0;
      return hasArea && isNoName; 
    }
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

  // 🌟 ฟังก์ชันแยกสีตามชื่อ Type
  const getRoleColor = (roleName: string) => {
    const name = roleName.toLowerCase();
    if (name.includes('dev')) return 'bg-blue-100 text-blue-700';
    if (name.includes('arch')) return 'bg-purple-100 text-purple-700';
    if (name.includes('interior')) return 'bg-pink-100 text-pink-700';
    if (name.includes('contractor')) return 'bg-orange-100 text-orange-700';
    if (name.includes('office')) return 'bg-emerald-100 text-emerald-700';
    return 'bg-slate-100 text-slate-700'; // สี Default
  };

  // 🌟 ฟังก์ชันหาคนดูแลแบบดึงตาม Database
  const getActiveAccount = (proj: any) => {
    // วนลูปเช็คประเภทจาก DB ที่โยนเข้ามา
    for (const type of customerTypes) {
      const key = `account_${type.name.toLowerCase()}`;
      const accountName = proj[key];

      if (accountName && typeof accountName === 'string' && accountName.trim()) {
        return {
          role: type.name, 
          name: accountName.trim(),
          color: getRoleColor(type.name)
        };
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
                <button onClick={() => setTab(1)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${tab === 1 ? 'bg-rose-500 text-white border-rose-500 shadow-md' : 'bg-white text-slate-600 border-slate-200'}`}>โครงการติดดาว</button>
                <button onClick={() => setTab(2)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${tab === 2 ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-600 border-slate-200'}`}>ทั้งหมด</button>
                <button onClick={() => setTab(3)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${tab === 3 ? 'bg-amber-500 text-white border-amber-500 shadow-md' : 'bg-white text-slate-600 border-slate-200'}`}>ไม่มีชื่อ แต่มี SQM</button>
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
          <table className="w-full text-left text-sm table-fixed min-w-[1200px]">
            <thead className="text-slate-500 text-xs uppercase font-black tracking-widest sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-5 py-4 border-b border-slate-200 bg-slate-50 w-[10%]">วันที่</th>
                <th className="px-5 py-4 border-b border-slate-200 bg-slate-50 w-[15%]">เซลส์</th>
                <th className="px-5 py-4 border-b border-slate-200 bg-slate-50 w-[15%]">ผู้ดูแล (ACCOUNT)</th>
                <th className="px-5 py-4 border-b border-slate-200 bg-slate-50 w-[20%]">โปรเจกต์</th>
                <th className="px-5 py-4 border-b border-slate-200 bg-slate-50 text-right w-[10%]">พื้นที่ (ตร.ม.)</th>
                <th className="px-5 py-4 border-b border-slate-200 bg-slate-50 w-[15%]">ลูกค้า</th>
                <th className="px-5 py-4 border-b border-slate-200 bg-slate-50 w-[15%] text-center">ช่องทาง</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayProjects.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400">ไม่พบข้อมูลโครงการในหมวดนี้ครับ</td></tr>
              ) : (
                displayProjects.map((proj, idx) => {
                  const order = proj.order_items?.[0]?.orders || proj.order_items?.orders;
                  const activeAccount = getActiveAccount(proj);
                  const salesName = profilesMap[order?.user_id] || 'ไม่ระบุ';
                  
                  const hasAuditLog = !!order?.audit_log;

                  return (
                    <tr key={proj.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. วันที่ */}
                      <td className="px-5 py-4 align-middle">
                        <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                          <CalendarDays size={14} className="text-slate-400" />
                          {formatDate(proj.created_at)}
                        </div>
                      </td>
                      
                      {/* 2. เซลส์ */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold bg-slate-100 w-fit px-2 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                          <User size={12} className="shrink-0" /> 
                          <span className="whitespace-normal break-words" title={salesName}>{salesName}</span>
                        </div>
                      </td>

                      {/* 3. ผู้ดูแล (ACCOUNT) */}
                      <td className="px-5 py-4">
                        {activeAccount ? (
                          <div className="flex flex-col items-start gap-1.5">
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${activeAccount.color} shrink-0 w-fit`}>{activeAccount.role}</span>
                            <span className="text-slate-700 font-medium whitespace-normal break-words">{activeAccount.name}</span>
                          </div>
                        ) : <span className="text-slate-300">-</span>}
                      </td>

                      {/* 4. โปรเจกต์ */}
                      <td className="px-5 py-4 align-middle">
                        <div className="font-bold text-slate-800 flex items-start gap-2">
                          {proj.is_important && <Star size={14} className="text-rose-500 fill-rose-500 mt-1 shrink-0" />}
                          <span className="line-clamp-2">{proj.project_name || 'ไม่ได้ระบุชื่อ'}</span>
                        </div>
                      </td>

                      {/* 5. พื้นที่ (ตร.ม.) */}
                      <td className="px-5 py-4 text-right font-black text-emerald-600 text-base">
                        {Number(proj.area_sqm).toLocaleString()}
                      </td>

                      {/* 6. ลูกค้า */}
                      <td className="px-5 py-4 text-slate-600 font-medium whitespace-normal break-words line-clamp-2">
                        {order?.customer_name || '-'}
                      </td>
                      
                      {/* 7. ช่องทาง */}
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
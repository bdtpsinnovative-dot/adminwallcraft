'use client';
import { useState } from 'react';
import { Star, List, Map, ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';

export default function VipPipelineTable({ projects }: { projects: any[] }) {
  const [tab, setTab] = useState(2);
  const [sortArea, setSortArea] = useState<'desc' | 'asc' | 'none'>('none');

  let displayProjects = projects.filter(proj => {
    const isVip = proj.is_important === true || proj.is_important === 'true' || proj.is_important === 1;

    if (tab === 1) return isVip; 
    if (tab === 2) return true; 
    if (tab === 3) {
      const hasArea = Number(proj.area_sqm) > 0;
      const noName = !proj.project_name || proj.project_name.trim() === "" || proj.project_name === "ไม่มีการระบุโครงการ";
      return hasArea && noName;
    }
    
    return true;
  });

  displayProjects = displayProjects.sort((a, b) => {
    const areaA = Number(a.area_sqm) || 0;
    const areaB = Number(b.area_sqm) || 0;

    if (sortArea === 'desc') {
      return areaB - areaA;
    } else if (sortArea === 'asc') {
      return areaA - areaB;
    }
    return 0; 
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      <div className="p-5 border-b border-slate-100 bg-rose-50/30">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
          <Star size={18} className="text-rose-500 fill-rose-500" /> ระบบติดตามโครงการ (Project Tracker)
        </h3>
        
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setTab(1)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${tab === 1 ? 'bg-rose-500 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'}`}
            >
              <Star size={14} fill={tab === 1 ? "white" : "none"} /> โครงการติดดาว
            </button>
            <button 
              onClick={() => setTab(2)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${tab === 2 ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'}`}
            >
              <List size={14} /> โครงการทั้งหมด
            </button>
            <button 
              onClick={() => setTab(3)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${tab === 3 ? 'bg-amber-500 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'}`}
            >
              <Map size={14} /> มี SQM แต่ไม่มีชื่อ
            </button>
          </div>

          <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm shrink-0">
            <button 
              onClick={() => setSortArea(sortArea === 'desc' ? 'none' : 'desc')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${sortArea === 'desc' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <ArrowDownWideNarrow size={14} /> มากไปน้อย
            </button>
            <div className="w-px h-4 bg-slate-200"></div>
            <button 
              onClick={() => setSortArea(sortArea === 'asc' ? 'none' : 'asc')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${sortArea === 'asc' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <ArrowUpNarrowWide size={14} /> น้อยไปมาก
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[400px] relative">
        {/* เอา whitespace-nowrap ออก เพื่อไม่ให้ตารางมันถ่างจนทะลุจอ */}
        <table className="w-full text-left text-sm table-fixed min-w-[500px]">
          <thead className="text-slate-500 text-xs uppercase font-bold tracking-wider sticky top-0 z-10 shadow-sm">
            <tr>
              {/* กำหนด % ความกว้างให้ชัดเจน จะได้ไม่แย่งที่กัน */}
              <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 w-[50%]">ชื่อโปรเจกต์</th>
              <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 w-[25%]">ลูกค้า</th>
              <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-right w-[25%]">พื้นที่ (ตร.ม.)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayProjects.length === 0 ? (
              <tr><td colSpan={3} className="text-center py-10 text-slate-400">ไม่พบข้อมูลโครงการในหมวดนี้ครับ</td></tr>
            ) : (
              displayProjects.map((proj, idx) => {
                const orderItem = Array.isArray(proj.order_items) ? proj.order_items[0] : proj.order_items;
                const order = orderItem?.orders;
                
                const isItemVip = proj.is_important === true || proj.is_important === 'true' || proj.is_important === 1;

                return (
                  <tr key={proj.id || idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 align-middle">
                      {/* ย้าย flex มาอยู่ใน div แทน เพื่อไม่ให้ layout ตารางพัง */}
                      <div className="font-semibold text-slate-800 flex items-start gap-2">
                        {isItemVip && <Star size={14} className="text-rose-500 fill-rose-500 shrink-0 mt-0.5" />}
                        <span className="whitespace-normal break-words line-clamp-2">
                          {proj.project_name || <span className="text-slate-400 italic font-normal">ไม่ได้ระบุชื่อโครงการ</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 align-middle whitespace-normal break-words line-clamp-2">
                      {order?.customer_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600 align-middle whitespace-nowrap">
                      {Number(proj.area_sqm).toLocaleString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
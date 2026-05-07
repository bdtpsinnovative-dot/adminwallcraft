'use client';
import { useState } from 'react';
import { Target, Trophy, Maximize2 } from 'lucide-react';

export default function SalesPerformanceTable({ stats }: { stats: any[] }) {
  // sortBy: 'projects' = จำนวนงาน, 'area' = ตารางเมตร
  const [sortBy, setSortBy] = useState<'projects' | 'area'>('projects');

  // จัดลำดับข้อมูลใหม่ตามปุ่มที่เลือก (เรียงจากมากไปน้อยเสมอ)
  const sortedStats = [...stats].sort((a, b) => {
    if (sortBy === 'projects') return b.projects - a.projects;
    if (sortBy === 'area') return b.area - a.area;
    return 0;
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      <div className="p-5 border-b border-slate-100 bg-indigo-50/30">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Target size={18} className="text-indigo-600" /> ผลงานทีมปฏิบัติการขาย
          </h3>
          
          {/* ปุ่มฟิลเตอร์เรียงลำดับ */}
          <div className="flex gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
            <button
              onClick={() => setSortBy('projects')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                sortBy === 'projects' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Trophy size={14} /> งานเยอะสุด
            </button>
            <button
              onClick={() => setSortBy('area')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                sortBy === 'area' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Maximize2 size={14} /> พื้นที่เยอะสุด
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[400px] relative">
        <table className="w-full text-left text-sm table-fixed">
          <thead className="text-slate-500 text-xs uppercase font-bold tracking-wider sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-5 py-3 border-b border-slate-200 bg-slate-50 w-[55%]">รายชื่อเซลส์</th>
              <th className={`px-5 py-3 border-b border-slate-200 text-center bg-slate-50 w-[20%] ${sortBy === 'projects' ? 'text-indigo-600 font-black' : ''}`}>งาน</th>
              <th className={`px-5 py-3 border-b border-slate-200 text-right bg-slate-50 w-[25%] ${sortBy === 'area' ? 'text-emerald-600 font-black' : ''}`}>พื้นที่ (ตร.ม.)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedStats.length === 0 ? (
              <tr><td colSpan={3} className="text-center py-10 text-slate-500">ไม่มีข้อมูลการขายในช่วงเวลานี้</td></tr>
            ) : (
              sortedStats.map((stat, idx) => (
                <tr key={stat.id || idx} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 flex items-center gap-2 align-middle">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                      idx === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {idx + 1}
                    </div>
                    <span className="font-semibold text-slate-800 truncate" title={stat.name}>{stat.name}</span>
                  </td>
                  <td className={`px-5 py-3 text-center align-middle ${sortBy === 'projects' ? 'font-black text-indigo-700 bg-indigo-50/30' : 'text-slate-600'}`}>
                    {stat.projects}
                  </td>
                  <td className={`px-5 py-3 text-right align-middle ${sortBy === 'area' ? 'font-black text-emerald-700 bg-emerald-50/30' : 'font-bold text-slate-700'}`}>
                    {stat.area.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
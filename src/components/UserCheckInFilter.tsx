"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, Filter, X } from 'lucide-react';

export default function UserCheckInFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 🔥 เปลี่ยนค่าเริ่มต้นจาก 'ALL' เป็น 'APP'
  const urlStart = searchParams.get('start') || '';
  const urlEnd = searchParams.get('end') || '';
  const urlSource = searchParams.get('source') || 'APP'; 

  const [start, setStart] = useState(urlStart);
  const [end, setEnd] = useState(urlEnd);
  const [source, setSource] = useState(urlSource);

  useEffect(() => {
    setStart(urlStart);
    setEnd(urlEnd);
    setSource(urlSource);
  }, [urlStart, urlEnd, urlSource]);

  const applyFilters = (newStart: string, newEnd: string, newSource: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newStart) params.set('start', newStart); else params.delete('start');
    if (newEnd) params.set('end', newEnd); else params.delete('end');
    
    // ถ้าเลือก APP (ค่าเริ่มต้น) ไม่ต้องโชว์ใน URL ให้รก แต่ถ้าเป็น ALL หรือ CSV ค่อยโชว์
    if (newSource && newSource !== 'APP') params.set('source', newSource); 
    else params.delete('source');
    
    router.push(`?${params.toString()}`);
  };

  const clearAll = () => {
    setStart(''); 
    setEnd(''); 
    setSource('APP'); // กลับไปค่าเริ่มต้นคือ APP
    router.push('?');
  };

  // ปุ่มล้างค่าจะโชว์ก็ต่อเมื่อมีการใส่วันที่ หรือเปลี่ยนจาก APP เป็นอย่างอื่น
  const isFiltered = start || end || source !== 'APP';

  return (
    <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm mb-6">
      <div className="flex items-center gap-2 text-slate-500 font-bold text-sm mr-2 pl-2">
        <Filter size={16} /> ตัวกรอง:
      </div>
      
      {/* 1. กล่องเลือกวันที่ */}
      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 shadow-sm hover:border-indigo-300 transition-colors">
        <Calendar size={14} className="text-indigo-500" />
        <input 
          type="date" 
          className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer w-[110px]" 
          value={start} 
          onChange={(e) => { setStart(e.target.value); applyFilters(e.target.value, end, source); }} 
        />
        <span className="text-slate-300">-</span>
        <input 
          type="date" 
          className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer w-[110px]" 
          value={end} 
          onChange={(e) => { setEnd(e.target.value); applyFilters(start, e.target.value, source); }} 
        />
      </div>

      {/* 2. กล่องเลือกประเภทข้อมูล (App / CSV) */}
      <select 
        className={`border rounded-lg px-3 py-1.5 text-xs font-semibold outline-none shadow-sm cursor-pointer transition-colors
          ${source !== 'APP' ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'}`}
        value={source} 
        onChange={(e) => { setSource(e.target.value); applyFilters(start, end, e.target.value); }}
      >
        <option value="APP">📱 ลงพื้นที่หน้างาน (App)</option>
        <option value="CSV">📁 อัปโหลดไฟล์ (CSV)</option>
        <option value="ALL">🌐 ที่มา: ทั้งหมด</option>
      </select>

      {/* 3. ปุ่มล้างค่า */}
      {isFiltered && (
        <button 
          onClick={clearAll} 
          className="text-xs bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 hover:text-rose-700 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors shadow-sm ml-auto sm:ml-0"
        >
          <X size={14} strokeWidth={3} /> ล้างค่า
        </button>
      )}
    </div>
  );
}
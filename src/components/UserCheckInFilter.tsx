"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, Filter, X, Map, Users } from 'lucide-react';

export default function UserCheckInFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ดึงค่าจาก URL
  const urlStart = searchParams.get('start') || '';
  const urlEnd = searchParams.get('end') || '';
  const urlSource = searchParams.get('source') || 'APP'; 
  const urlMinArea = searchParams.get('minArea') || '';
  const urlMaxArea = searchParams.get('maxArea') || '';
  const urlRole = searchParams.get('role') || 'ALL'; 

  // สร้าง State เก็บค่า
  const [start, setStart] = useState(urlStart);
  const [end, setEnd] = useState(urlEnd);
  const [source, setSource] = useState(urlSource);
  const [minArea, setMinArea] = useState(urlMinArea);
  const [maxArea, setMaxArea] = useState(urlMaxArea);
  const [role, setRole] = useState(urlRole);

  useEffect(() => {
    setStart(urlStart);
    setEnd(urlEnd);
    setSource(urlSource);
    setMinArea(urlMinArea);
    setMaxArea(urlMaxArea);
    setRole(urlRole);
  }, [urlStart, urlEnd, urlSource, urlMinArea, urlMaxArea, urlRole]);

  const applyFilters = (
    newStart: string, newEnd: string, newSource: string, 
    newMin: string, newMax: string, newRole: string
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (newStart) params.set('start', newStart); else params.delete('start');
    if (newEnd) params.set('end', newEnd); else params.delete('end');
    if (newMin) params.set('minArea', newMin); else params.delete('minArea');
    if (newMax) params.set('maxArea', newMax); else params.delete('maxArea');
    
    if (newSource && newSource !== 'APP') params.set('source', newSource); else params.delete('source');
    if (newRole && newRole !== 'ALL') params.set('role', newRole); else params.delete('role');
    
    router.push(`?${params.toString()}`);
  };

  const clearAll = () => {
    setStart(''); setEnd(''); setSource('APP');
    setMinArea(''); setMaxArea(''); setRole('ALL');
    router.push('?');
  };

  // เช็คว่ามี Filter ไหนทำงานอยู่บ้าง (ใช้โชว์ปุ่มล้างค่า)
  const isFiltered = start || end || minArea || maxArea || source !== 'APP' || role !== 'ALL';

  return (
    <div className="flex flex-col md:flex-row flex-wrap items-start md:items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm mb-6">
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
          onChange={(e) => { setStart(e.target.value); applyFilters(e.target.value, end, source, minArea, maxArea, role); }} 
        />
        <span className="text-slate-300">-</span>
        <input 
          type="date" 
          className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer w-[110px]" 
          value={end} 
          onChange={(e) => { setEnd(e.target.value); applyFilters(start, e.target.value, source, minArea, maxArea, role); }} 
        />
      </div>

      {/* 2. กล่องกรอกพื้นที่ (ตร.ม.) */}
      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 shadow-sm hover:border-emerald-300 transition-colors">
        <Map size={14} className="text-emerald-500" />
        <input 
          type="number" placeholder="ตร.ม. ขั้นต่ำ"
          className="bg-transparent text-xs font-semibold text-slate-700 outline-none w-[80px]" 
          value={minArea} 
          onChange={(e) => { setMinArea(e.target.value); applyFilters(start, end, source, e.target.value, maxArea, role); }} 
        />
        <span className="text-slate-300">-</span>
        <input 
          type="number" placeholder="ตร.ม. สูงสุด"
          className="bg-transparent text-xs font-semibold text-slate-700 outline-none w-[80px]" 
          value={maxArea} 
          onChange={(e) => { setMaxArea(e.target.value); applyFilters(start, end, source, minArea, e.target.value, role); }} 
        />
      </div>

      {/* 3. กล่องเลือก Role ผู้เกี่ยวข้อง */}
      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 shadow-sm hover:border-purple-300 transition-colors">
        <Users size={14} className="text-purple-500" />
        <select 
          className="bg-transparent border-none text-xs font-semibold outline-none cursor-pointer text-slate-700"
          value={role} 
          onChange={(e) => { setRole(e.target.value); applyFilters(start, end, source, minArea, maxArea, e.target.value); }}
        >
          <option value="ALL">ผู้เกี่ยวข้องทั้งหมด</option>
          <option value="developer">มี Developer</option>
          <option value="architect">มี Architect</option>
          <option value="interior">มี Interior</option>
          <option value="contractor">มี Contractor</option>
        </select>
      </div>

      {/* 4. กล่องเลือกประเภทข้อมูล (App / CSV) */}
      <select 
        className={`border rounded-lg px-3 py-1.5 text-xs font-semibold outline-none shadow-sm cursor-pointer transition-colors
          ${source !== 'APP' ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'}`}
        value={source} 
        onChange={(e) => { setSource(e.target.value); applyFilters(start, end, e.target.value, minArea, maxArea, role); }}
      >
        <option value="APP">📱 ลงพื้นที่หน้างาน (App)</option>
        <option value="CSV">📁 อัปโหลดไฟล์ (CSV)</option>
        <option value="ALL">🌐 ที่มา: ทั้งหมด</option>
      </select>

      {/* 5. ปุ่มล้างค่า */}
      {isFiltered && (
        <button 
          onClick={clearAll} 
          className="text-xs bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 hover:text-rose-700 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors shadow-sm ml-auto md:ml-0"
        >
          <X size={14} strokeWidth={3} /> ล้างค่า
        </button>
      )}
    </div>
  );
}
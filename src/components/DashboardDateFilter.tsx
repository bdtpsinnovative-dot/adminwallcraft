"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, ChevronDown, X, Filter } from 'lucide-react';

type Props = {
  salesList: any[];
  projectTypes: any[];
  productCategories: any[];
};

export default function DashboardDateFilter({ salesList, projectTypes, productCategories }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ดึงค่าปัจจุบันจาก URL
  const urlStart = searchParams.get('start') || '';
  const urlEnd = searchParams.get('end') || '';
  const currentSales = searchParams.get('sales') || 'ALL';
  const currentProjectType = searchParams.get('projectType') || 'ALL';
  const currentProductCategory = searchParams.get('productCategory') || 'ALL';
  const currentSource = searchParams.get('source') || 'ALL'; // 🔥 มีตัวกรองที่มาแล้ว
  const currentMinArea = searchParams.get('minArea') || '';
  const currentMaxArea = searchParams.get('maxArea') || '';

  const [start, setStart] = useState(urlStart);
  const [end, setEnd] = useState(urlEnd);
  const [minAreaLocal, setMinAreaLocal] = useState(currentMinArea);
  const [maxAreaLocal, setMaxAreaLocal] = useState(currentMaxArea);

  useEffect(() => {
    setStart(urlStart);
    setEnd(urlEnd);
  }, [urlStart, urlEnd]);

  // ฟังก์ชันอัปเดต Filter ทั่วไป (เช่น เซลส์, ประเภท)
  const applyFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'ALL') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
  };

  // ฟังก์ชันอัปเดตวันที่ (เมื่อผู้ใช้จิ้มเลือกปฏิทินปุ๊บ กรองปั๊บ)
  const applyDate = (type: 'start' | 'end', val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val) params.set(type, val);
    else params.delete(type);
    router.push(`?${params.toString()}`);
  };

  // ฟังก์ชันอัปเดตพื้นที่ (รอให้ผู้ใช้พิมพ์เสร็จแล้วกด Enter หรือคลิกออก)
  const applyAreaFilter = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (minAreaLocal) params.set('minArea', minAreaLocal); else params.delete('minArea');
    if (maxAreaLocal) params.set('maxArea', maxAreaLocal); else params.delete('maxArea');
    router.push(`?${params.toString()}`);
  };

  const clearAllFilters = () => {
    router.push('?'); 
    setMinAreaLocal('');
    setMaxAreaLocal('');
  };

  const isFiltered = urlStart || urlEnd || currentSales !== 'ALL' || currentProjectType !== 'ALL' || currentProductCategory !== 'ALL' || currentSource !== 'ALL' || currentMinArea || currentMaxArea;

  return (
    <div className="flex flex-wrap items-center gap-2">
      
      <Filter size={16} className="text-slate-400 hidden lg:block mr-1" />

      {/* 1. กล่องเลือกวันที่แบบเอามาโชว์ตรงๆ (หมดปัญหาปฏิทินเด้งปิด) */}
      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 shadow-sm hover:border-indigo-300 transition-colors">
        <Calendar size={14} className="text-indigo-500" />
        <input 
          type="date" 
          className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer w-[110px]" 
          value={start} 
          onChange={(e) => {
            setStart(e.target.value);
            applyDate('start', e.target.value);
          }} 
        />
        <span className="text-slate-300">-</span>
        <input 
          type="date" 
          className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer w-[110px]" 
          value={end} 
          onChange={(e) => {
            setEnd(e.target.value);
            applyDate('end', e.target.value);
          }} 
        />
      </div>

      {/* 2. ตัวกรองที่มา (เพิ่มให้แล้วตามรีเควสต์ครับ) */}
      <div className="relative">
        <select 
          className={`appearance-none border rounded-lg px-3 py-1.5 pr-8 text-xs font-medium outline-none transition-colors cursor-pointer shadow-sm
            ${currentSource !== 'ALL' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-700 hover:border-amber-300'}`}
          value={currentSource} 
          onChange={(e) => applyFilter('source', e.target.value)}
        >
          <option value="ALL">🌐 ที่มา: ทั้งหมด</option>
          <option value="APP">📱 ผ่านแอปฯ</option>
          <option value="IMPORT">📁 นำเข้าไฟล์</option>
        </select>
        <ChevronDown size={14} className="absolute right-2 top-2 text-slate-400 pointer-events-none" />
      </div>

      {/* 3. ตัวกรองเซลส์ดูแล */}
      <div className="relative">
        <select 
          className={`appearance-none border rounded-lg px-3 py-1.5 pr-8 text-xs font-medium outline-none transition-colors cursor-pointer shadow-sm
            ${currentSales !== 'ALL' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300'}`}
          value={currentSales} 
          onChange={(e) => applyFilter('sales', e.target.value)}
        >
          <option value="ALL">👤 เซลส์: ทั้งหมด</option>
          {salesList?.map((s: any) => <option key={s.id} value={s.id}>{s.full_name || 'ไม่ระบุชื่อ'}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-2 top-2 text-slate-400 pointer-events-none" />
      </div>

      {/* 4. ตัวกรองประเภทโครงการ */}
      <div className="relative">
        <select 
          className={`appearance-none border rounded-lg px-3 py-1.5 pr-8 text-xs font-medium outline-none transition-colors cursor-pointer shadow-sm
            ${currentProjectType !== 'ALL' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300'}`}
          value={currentProjectType} 
          onChange={(e) => applyFilter('projectType', e.target.value)}
        >
          <option value="ALL">🏢 ประเภท: ทั้งหมด</option>
          {projectTypes?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-2 top-2 text-slate-400 pointer-events-none" />
      </div>

      {/* 5. ตัวกรองประเภทสินค้า */}
      <div className="relative">
        <select 
          className={`appearance-none border rounded-lg px-3 py-1.5 pr-8 text-xs font-medium outline-none transition-colors cursor-pointer shadow-sm
            ${currentProductCategory !== 'ALL' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300'}`}
          value={currentProductCategory} 
          onChange={(e) => applyFilter('productCategory', e.target.value)}
        >
          <option value="ALL">🛍 สินค้า: ทั้งหมด</option>
          {productCategories?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-2 top-2 text-slate-400 pointer-events-none" />
      </div>

      {/* 6. ตัวกรองพื้นที่แบบ Range */}
      <div className="flex items-center gap-1 border border-slate-200 rounded-lg px-2 py-1 bg-white shadow-sm hover:border-slate-300 transition-colors">
        <span className="text-[10px] text-slate-500 font-bold px-1 uppercase">พื้นที่</span>
        <input 
          type="number" placeholder="Min" 
          className="w-12 text-xs outline-none bg-slate-50 rounded px-1 py-1 text-center" 
          value={minAreaLocal} onChange={(e) => setMinAreaLocal(e.target.value)}
          onBlur={applyAreaFilter} 
          onKeyDown={(e) => e.key === 'Enter' && applyAreaFilter()} 
        />
        <span className="text-slate-300">-</span>
        <input 
          type="number" placeholder="Max" 
          className="w-12 text-xs outline-none bg-slate-50 rounded px-1 py-1 text-center" 
          value={maxAreaLocal} onChange={(e) => setMaxAreaLocal(e.target.value)}
          onBlur={applyAreaFilter}
          onKeyDown={(e) => e.key === 'Enter' && applyAreaFilter()}
        />
      </div>

      {/* 7. ปุ่มเคลียร์ฟิลเตอร์ทั้งหมด */}
      {isFiltered && (
        <button 
          onClick={clearAllFilters}
          className="ml-1 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 p-1.5 rounded-lg transition-colors border border-rose-100 shadow-sm flex items-center gap-1 text-[11px] font-bold"
          title="ล้างตัวกรองทั้งหมด"
        >
          <X size={14} strokeWidth={2.5} /> ล้าง
        </button>
      )}

    </div>
  );
}
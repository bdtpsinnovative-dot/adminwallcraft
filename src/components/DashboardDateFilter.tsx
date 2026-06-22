"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, ChevronDown, X, Filter, Globe, Clock, CalendarDays, Loader2, Scaling } from 'lucide-react';

type Props = {
  salesList: any[];
  projectTypes: any[];
  productCategories: any[];
  teams: any[];
  customerTypes: any[];
  // 🌟 เพิ่ม Props สำหรับรับตัวเลขจำนวนโปรเจกต์แยกตามไซส์
  areaCounts?: Record<string, number>; 
};

export default function DashboardDateFilter({ salesList, projectTypes, productCategories, teams, customerTypes, areaCounts = {} }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [isPending, startTransition] = useTransition();
const formatLocal = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const now = new Date();

  // ✅ แก้เป็นแบบนี้ครับ
  const todayStr = formatLocal(now);
  const thirtyDaysAgoDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgoStr = formatLocal(thirtyDaysAgoDate);
  const firstDayOfMonth = formatLocal(new Date(now.getFullYear(), now.getMonth(), 1));
  const lastDayOfMonth = formatLocal(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const allTimeStart = '2020-01-01';
  const allTimeEnd = '2030-12-31';

  const urlStart = searchParams.get('start') || thirtyDaysAgoStr; 
  const urlEnd = searchParams.get('end') || todayStr;
  
  const currentSales = searchParams.get('sales') || 'ALL';
  const currentProjectType = searchParams.get('projectType') || 'ALL';
  const currentProductCategory = searchParams.get('productCategory') || 'ALL';
  const currentSource = searchParams.get('source') || 'ALL';
  const currentTeam = searchParams.get('team') || 'ALL';
  const currentCustomerType = searchParams.get('customerType') || 'ALL'; 
  const currentMinArea = searchParams.get('minArea') || '';
  const currentMaxArea = searchParams.get('maxArea') || '';

  const [start, setStart] = useState(urlStart);
  const [end, setEnd] = useState(urlEnd);
  const [minAreaLocal, setMinAreaLocal] = useState(currentMinArea);
  const [maxAreaLocal, setMaxAreaLocal] = useState(currentMaxArea);

  useEffect(() => {
    setStart(urlStart);
    setEnd(urlEnd);
    setMinAreaLocal(currentMinArea);
    setMaxAreaLocal(currentMaxArea);
  }, [urlStart, urlEnd, currentMinArea, currentMaxArea]);

  let activePreset = 'CUSTOM';
  if (!searchParams.get('start') && !searchParams.get('end')) {
    activePreset = '30DAYS';
  } else if (urlStart === firstDayOfMonth && urlEnd === lastDayOfMonth) {
    activePreset = 'THIS_MONTH';
  } else if (urlStart === allTimeStart) {
    activePreset = 'ALL_TIME';
  }

  const applyPreset = (preset: '30DAYS' | 'THIS_MONTH' | 'ALL_TIME') => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (preset === '30DAYS') {
      params.delete('start');
      params.delete('end');
    } else if (preset === 'THIS_MONTH') {
      params.set('start', firstDayOfMonth);
      params.set('end', lastDayOfMonth);
    } else if (preset === 'ALL_TIME') {
      params.set('start', allTimeStart);
      params.set('end', allTimeEnd);
    }
    
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const applyFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'ALL') params.set(key, value);
    else params.delete(key);
    
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const applyDate = (type: 'start' | 'end', val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val) params.set(type, val);
    else params.delete(type);
    
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const applyAreaFilter = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (minAreaLocal) params.set('minArea', minAreaLocal); else params.delete('minArea');
    if (maxAreaLocal) params.set('maxArea', maxAreaLocal); else params.delete('maxArea');
    
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const applyAreaPreset = (min: string, max: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const isCurrentlyActive = currentMinArea === min && currentMaxArea === max;
    
    if (isCurrentlyActive) {
      params.delete('minArea');
      params.delete('maxArea');
      setMinAreaLocal('');
      setMaxAreaLocal('');
    } else {
      if (min) params.set('minArea', min); else params.delete('minArea');
      if (max) params.set('maxArea', max); else params.delete('maxArea');
      setMinAreaLocal(min);
      setMaxAreaLocal(max);
    }
    
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const clearAllFilters = () => {
    startTransition(() => {
      router.push('?');
    });
    setMinAreaLocal('');
    setMaxAreaLocal('');
  };

  const isFiltered = 
    searchParams.get('start') || 
    searchParams.get('end') || 
    currentSales !== 'ALL' || 
    currentTeam !== 'ALL' || 
    currentProjectType !== 'ALL' || 
    currentProductCategory !== 'ALL' || 
    currentCustomerType !== 'ALL' || 
    currentSource !== 'ALL' || 
    currentMinArea || 
    currentMaxArea;

  const areaPresets = [
    { id: 'ZERO', label: '0 ตร.ม.', min: '0', max: '0', tooltip: 'ไม่มีพื้นที่ระบุ' },
    { id: 'XS', label: 'XS', min: '1', max: '30', tooltip: 'ต่ำกว่า 30 ตร.ม.' },
    { id: 'S', label: 'S', min: '31', max: '100', tooltip: '31 - 100 ตร.ม.' },
    { id: 'M', label: 'M', min: '101', max: '300', tooltip: '101 - 300 ตร.ม.' },
    { id: 'L', label: 'L', min: '301', max: '500', tooltip: '301 - 500 ตร.ม.' },
    { id: 'XL', label: 'XL', min: '501', max: '1000', tooltip: '501 - 1000 ตร.ม.' },
    { id: 'XXL', label: 'XXL', min: '1001', max: '', tooltip: 'มากกว่า 1000 ตร.ม.' },
  ];

  return (
    <>
      {isPending && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 transform transition-all scale-100">
            <Loader2 size={48} className="text-indigo-600 animate-spin" />
            <div className="text-center space-y-1">
              <p className="text-slate-800 font-black text-xl">กำลังโหลดข้อมูล</p>
              <p className="text-slate-500 font-medium text-sm">อาจใช้เวลาสักครู่ครับ</p>
            </div>
          </div>
        </div>
      )}

      {/* --- แถวที่ 1: ตัวกรองปกติ --- */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Filter size={16} className="text-slate-400 hidden lg:block mr-1" />

        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-inner">
          <button 
            onClick={() => applyPreset('30DAYS')}
            disabled={isPending}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${activePreset === '30DAYS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} disabled:opacity-50`}
          >
            <Clock size={14} /> 30 วัน
          </button>
          <button 
            onClick={() => applyPreset('THIS_MONTH')}
            disabled={isPending}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${activePreset === 'THIS_MONTH' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} disabled:opacity-50`}
          >
            <CalendarDays size={14} /> เดือนนี้
          </button>
          <button 
            onClick={() => applyPreset('ALL_TIME')}
            disabled={isPending}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${activePreset === 'ALL_TIME' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} disabled:opacity-50`}
          >
            <Globe size={14} /> ทั้งหมด
          </button>
        </div>

        <div className={`flex items-center gap-1 bg-white border rounded-lg px-2 py-1.5 shadow-sm transition-colors ${activePreset === 'CUSTOM' ? 'border-indigo-400 ring-1 ring-indigo-100' : 'border-slate-200 hover:border-indigo-300'}`} title="หรือระบุช่วงเวลาที่ต้องการเอง">
          <Calendar size={14} className={activePreset === 'CUSTOM' ? "text-indigo-600" : "text-slate-400"} />
          <input 
            type="date" 
            disabled={isPending}
            className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer w-[110px] disabled:opacity-50" 
            value={start} 
            onChange={(e) => {
              setStart(e.target.value);
              applyDate('start', e.target.value);
            }} 
          />
          <span className="text-slate-300">-</span>
          <input 
            type="date" 
            disabled={isPending}
            className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer w-[110px] disabled:opacity-50" 
            value={end} 
            onChange={(e) => {
              setEnd(e.target.value);
              applyDate('end', e.target.value);
            }} 
          />
        </div>

        <div className="relative">
          <select 
            disabled={isPending}
            className={`appearance-none border rounded-lg px-3 py-1.5 pr-8 text-xs font-medium outline-none transition-colors cursor-pointer shadow-sm disabled:opacity-50
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

        <div className="relative">
          <select 
            disabled={isPending}
            className={`appearance-none border rounded-lg px-3 py-1.5 pr-8 text-xs font-medium outline-none transition-colors cursor-pointer shadow-sm disabled:opacity-50
              ${currentCustomerType !== 'ALL' ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-slate-200 bg-white text-slate-700 hover:border-pink-300'}`}
            value={currentCustomerType} 
            onChange={(e) => applyFilter('customerType', e.target.value)}
          >
            <option value="ALL">🤝 ลูกค้า: ทั้งหมด</option>
            {customerTypes?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2 top-2 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select 
            disabled={isPending}
            className={`appearance-none border rounded-lg px-3 py-1.5 pr-8 text-xs font-medium outline-none transition-colors cursor-pointer shadow-sm disabled:opacity-50
              ${currentSales !== 'ALL' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300'}`}
            value={currentSales} 
            onChange={(e) => applyFilter('sales', e.target.value)}
          >
            <option value="ALL">👤 เซลส์: ทั้งหมด</option>
            {salesList?.map((s: any) => <option key={s.id} value={s.id}>{s.full_name || 'ไม่ระบุชื่อ'}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2 top-2 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            disabled={isPending}
            className={`appearance-none border rounded-lg px-3 py-1.5 pr-8 text-xs font-medium outline-none transition-colors cursor-pointer shadow-sm disabled:opacity-50
              ${currentTeam !== 'ALL' ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-slate-700 hover:border-violet-300'}`}
            value={currentTeam}
            onChange={(e) => applyFilter('team', e.target.value)}
          >
            <option value="ALL">🏠 ทีม: ทั้งหมด</option>
            {teams?.map((t: any) => <option key={t.id} value={t.id}>{t.team_name}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2 top-2 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select 
            disabled={isPending}
            className={`appearance-none border rounded-lg px-3 py-1.5 pr-8 text-xs font-medium outline-none transition-colors cursor-pointer shadow-sm disabled:opacity-50
              ${currentProjectType !== 'ALL' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300'}`}
            value={currentProjectType} 
            onChange={(e) => applyFilter('projectType', e.target.value)}
          >
            <option value="ALL">🏢 ประเภทงาน: ทั้งหมด</option>
            {projectTypes?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2 top-2 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select 
            disabled={isPending}
            className={`appearance-none border rounded-lg px-3 py-1.5 pr-8 text-xs font-medium outline-none transition-colors cursor-pointer shadow-sm disabled:opacity-50
              ${currentProductCategory !== 'ALL' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300'}`}
            value={currentProductCategory} 
            onChange={(e) => applyFilter('productCategory', e.target.value)}
          >
            <option value="ALL">🛍 สินค้า: ทั้งหมด</option>
            {productCategories?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2 top-2 text-slate-400 pointer-events-none" />
        </div>

        {isFiltered && (
          <button 
            onClick={clearAllFilters}
            disabled={isPending}
            className="ml-1 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 p-1.5 rounded-lg transition-colors border border-rose-100 shadow-sm flex items-center gap-1 text-[11px] font-bold disabled:opacity-50"
            title="ล้างตัวกรองทั้งหมด"
          >
            <X size={14} strokeWidth={2.5} /> ล้าง
          </button>
        )}
      </div>

      {/* --- แถวที่ 2: ฟิลเตอร์ขนาดพื้นที่ (เพิ่ม Badge ตัวเลข) --- */}
      <div className="flex flex-wrap items-center gap-3 w-full">
    
        
       

       
      </div>
    </>
  );
}
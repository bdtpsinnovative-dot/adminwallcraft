"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, ChevronDown, X } from 'lucide-react';

export default function DashboardDateFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlStart = searchParams.get('start') || '';
  const urlEnd = searchParams.get('end') || '';

  const [isOpen, setIsOpen] = useState(false);
  const [start, setStart] = useState(urlStart);
  const [end, setEnd] = useState(urlEnd);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setStart(urlStart);
    setEnd(urlEnd);
  }, [urlStart, urlEnd]);

  const applyFilter = (newStart: string, newEnd: string, rangeType: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newStart) params.set('start', newStart); else params.delete('start');
    if (newEnd) params.set('end', newEnd); else params.delete('end');
    if (rangeType) params.set('range', rangeType); else params.delete('range');
    
    router.push(`?${params.toString()}`);
    setIsOpen(false);
  };

  const setQuickRange = (type: string) => {
    const now = new Date();
    const thaiTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    let s = '', e = thaiTime.toISOString().split('T')[0];

    if (type === 'all') {
      applyFilter('', '', 'all');
      return;
    } else if (type === 'today') {
      s = e;
    } else if (type === 'yesterday') {
      const yesterday = new Date(thaiTime.getTime() - (24 * 60 * 60 * 1000));
      s = yesterday.toISOString().split('T')[0];
      e = s;
    } else if (type === '7days') {
      s = new Date(thaiTime.getTime() - (6 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    } else if (type === 'this_month') {
      s = `${thaiTime.getUTCFullYear()}-${String(thaiTime.getUTCMonth() + 1).padStart(2, '0')}-01`;
    }
    applyFilter(s, e, type);
  };

  const getDisplayText = () => {
    if (!urlStart && !urlEnd) return "ดูข้อมูลทั้งหมด";
    if (urlStart === urlEnd) return `วันที่ ${urlStart.split('-').reverse().join('/')}`;
    return `${urlStart.split('-').reverse().join('/')} - ${urlEnd.split('-').reverse().join('/')}`;
  };

  return (
    <div className="relative z-50" ref={popoverRef}>
      
      {/* ปุ่มหลักบนหน้าจอ */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-medium text-sm transition-all shadow-sm
          ${isOpen ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-slate-50'}`}
      >
        <Calendar size={16} className={isOpen || urlStart ? "text-indigo-600" : "text-slate-400"} />
        <span>{getDisplayText()}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* หน้าต่าง Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 w-80 animate-in fade-in slide-in-from-top-2">
          
          {/* 🔥 1. โหมดเลือกวันเดียว (เพิ่มใหม่ ใช้งานง่ายสุดๆ) */}
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">ดูแค่วันเดียว (Single Day)</h4>
          <div className="flex items-center justify-between bg-indigo-50 hover:bg-indigo-100 transition-colors border border-indigo-100 rounded-lg p-2 mb-4">
            <span className="text-xs text-indigo-600 font-bold w-16 px-1">ระบุวัน:</span>
            <input 
              type="date" 
              // โชว์วันที่ในช่องนี้เฉพาะตอนที่ Start กับ End เป็นวันเดียวกัน
              value={start === end ? start : ''} 
              onChange={(e) => {
                const selectedDate = e.target.value;
                if(selectedDate) {
                  // สั่งรันฟังก์ชันกรองทันที ไม่ต้องกดปุ่ม
                  applyFilter(selectedDate, selectedDate, 'custom');
                }
              }}
              className="bg-transparent border-none text-sm font-semibold text-indigo-700 focus:ring-0 cursor-pointer outline-none w-full"
            />
          </div>

          <div className="w-full h-px bg-slate-100 mb-4"></div>
          
          {/* 2. โหมดเลือกเป็นช่วง (Start - End) */}
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">เลือกแบบเป็นช่วง (Date Range)</h4>
          <div className="flex flex-col gap-2 mb-3">
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-2">
              <span className="text-xs text-slate-500 font-medium w-12">ตั้งแต่:</span>
              <input 
                type="date" 
                value={start} 
                onChange={(e) => setStart(e.target.value)}
                className="bg-transparent border-none text-sm font-semibold text-slate-700 focus:ring-0 cursor-pointer outline-none"
              />
            </div>
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-2">
              <span className="text-xs text-slate-500 font-medium w-12">ถึง:</span>
              <input 
                type="date" 
                value={end} 
                onChange={(e) => setEnd(e.target.value)}
                className="bg-transparent border-none text-sm font-semibold text-slate-700 focus:ring-0 cursor-pointer outline-none"
              />
            </div>
          </div>
          <button 
            onClick={() => applyFilter(start, end, 'custom')}
            className="w-full bg-slate-800 hover:bg-slate-900 text-white font-medium text-sm py-2 rounded-lg transition-colors mb-4"
          >
            ใช้ตัวกรองช่วงเวลานี้
          </button>

          <div className="w-full h-px bg-slate-100 mb-3"></div>

          {/* 3. ปุ่มทางลัด (Quick Select) */}
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">ตัวเลือกด่วน</h4>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setQuickRange('today')} className="text-sm py-2 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-lg transition-colors border border-slate-100">วันนี้</button>
            <button onClick={() => setQuickRange('yesterday')} className="text-sm py-2 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-lg transition-colors border border-slate-100">เมื่อวาน</button>
            <button onClick={() => setQuickRange('7days')} className="text-sm py-2 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-lg transition-colors border border-slate-100">7 วันล่าสุด</button>
            <button onClick={() => setQuickRange('this_month')} className="text-sm py-2 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-lg transition-colors border border-slate-100">เดือนนี้</button>
            <button onClick={() => setQuickRange('all')} className="col-span-2 text-sm py-2 mt-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors border border-rose-100 flex items-center justify-center gap-1 font-medium">
              <X size={14} /> ล้างตัวกรองทั้งหมด
            </button>
          </div>

        </div>
      )}
      
    </div>
  );
}
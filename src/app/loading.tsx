'use client'; // ✅ เติมอันนี้เพื่อเคลียร์ปัญหาการสับสน Context ระหว่าง Server/Client ครับนาย

import React from 'react';
import { Loader2, Database } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center bg-slate-50 w-full rounded-3xl select-none">
      <div className="relative flex flex-col items-center">
        
        {/* วงแหวนแสงเรืองแสงด้านหลัง (Glow Effect) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-indigo-500 blur-[40px] opacity-20 rounded-full animate-pulse"></div>
        
        {/* กล่องตรงกลาง */}
        <div className="bg-white p-6 rounded-full shadow-xl border border-indigo-100 flex items-center justify-center relative z-10 mb-6">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
          <Database className="w-5 h-5 text-indigo-400 absolute" />
        </div>

        {/* ข้อความแจ้งเตือน */}
        <div className="text-center space-y-3 relative z-10">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">
            กำลังประมวลผลข้อมูล...
          </h2>
          <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-slate-500 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '300ms' }}></span>
            <span className="ml-2">กำลังโหลดข้อมูล (God Mode)</span>
          </div>
        </div>

      </div>
    </div>
  );
}
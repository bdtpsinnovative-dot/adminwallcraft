// src/app/dashboard/checkins/[userId]/loading.tsx
import React from 'react';
import { Loader2, MapPin } from 'lucide-react';

export default function CheckinsLoading() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center bg-slate-50 w-full rounded-3xl select-none">
      <div className="relative flex flex-col items-center">
        
        {/* Glow Effect สี Rose/Indigo เข้ากับหน้าแผนที่ */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-rose-500 blur-[40px] opacity-15 rounded-full animate-pulse"></div>
        
        {/* กล่องตรงกลาง */}
        <div className="bg-white p-6 rounded-full shadow-xl border border-slate-100 flex items-center justify-center relative z-10 mb-6">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
          <MapPin className="w-5 h-5 text-rose-500 absolute animate-bounce" />
        </div>

        {/* ข้อความแจ้งเตือน */}
        <div className="text-center space-y-3 relative z-10">
          <h2 className="text-xl font-bold text-slate-700 tracking-tight">
            กำลังทำงาน
          </h2>
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
            <span>กำลังโหลดข้อมูล</span>
          </div>
        </div>

      </div>
    </div>
  );
}
"use client";

import React, { useState } from 'react';
import { Database, DownloadCloud, CheckCircle2, AlertCircle, Loader2, HardDrive } from 'lucide-react';

export default function BackupDataPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error', message: string }>({ 
    type: 'idle', 
    message: '' 
  });

  const handleManualBackup = async () => {
    setIsLoading(true);
    setStatus({ type: 'idle', message: '' });

    try {
      // 🌟 เรียกไปที่ API เส้นที่เราจะสร้างไว้สำหรับดึงข้อมูลและโยนขึ้น R2
      const res = await fetch('/api/backup', { method: 'GET' });
      const data = await res.json();

      if (res.ok && data.success) {
        setStatus({ 
          type: 'success', 
          message: data.message || 'สำรองข้อมูลขึ้น Cloudflare R2 สำเร็จเรียบร้อยแล้ว!' 
        });
      } else {
        setStatus({ 
          type: 'error', 
          message: data.error || 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ ไม่สามารถสำรองข้อมูลได้' 
        });
      }
    } catch (error) {
      setStatus({ 
        type: 'error', 
        message: 'ไม่สามารถเชื่อมต่อกับระบบได้ กรุณาตรวจสอบอินเทอร์เน็ตหรือลองใหม่อีกครั้ง' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="p-4 md:p-8 bg-slate-50 min-h-screen text-slate-800 font-sans">
      <div className="max-w-3xl mx-auto">
        
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 text-indigo-700 mb-2">
            <HardDrive size={32} className="stroke-[2.5]" />
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">System Backup</h1>
          </div>
          <p className="text-slate-500">
            ระบบสำรองข้อมูลฐานข้อมูลหลัก (Orders, Items, Projects) ไปยัง Cloudflare R2 แบบ Manual
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex flex-col items-center text-center">
            <div className="bg-indigo-50 p-4 rounded-full text-indigo-500 mb-6">
              <Database size={48} strokeWidth={1.5} />
            </div>
            
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              พร้อมสำหรับการสำรองข้อมูล
            </h2>
            <p className="text-slate-500 text-sm mb-8 max-w-md">
              ระบบจะทำการดึงข้อมูลล่าสุดจาก 3 ตารางหลัก และบีบอัดเป็นไฟล์ JSON เพื่อนำไปเก็บไว้อย่างปลอดภัยที่ Cloudflare Storage
            </p>

            {/* Action Button */}
            <button
              onClick={handleManualBackup}
              disabled={isLoading}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all shadow-sm
                ${isLoading 
                  ? 'bg-indigo-300 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-md hover:-translate-y-0.5'
                }`}
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  กำลังดึงข้อมูลและอัปโหลด...
                </>
              ) : (
                <>
                  <DownloadCloud size={20} />
                  เริ่มสำรองข้อมูลทันที
                </>
              )}
            </button>

            {/* Status Messages */}
            {status.type === 'success' && (
              <div className="mt-6 p-4 bg-emerald-50 border border-emerald-100 rounded-lg flex items-start gap-3 w-full text-left animate-in fade-in slide-in-from-bottom-2">
                <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="text-emerald-800 font-bold text-sm">สำเร็จ!</h4>
                  <p className="text-emerald-600 text-sm mt-0.5">{status.message}</p>
                </div>
              </div>
            )}

            {status.type === 'error' && (
              <div className="mt-6 p-4 bg-rose-50 border border-rose-100 rounded-lg flex items-start gap-3 w-full text-left animate-in fade-in slide-in-from-bottom-2">
                <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="text-rose-800 font-bold text-sm">เกิดข้อผิดพลาด</h4>
                  <p className="text-rose-600 text-sm mt-0.5">{status.message}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Note Section */}
        <div className="mt-6 bg-amber-50 p-4 rounded-xl border border-amber-100 text-amber-800 text-xs md:text-sm">
          <strong>💡 หมายเหตุ:</strong> การกดสำรองข้อมูลจะดึงข้อมูลทั้งหมด ณ วินาทีปัจจุบัน 
          หากข้อมูลมีปริมาณมาก อาจใช้เวลาในการรันประมาณ 10-30 วินาที กรุณาอย่าปิดหน้าต่างจนกว่าจะขึ้นสถานะสำเร็จ
        </div>

      </div>
    </main>
  );
}
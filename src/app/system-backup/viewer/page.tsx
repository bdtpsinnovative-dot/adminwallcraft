"use client";

import React, { useState } from 'react';
import { FileCode, Table, LayoutGrid, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function BackupViewerPage() {
  const [backupData, setBackupData] = useState<any>(null);
  const [selectedTable, setSelectedTable] = useState<string>('');

  // ฟังก์ชันอ่านไฟล์ JSON จากเครื่อง
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setBackupData(json);
        // เลือกตารางแรกที่มีข้อมูลให้อัตโนมัติ
        const keys = Object.keys(json).filter(k => k !== 'timestamp');
        if (keys.length > 0) setSelectedTable(keys[0]);
      } catch (err) {
        alert('ไฟล์ JSON ไม่ถูกต้อง หรือไฟล์มีความเสียหาย');
      }
    };
    reader.readAsText(file);
  };

  // ดึงชื่อตารางทั้งหมดในไฟล์ (ยกเว้น timestamp)
  const tableNames = backupData ? Object.keys(backupData).filter(k => k !== 'timestamp') : [];
  
  // ดึงข้อมูลของตารางที่เลือก
  const currentTableData = backupData && selectedTable ? backupData[selectedTable] : [];
  
  // ดึงชื่อ Column จากข้อมูลแถวแรก
  const columns = currentTableData.length > 0 ? Object.keys(currentTableData[0]) : [];

  return (
    <main className="p-4 md:p-8 bg-slate-50 min-h-screen text-slate-800 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Navigation */}
        <div className="mb-6">
          <Link href="/system-backup" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm transition-colors">
            <ArrowLeft size={16} /> กลับไปหน้า Backup
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <LayoutGrid className="text-indigo-600" /> Backup Data Viewer
            </h1>
            <p className="text-slate-500 text-sm mt-1">อัปโหลดไฟล์สำรองข้อมูลเพื่อเปิดดูในรูปแบบตาราง</p>
          </div>

          {/* ปุ่มเลือกไฟล์ */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl cursor-pointer shadow-sm transition-all">
              <FileCode size={18} /> เลือกไฟล์ JSON ที่ดาวน์โหลดมา
              <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        {backupData ? (
          <div className="space-y-6">
            {/* ส่วนเลือกตาราง */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
              <span className="text-sm font-bold text-slate-600 flex items-center gap-1.5">
                <Table size={16} /> เลือกตารางที่ต้องการดู:
              </span>
              <select 
                value={selectedTable} 
                onChange={(e) => setSelectedTable(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 outline-none bg-slate-50 cursor-pointer hover:border-slate-300 transition-colors"
              >
                {tableNames.map(name => (
                  <option key={name} value={name}>
                    {name} ({backupData[name]?.length || 0} แถว)
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-400 ml-auto font-medium">
                เวลาแบคอัพของไฟล์นี้: {new Date(backupData.timestamp).toLocaleString('th-TH')}
              </span>
            </div>

            {/* ส่วนแสดงตารางข้อมูล */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {currentTableData.length > 0 ? (
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs md:text-sm">
                    <thead className="bg-slate-100 text-slate-600 font-bold uppercase border-b border-slate-200 sticky top-0">
                      <tr>
                        {columns.map(col => (
                          <th key={col} className="px-4 py-3 whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentTableData.map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          {columns.map(col => {
                            const val = row[col];
                            return (
                              <td key={col} className="px-4 py-3 max-w-[300px] truncate font-medium text-slate-700" title={typeof val === 'object' ? JSON.stringify(val) : String(val)}>
                                {typeof val === 'object' ? JSON.stringify(val) : String(val ?? '-')}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 font-medium">
                  ไม่มีข้อมูลในตารางนี้
                </div>
              )}
            </div>
          </div>
        ) : (
          /* หน้าแรกตอนยังไม่อัปโหลดไฟล์ */
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-16 text-center shadow-sm">
            <div className="bg-slate-50 p-4 rounded-full text-slate-400 inline-block mb-4">
              <Table size={40} strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-1">ยังไม่มีการโหลดไฟล์</h3>
            <p className="text-slate-400 text-sm max-w-sm mx-auto mb-6">กรุณากดปุ่มเลือกไฟล์ด้านบน เพื่อนำไฟล์สำรองข้อมูลนามสกุล .json มาแปลงเป็นตาราง</p>
          </div>
        )}

      </div>
    </main>
  );
}
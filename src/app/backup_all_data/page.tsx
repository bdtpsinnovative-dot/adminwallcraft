'use client';
import { useState } from 'react';

export default function BackupPage() {
  const [isExporting, setIsExporting] = useState(false);

  const handleBackup = async () => {
    try {
      setIsExporting(true);
      
      // เรียก API ที่เราสร้างไว้
      const response = await fetch('/api/backup');
      
      if (!response.ok) throw new Error('Backup failed');

      // รับค่ามาเป็น Blob และสร้างลิงก์ดาวน์โหลด
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // ดึงชื่อไฟล์จาก Header ถ้ามี หรือตั้งใหม่
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'system_backup.xlsx';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch.length === 2) {
          filename = filenameMatch[1];
        }
      }
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error(error);
      alert('เกิดข้อผิดพลาดในการสำรองข้อมูล');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">ระบบสำรองข้อมูล (Database Backup)</h1>
      <p className="text-gray-600 mb-6">คลิกปุ่มด้านล่างเพื่อดาวน์โหลดข้อมูลทั้งหมดในระบบออกมาเป็นไฟล์ Excel</p>
      
      <button
        onClick={handleBackup}
        disabled={isExporting}
        className={`px-6 py-3 rounded-lg text-white font-medium flex items-center gap-2 transition-all
          ${isExporting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md'}`}
      >
        {isExporting ? (
          <>
            <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
            กำลังดึงข้อมูล...
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            ดาวน์โหลดไฟล์ Backup
          </>
        )}
      </button>
    </div>
  );
}
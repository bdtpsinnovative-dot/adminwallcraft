'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud, Loader2, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ExcelUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement> | any) => {
    const selectedFile = e.target.files?.[0] || e.dataTransfer?.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    const reader = new FileReader();
    
    reader.onload = (evt) => {
      // 🌟 ใช้ ArrayBuffer เพื่อให้อ่านภาษาไทยและไฟล์ .xlsx ได้สมบูรณ์ 100%
      const buffer = evt.target?.result; 
      const wb = XLSX.read(buffer, { type: 'array' }); 
      const wsname = wb.SheetNames[0]; 
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      setPreviewData(data); 
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleUpload = async () => {
    if (previewData.length === 0) return alert('ไม่มีข้อมูลในไฟล์');
    setIsUploading(true);

    try {
      // 🚀 ยิงตรง ไม่ต้องเช็ค Login ใดๆ ทั้งสิ้น
      const response = await fetch('/upload-excel', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excelData: previewData }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      alert('✅ อัปโหลดและกระจายข้อมูลสำเร็จ!');
      setFile(null);
      setPreviewData([]);
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (error: any) {
      alert('❌ เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
            <FileSpreadsheet size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">นำเข้าข้อมูลลูกค้า (Migration)</h1>
            <p className="text-slate-500 text-sm mt-1">
              อัปโหลดไฟล์ <strong>.xlsx</strong> ของระบบเดิม (แก้ไขบัคตัวอักษรตกหล่นให้แล้ว ไม่ต้อง Login!)
            </p>
          </div>
        </div>

        <div 
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onDrop={(e) => {
            e.preventDefault(); setIsDragging(false);
            handleFileChange(e);
          }}
          className={`bg-white border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 ${
            isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50'
          }`}
        >
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <UploadCloud size={56} className={`mx-auto mb-4 ${isDragging ? 'text-emerald-500' : 'text-slate-400'}`} />
          <h3 className="text-lg font-bold text-slate-700">คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่</h3>
          
          {file && (
            <div className="mt-6 inline-flex items-center gap-2 bg-emerald-100 text-emerald-800 px-4 py-2 rounded-full text-sm font-medium">
              <CheckCircle2 size={18} />
              เลือกไฟล์แล้ว: {file.name}
            </div>
          )}
        </div>

        {previewData.length > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-lg text-sm font-medium w-full sm:w-auto">
              <AlertCircle size={18} />
              พร้อมนำเข้าข้อมูลโดยไม่ต้อง Login
            </div>
            
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isUploading ? <Loader2 className="animate-spin" size={20} /> : <UploadCloud size={20} />}
              {isUploading ? 'กำลังประมวลผล...' : `นำเข้าข้อมูล ${previewData.length} แถว`}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
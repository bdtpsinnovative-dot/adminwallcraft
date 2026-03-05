"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { supabase } from "@/lib/supabase";

export default function BulkImportPage() {
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | null; message: string }>({ type: null, message: "" });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🛠️ Helpers จัดการข้อมูล
  const parseStr = (val: any) => {
    if (val === undefined || val === null) return null;
    const str = val.toString().trim();
    return str === "" ? null : str;
  };

  const parseNum = (val: any) => {
    if (val === undefined || val === null || val === "") return null;
    const str = val.toString().replace(/,/g, "").trim();
    if (str === "") return null;
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  };

  // 📂 จัดการไฟล์ (อ่าน CSV)
  const handleFile = (file: File | null) => {
    if (!file) return;
    setStatus({ type: null, message: "" });
    
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: function (results) {
        // ตัด Header บรรทัดแรกออก
        const rows = results.data.slice(1) as any[];
        setParsedData(rows);
      },
    });
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

// 🚀 อัปโหลดเข้า Supabase
  const uploadToSupabase = async () => {
    if (parsedData.length === 0) return;
    setIsUploading(true);
    setStatus({ type: null, message: "" });

    try {
      const groups: Record<string, any> = {};

      // 1. จัดกลุ่มข้อมูล
      parsedData.forEach((row) => {
        if (!row[0] || !row[1]) return; // ข้ามถ้าไม่มี SKU หรือ Product Name

        const sku = parseStr(row[0]);
        const productName = parseStr(row[1]);
        const collection = parseStr(row[2]);
        const key = `${productName}|${collection || ""}`;

        if (!groups[key]) {
          groups[key] = {
            name: productName,
            collection: collection,
            image_url: parseStr(row[19]),
            variants: [],
          };
        }

        groups[key].variants.push({
          sku: sku,
          series: parseStr(row[3]),
          core_material: parseStr(row[4]),
          film: parseStr(row[5]),
          color: parseStr(row[6]),
          pattern: parseStr(row[7]),
          thickness_mm: parseNum(row[8]),
          width_mm: parseNum(row[9]),
          length_mm: parseNum(row[10]),
          weight_per_m2: parseNum(row[11]),
          price: parseNum(row[12]),
          cost: parseNum(row[13]),
          sqm_per_unit: parseNum(row[14]),
          joint_type: parseStr(row[15]),
          moq: parseStr(row[16]),
          description: parseStr(row[17]),
          product_type: parseStr(row[18]),
          variant_image: parseStr(row[19]),
          cad_url: parseStr(row[20]),
          usage_area: parseStr(row[21]),
          track_no: parseStr(row[22]),
          qty_per_unit: null,
          weight_per_piece: null,
          tags: null,
        });
      });

      // 2. ส่งเข้า Database
      const productKeys = Object.keys(groups);
      let successCount = 0;

      for (const key of productKeys) {
        const group = groups[key];

        // Step A: Upsert Products (ตารางแม่) - 🌟 จุดที่แก้ให้มันทับตัวแม่
        const { data: prodData, error: prodError } = await supabase
          .from("products")
          .upsert(
            { 
              name: group.name, 
              collection: group.collection, 
              image_url: group.image_url 
            },
            { 
              onConflict: "name,collection", // 👈 บอกให้ Supabase เช็คจาก 2 คอลัมน์นี้
              ignoreDuplicates: false // 👈 บังคับให้อัปเดตข้อมูลทับของเดิมเสมอ
            }
          )
          .select("id")
          .single();

        if (prodError) {
          console.error(`❌ Error Product [${group.name}]:`, prodError.message);
          continue; // ถ้าอัปเดตแม่ไม่สำเร็จ ให้ข้ามไปลูกตัวอื่น
        }

        const productId = prodData.id;

        // Step B: Upsert Product Variants (ตารางลูก)
        const variantsPayload = group.variants.map((v: any) => ({ ...v, product_id: productId }));

        const { error: varError } = await supabase
          .from("product_variants")
          .upsert(variantsPayload, { 
            onConflict: "sku",
            ignoreDuplicates: false // 👈 อัปเดตลูกทับของเดิมเสมอ
          });

        if (varError) {
          console.error(`❌ Error Variants [${group.name}]:`, varError.message);
        } else {
          successCount++;
        }
      }

      setStatus({ type: "success", message: `นำเข้าข้อมูลสินค้าสำเร็จ ${successCount} กลุ่มสินค้า (พร้อมอัปเดตข้อมูลแม่-ลูกเรียบร้อย)` });
      setParsedData([]); 
    } catch (error: any) {
      console.error(error);
      setStatus({ type: "error", message: `เกิดข้อผิดพลาด: ${error.message}` });
    } finally {
      setIsUploading(false);
    }
  };
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">นำเข้าสินค้าเข้าระบบ (Bulk Import)</h1>
              <p className="text-sm text-slate-500 mt-0.5">อัปโหลดไฟล์ CSV เพื่อเพิ่มหรืออัปเดตข้อมูลสินค้าอัตโนมัติ</p>
            </div>
          </div>
          <Link 
            href="/" 
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200 hover:border-blue-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
            กลับหน้าหลัก
          </Link>
        </div>

        {/* Instructions Box */}
        <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl shadow-sm">
          <h2 className="text-blue-800 font-semibold mb-3 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
            คอลัมน์ที่ระบบอ่าน (ต้องเรียงตามนี้):
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {["A: SKU", "B: Product name", "C: Collection", "D: series", "E: Core Material", "F: Film", "G: color", "H: Pattern", "I: Thickness", "J: Width", "K: Lenge", "L: Weight/M2", "M: Price", "N: cost", "O: SQM", "P: Joint", "Q: MOQ", "R: Description", "S: type", "T: Main Picture", "U: CAD", "V: Usage Area", "W: Track No"].map((col, idx) => (
              <div key={idx} className="bg-white border border-blue-100 px-3 py-1.5 rounded-lg text-xs text-slate-600 shadow-sm flex items-center gap-1.5">
                <span className="font-bold text-blue-600">{col.split(':')[0]}</span>
                <span>{col.split(':')[1]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Dropzone */}
        <div 
          onClick={() => fileInputRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
            isDragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50"
          }`}
        >
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            onChange={(e) => handleFile(e.target.files ? e.target.files[0] : null)}
            className="hidden" 
          />
          <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-700">ลากไฟล์ CSV มาวางที่นี่</h3>
          <p className="text-slate-500 text-sm mt-1">หรือคลิกเพื่อเลือกไฟล์จากเครื่องของคุณ</p>
        </div>

        {/* Status Messages */}
        {status.message && (
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${status.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            <div className={`p-1 rounded-full ${status.type === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>
              {status.type === 'success' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              )}
            </div>
            <div className="font-medium text-sm mt-0.5">{status.message}</div>
          </div>
        )}

        {/* Preview Area */}
        {parsedData.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-white">
              <h2 className="font-semibold text-slate-800">
                ตัวอย่างข้อมูล <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs ml-2">{parsedData.length} รายการ</span>
              </h2>
            </div>
            
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 bg-slate-50 shadow-sm">
                  <tr className="text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4 font-medium whitespace-nowrap">SKU</th>
                    <th className="py-3 px-4 font-medium whitespace-nowrap">Product Name</th>
                    <th className="py-3 px-4 font-medium whitespace-nowrap">Collection</th>
                    <th className="py-3 px-4 font-medium whitespace-nowrap">Series</th>
                    <th className="py-3 px-4 font-medium whitespace-nowrap">Cost</th>
                    <th className="py-3 px-4 font-medium whitespace-nowrap">Price</th>
                    <th className="py-3 px-4 font-medium whitespace-nowrap">Size (TxWxL)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedData.slice(0, 20).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-slate-800 font-medium">{row[0] || "-"}</td>
                      <td className="py-3 px-4 text-slate-600">{row[1] || "-"}</td>
                      <td className="py-3 px-4 text-slate-600">{row[2] || "-"}</td>
                      <td className="py-3 px-4 text-slate-600">{row[3] || "-"}</td>
                      <td className="py-3 px-4 text-slate-600">{row[13] || "-"}</td>
                      <td className="py-3 px-4 text-slate-600">{row[12] || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 text-xs">
                        {row[8] || "-"}/{row[9] || "-"}/{row[10] || "-"}
                      </td>
                    </tr>
                  ))}
                  {parsedData.length > 20 && (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-slate-400 text-xs bg-slate-50/50">
                        ...แสดงเฉพาะ 20 รายการแรก...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-5 border-t border-slate-200 bg-slate-50">
              <button 
                onClick={uploadToSupabase}
                disabled={isUploading}
                className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isUploading ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                )}
                {isUploading ? "กำลังประมวลผลและนำเข้า Database..." : "ยืนยันและนำเข้า Database"}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
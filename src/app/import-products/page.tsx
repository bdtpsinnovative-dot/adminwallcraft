"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { supabase } from "@/lib/supabase";
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  ArrowLeft, 
  Package, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  X,
  Layers
} from "lucide-react";

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

        // Step A: Upsert Products (ตารางแม่)
        const { data: prodData, error: prodError } = await supabase
          .from("products")
          .upsert(
            { 
              name: group.name, 
              collection: group.collection, 
              image_url: group.image_url 
            },
            { 
              onConflict: "name,collection",
              ignoreDuplicates: false
            }
          )
          .select("id")
          .single();

        if (prodError) {
          console.error(`❌ Error Product [${group.name}]:`, prodError.message);
          continue;
        }

        const productId = prodData.id;

        // Step B: Upsert Product Variants (ตารางลูก)
        const variantsPayload = group.variants.map((v: any) => ({ ...v, product_id: productId }));

        const { error: varError } = await supabase
          .from("product_variants")
          .upsert(variantsPayload, { 
            onConflict: "sku",
            ignoreDuplicates: false
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
    <div className="w-full space-y-6 text-slate-800 font-sans pb-16">
      
      {/* 🌟 Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <UploadCloud size={26} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800">นำเข้าสินค้าเข้าระบบ (Bulk Import)</h1>
            <p className="text-sm text-slate-500 mt-0.5">อัปโหลดไฟล์ CSV เพื่อเพิ่มหรืออัปเดตข้อมูลสินค้าอัตโนมัติ</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
          {/* ปุ่มดาวน์โหลดเทมเพลตด้านบน Header */}
          <a
            href="/Product_Import_Template.xlsx"
            download="Product_Import_Template.xlsx"
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors border border-emerald-200 shadow-xs"
            title="ดาวน์โหลดไฟล์เทมเพลต Excel สำหรับกรอกข้อมูล"
          >
            <FileSpreadsheet size={16} /> เทมเพลต Excel (.xlsx)
          </a>
          <a
            href="/Product_Import_Template.csv"
            download="Product_Import_Template.csv"
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors border border-blue-200 shadow-xs"
            title="ดาวน์โหลดไฟล์เทมเพลต CSV สำหรับกรอกข้อมูล"
          >
            <FileText size={16} /> เทมเพลต CSV (.csv)
          </a>
          <Link 
            href="/manage-products" 
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-medium text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-xl transition-colors border border-slate-200"
          >
            <Package size={16} /> จัดการสินค้า
          </Link>
          <Link 
            href="/" 
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-medium text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-xl transition-colors border border-slate-200"
          >
            <ArrowLeft size={16} /> หน้าหลัก
          </Link>
        </div>
      </div>

      {/* 🌟 Template Download & Instructions Box */}
      <div className="bg-white border border-blue-100/80 rounded-2xl p-6 shadow-sm space-y-4">
        {/* แถบดาวน์โหลดเทมเพลตแบบเน้นๆ */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-emerald-50/50 rounded-xl border border-blue-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Download size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">ดาวน์โหลดไฟล์เทมเพลต (Import Template)</h3>
              <p className="text-xs text-slate-500 mt-0.5">มีหัวคอลัมน์ 23 ช่องครบถ้วน พร้อมข้อมูลตัวอย่าง นำไปกรอกแล้วบันทึกเป็น CSV ได้ทันที</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <a
              href="/Product_Import_Template.xlsx"
              download="Product_Import_Template.xlsx"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
            >
              <FileSpreadsheet size={16} /> ดาวน์โหลด Excel (.xlsx)
            </a>
            <a
              href="/Product_Import_Template.csv"
              download="Product_Import_Template.csv"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
            >
              <FileText size={16} /> ดาวน์โหลด CSV (.csv)
            </a>
          </div>
        </div>

        {/* รายการคอลัมน์ทั้ง 23 คอลัมน์ */}
        <div>
          <h2 className="text-slate-700 font-bold text-xs uppercase tracking-wider mb-2.5 flex items-center gap-2">
            <Layers size={15} className="text-blue-600" />
            คอลัมน์ที่ระบบอ่าน (ลำดับต้องเรียงตามนี้):
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {[
              "A: SKU", "B: Product name", "C: Collection", "D: series", 
              "E: Core Material", "F: Film", "G: color", "H: Pattern", 
              "I: Thickness", "J: Width", "K: Lenge", "L: Weight/M2", 
              "M: Price", "N: cost", "O: SQM", "P: Joint", 
              "Q: MOQ", "R: Description", "S: type", "T: Main Picture", 
              "U: CAD", "V: Usage Area", "W: Track No"
            ].map((col, idx) => (
              <div key={idx} className="bg-slate-50 hover:bg-blue-50/50 border border-slate-200/80 px-3 py-1.5 rounded-lg text-xs text-slate-600 transition-colors flex items-center gap-1.5">
                <span className="font-bold text-blue-600 shrink-0">{col.split(':')[0]}</span>
                <span className="truncate">{col.split(':')[1]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 🌟 Dropzone */}
      <div 
        onClick={() => fileInputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50/60 shadow-sm"
        }`}
      >
        <input 
          type="file" 
          accept=".csv" 
          ref={fileInputRef} 
          onChange={(e) => handleFile(e.target.files ? e.target.files[0] : null)}
          className="hidden" 
        />
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
          <UploadCloud size={32} />
        </div>
        <h3 className="text-lg font-bold text-slate-700">ลากไฟล์ CSV มาวางที่นี่</h3>
        <p className="text-slate-500 text-sm mt-1">หรือคลิกเพื่อเลือกไฟล์ CSV จากเครื่องของคุณ</p>
        <span className="inline-block mt-3 text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full border border-slate-200">
          รองรับไฟล์ .csv (เข้ารหัส UTF-8)
        </span>
      </div>

      {/* Status Messages */}
      {status.message && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 ${status.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
          <div className={`p-1 rounded-full ${status.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
            {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          </div>
          <div className="font-medium text-sm mt-0.5">{status.message}</div>
          <button onClick={() => setStatus({ type: null, message: "" })} className="ml-auto text-slate-400 hover:text-slate-600 p-1">
            <X size={16} />
          </button>
        </div>
      )}

      {/* 🌟 Preview Area */}
      {parsedData.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-white">
            <h2 className="font-bold text-slate-800 text-base">
              ตัวอย่างข้อมูล <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full text-xs ml-2 font-bold">{parsedData.length} รายการ</span>
            </h2>
            <button 
              onClick={() => setParsedData([])}
              className="text-xs text-slate-500 hover:text-red-600 font-medium transition-colors"
            >
              ล้างข้อมูลที่เลือก
            </button>
          </div>
          
          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-50 shadow-sm">
                <tr className="text-slate-500 border-b border-slate-200 text-xs font-semibold uppercase">
                  <th className="py-3 px-4 whitespace-nowrap">SKU</th>
                  <th className="py-3 px-4 whitespace-nowrap">Product Name</th>
                  <th className="py-3 px-4 whitespace-nowrap">Collection</th>
                  <th className="py-3 px-4 whitespace-nowrap">Series</th>
                  <th className="py-3 px-4 whitespace-nowrap">Cost</th>
                  <th className="py-3 px-4 whitespace-nowrap">Price</th>
                  <th className="py-3 px-4 whitespace-nowrap">Size (TxWxL)</th>
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
                      ...แสดงเฉพาะ 20 รายการแรก จากทั้งหมด {parsedData.length} รายการ...
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
              className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer"
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span>กำลังประมวลผลและนำเข้า Database...</span>
                </>
              ) : (
                <>
                  <UploadCloud size={20} />
                  <span>ยืนยันและนำเข้า Database ({parsedData.length} รายการ)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

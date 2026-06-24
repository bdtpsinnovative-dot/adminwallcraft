'use client';

import React, { useState, useEffect, Fragment, useRef } from 'react';
import { Search, Warehouse, Inbox, Truck, Route, Boxes, Image as ImageIcon, Upload, X, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function InInventoryPage() {
  const pathname = usePathname();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // 📦 State สำหรับนำเข้า CSV และ Alert
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'success', title: '', message: '' });
  const [importModal, setImportModal] = useState({ isOpen: false, data: [] as any[] });
  const [isImporting, setIsImporting] = useState(false);
  const currentUserId = null; // 🟢 รอเปลี่ยนเป็น ID ยูสเซอร์ตอนต่อระบบ Auth

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory-management?type=in`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (type: 'success' | 'error', title: string, message: string) => {
    setAlertModal({ isOpen: true, type, title, message });
  };

  // 🟢 1. ฟังก์ชันอ่านไฟล์ CSV เมื่อผู้ใช้เลือกไฟล์
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      
      if (lines.length < 2) {
        showAlert('error', 'ไฟล์ไม่ถูกต้อง', 'ไม่พบข้อมูลในไฟล์ CSV');
        return;
      }

      const cleanStr = (str: string) => {
        return str ? str.replace(/^"|"$/g, '').trim() : '';
      };
      
      const cleanNum = (str: string) => {
        if (!str) return 0;
        const cleaned = str.replace(/^"|"$/g, '').replace(/,/g, '').trim();
        return Number(cleaned) || 0;
      };

      const parseDate = (dateStr: string) => {
        if (!dateStr) return undefined;
        const cleanDate = dateStr.replace(/^"|"$/g, '').trim();
        const parts = cleanDate.split('/');
        if (parts.length === 3) {
          return `${parts[2]}-${parts[1]}-${parts[0]}`; 
        }
        return undefined; 
      };

      const parsedData = [];
      
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const cols = lines[i].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/); 
        const qty = cleanNum(cols[8]);
        
        if (qty > 0) {
          parsedData.push({
            date_in: parseDate(cols[0]),
            series: cleanStr(cols[1]),
            item_name: cleanStr(cols[2]) || 'ไม่ระบุชื่อ',
            color_name: cleanStr(cols[3]),
            material: cleanStr(cols[4]),
            height_mm: cleanNum(cols[5]),
            width_mm: cleanNum(cols[6]),
            thickness_mm: cleanNum(cols[7]),
            qty: qty
          });
        }
      }

      if (parsedData.length > 0) {
        setImportModal({ isOpen: true, data: parsedData });
      } else {
        showAlert('error', 'ไม่พบรายการอัปเดต', 'ไม่มีข้อมูลจำนวน (QTY) ที่มากกว่า 0 ให้รับเข้า');
      }
    };
    
    reader.readAsText(file);
    e.target.value = ''; 
  };

  // 🟢 2. ฟังก์ชันกดยืนยันนำเข้าข้อมูล (ยิง API)
  const confirmImport = async () => {
    setIsImporting(true);
    try {
      const res = await fetch('/api/inventory-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import_csv',
          user_id: currentUserId,
          csvData: importModal.data
        }),
      });
      const result = await res.json();
      
      if (result.success) {
        setImportModal({ isOpen: false, data: [] });
        showAlert('success', 'นำเข้าสำเร็จ!', `บันทึกรายการรับเข้าจำนวน ${importModal.data.length} รายการเรียบร้อยแล้ว`);
        fetchData(); 
      } else {
        showAlert('error', 'ล้มเหลว', result.message);
      }
    } catch (e) {
      console.error(e);
      showAlert('error', 'ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setIsImporting(false);
    }
  };

  const filteredData = data.filter(item => 
    item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.series?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedData = filteredData.reduce((acc, item) => {
    const groupName = item.item_name || 'ไม่ระบุชื่อสินค้า';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(item);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="min-h-screen bg-slate-50 p-2 md:p-4 text-slate-800 font-sans">
      <div className="max-w-[1600px] mx-auto bg-white border border-slate-300 shadow-sm min-h-[calc(100vh-2rem)] flex flex-col">
        
        {/* Toolbar Section */}
        <div className="bg-slate-100 border-b border-slate-300 p-3">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-slate-800 whitespace-nowrap flex items-center gap-2">
                <Truck size={22} className="text-blue-600" />
                Logistics & Inventory
              </h1>
              
              <div className="flex bg-white rounded border border-slate-300 overflow-hidden text-sm font-medium">
                <Link href="/inventory/master" className={`px-4 py-1.5 transition-colors border-r border-slate-300 flex items-center gap-2 ${pathname === '/inventory/master' ? 'bg-blue-100 text-blue-800' : 'hover:bg-slate-50'}`}>
                  <Warehouse size={14} /> Master
                </Link>
                <Link href="/inventory/in" className={`px-4 py-1.5 transition-colors border-r border-slate-300 flex items-center gap-2 ${pathname === '/inventory/in' ? 'bg-green-100 text-green-800' : 'hover:bg-slate-50'}`}>
                  <Inbox size={14} /> In
                </Link>
                <Link href="/inventory/out" className={`px-4 py-1.5 transition-colors border-r border-slate-300 flex items-center gap-2 ${pathname === '/inventory/out' ? 'bg-orange-100 text-orange-800' : 'hover:bg-slate-50'}`}>
                  <Truck size={14} /> Out
                </Link>
                <Link href="/inventory/log" className={`px-4 py-1.5 transition-colors flex items-center gap-2 ${pathname === '/inventory/log' ? 'bg-purple-100 text-purple-800' : 'hover:bg-slate-50'}`}>
                  <Route size={14} /> Log
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full xl:w-auto">
              <div className="relative flex-1 xl:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input type="text" placeholder="ค้นหาสินค้ารับเข้า..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
              </div>
              
              <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm font-medium whitespace-nowrap transition-colors border border-blue-700 shadow-sm"
              >
                <Upload size={14} /> อัปโหลด Excel (CSV)
              </button>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full border-collapse text-left text-[13px] min-w-[1000px]">
            <thead className="sticky top-0 z-10 shadow-sm">
              <tr className="bg-slate-200 text-slate-700 font-semibold uppercase tracking-tight">
                <th className="px-3 py-2 border border-slate-300 w-16 text-center">Image</th>
                <th className="px-3 py-2 border border-slate-300 w-32">Series</th>
                <th className="px-3 py-2 border border-slate-300 w-40">Color</th>
                <th className="px-3 py-2 border border-slate-300 w-32">Material</th>
                <th className="px-3 py-2 border border-slate-300 w-40">Dimensions (mm)</th>
                <th className="px-3 py-2 border border-slate-300 w-32">Date In</th>
                <th className="px-3 py-2 border border-slate-300 w-32 text-center">Operator</th>
                <th className="px-3 py-2 border border-slate-300 w-24 text-center">QTY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-500 border border-slate-300">กำลังโหลดข้อมูล...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-500 border border-slate-300">ไม่พบข้อมูล</td></tr>
              ) : (
                Object.entries(groupedData).map(([groupName, items]) => (
                  <Fragment key={groupName}>
                    <tr className="bg-slate-100">
                      <td colSpan={8} className="px-3 py-1.5 border border-slate-300 font-bold text-slate-800">
                        <div className="flex items-center gap-2"><Boxes size={14} className="text-blue-600" />{groupName} <span className="font-normal text-slate-500 text-xs ml-2">({(items as any[]).length} รายการ)</span></div>
                      </td>
                    </tr>
                    {(items as any[]).map((item) => {
                      const imgUrl = item.catalog_image || item.catalog_image_url;
                      return (
                        <tr key={item.id} className="hover:bg-blue-50/50 transition-colors bg-white">
                          <td className="px-3 py-1.5 border border-slate-300 text-center">
                            {/* 🟢 ดัก URL และแสดง Placeholder กรณีไม่มีรูป */}
                            {imgUrl ? (
                              <div className="w-8 h-8 rounded border border-slate-200 overflow-hidden mx-auto shadow-sm">
                                <img src={imgUrl} alt="product" className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded border border-slate-100 bg-slate-50 flex items-center justify-center mx-auto text-slate-300 shadow-sm">
                                <ImageIcon size={14} />
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-1.5 border border-slate-300">{item.series || '-'}</td>
                          <td className="px-3 py-1.5 border border-slate-300">{item.color_name || '-'}</td>
                          <td className="px-3 py-1.5 border border-slate-300 text-slate-600">{item.material || '-'}</td>
                          <td className="px-3 py-1.5 border border-slate-300 text-slate-600">{item.height_mm || 0} x {item.width_mm || 0} x {item.thickness_mm || 0}</td>
                          <td className="px-3 py-1.5 border border-slate-300">{item.date_in}</td>
                          <td className="px-3 py-1.5 border border-slate-300 text-center text-blue-700 font-medium text-xs">{item.operator_name || '-'}</td>
                          <td className="px-3 py-1.5 border border-slate-300 text-center font-bold text-green-600">+{item.qty?.toLocaleString() || 0}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer */}
        <div className="bg-slate-100 border-t border-slate-300 px-4 py-1.5 text-xs text-slate-500 flex justify-between">
          <span>{filteredData.length} records found (In)</span>
          <span>Logistics & Inventory System • Online</span>
        </div>
      </div>

      {/* 🟢 Modal แจ้งเตือน Alert */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl flex flex-col items-center text-center border border-slate-200">
            {alertModal.type === 'success' ? (
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4"><CheckCircle2 size={24} /></div>
            ) : (
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4"><AlertCircle size={24} /></div>
            )}
            <h3 className="text-lg font-bold text-slate-800 mb-2">{alertModal.title}</h3>
            <p className="text-slate-500 mb-6 text-sm">{alertModal.message}</p>
            <button onClick={() => setAlertModal({ ...alertModal, isOpen: false })} className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded font-medium transition-colors text-sm">ตกลง</button>
          </div>
        </div>
      )}

      {/* 🟢 Modal ดูตัวอย่างข้อมูลก่อน Import */}
      {importModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-5xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-200 bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><FileText size={20} className="text-blue-600"/> ตรวจสอบข้อมูลก่อนนำเข้า</h2>
                <p className="text-xs text-slate-500 mt-1">พบรายการสินค้าที่ต้องการรับเข้าจำนวน {importModal.data.length} รายการ (เฉพาะรายการที่มียอด &gt; 0)</p>
              </div>
              {!isImporting && <button onClick={() => setImportModal({ isOpen: false, data: [] })} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-full transition-colors"><X size={20} /></button>}
            </div>
            
            <div className="flex-1 overflow-auto p-4 bg-slate-100/50">
              <table className="w-full border-collapse text-left text-[12px] bg-white border border-slate-200 shadow-sm">
                <thead className="bg-slate-800 text-white">
                  <tr>
                    <th className="px-2 py-2 border-b border-slate-700">ลำดับ</th>
                    <th className="px-2 py-2 border-b border-slate-700">Series</th>
                    <th className="px-2 py-2 border-b border-slate-700">ชื่อสินค้า (Item)</th>
                    <th className="px-2 py-2 border-b border-slate-700">Color</th>
                    <th className="px-2 py-2 border-b border-slate-700">Material</th>
                    <th className="px-2 py-2 border-b border-slate-700">H x W x T (mm)</th>
                    <th className="px-2 py-2 border-b border-slate-700 text-center font-bold text-green-300">+ QTY</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {importModal.data.map((row, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/50">
                      <td className="px-2 py-1.5 text-center text-slate-500">{idx + 1}</td>
                      <td className="px-2 py-1.5">{row.series || '-'}</td>
                      <td className="px-2 py-1.5 font-medium text-slate-800">{row.item_name}</td>
                      <td className="px-2 py-1.5">{row.color_name || '-'}</td>
                      <td className="px-2 py-1.5 text-slate-600">{row.material || '-'}</td>
                      <td className="px-2 py-1.5 text-slate-600">{row.height_mm} x {row.width_mm} x {row.thickness_mm}</td>
                      <td className="px-2 py-1.5 text-center font-bold text-green-600 bg-green-50">{row.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                <strong>💡 ข้อควรทราบ:</strong> ระบบจะตรวจสอบจากสเปคสินค้า (Series, Color, Material, Size) หากไม่พบในระบบ <b>ระบบจะสร้างเป็นสินค้าใหม่ (Master) ให้โดยอัตโนมัติ</b> และทำการรับเข้าสต็อกให้ทันที
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-3">
              <button disabled={isImporting} onClick={() => setImportModal({ isOpen: false, data: [] })} className="px-4 py-2 bg-slate-100 text-slate-700 rounded border border-slate-300 hover:bg-slate-200 text-sm font-medium transition-colors disabled:opacity-50">
                ยกเลิก
              </button>
              <button disabled={isImporting} onClick={confirmImport} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                {isImporting ? <span className="animate-pulse">กำลังประมวลผล...</span> : <><CheckCircle2 size={16} /> ยืนยันการนำเข้า</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
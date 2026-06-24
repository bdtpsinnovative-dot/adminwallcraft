'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { Search, Warehouse, Inbox, Truck, Route, Boxes, PlusCircle, MinusCircle, X, CheckCircle2, AlertCircle, Link as LinkIcon, Image as ImageIcon, Trash } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function MasterInventoryPage() {
  const pathname = usePathname();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // 📦 State เฉพาะของหน้า Master
  const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'success', title: '', message: '' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({ 
    series: '', item_name: '', color_name: '', material: '', height_mm: '', width_mm: '', thickness_mm: '', 
    catalog_image_url: '', 
    preview_image: '' 
  });
  
  const [txModal, setTxModal] = useState<{ isOpen: boolean, type: 'in' | 'out', item: any }>({ isOpen: false, type: 'in', item: null });
  const [txForm, setTxForm] = useState({ qty: '', quotation: '', invoice_tps: '' });
  
  const [linkModal, setLinkModal] = useState<{ isOpen: boolean, target: 'existing' | 'new', stockItem: any }>({ isOpen: false, target: 'existing', stockItem: null });
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogResults, setCatalogResults] = useState<any[]>([]);
  const [isSearchingCatalog, setIsSearchingCatalog] = useState(false);
  
  const [manualUrl, setManualUrl] = useState(''); // 🟢 เอาไว้จำ URL ที่พิมพ์กรอกเอง

  const currentUserId = null; 

  // 🚀 ดึงข้อมูลตอนเปิดหน้า
  useEffect(() => {
    fetchData();
  }, []); // ไม่ต้องพึ่ง dependency view แล้ว เพราะเราอยู่หน้า master ตลอด

  // 🔍 ค้นหา Catalog
  useEffect(() => {
    if (linkModal.isOpen) {
      searchCatalog();
    }
  }, [catalogSearch, linkModal.isOpen]);

  const searchCatalog = async () => {
    setIsSearchingCatalog(true);
    try {
      const res = await fetch(`/api/inventory-management?type=catalog_search&q=${catalogSearch}`);
      const json = await res.json();
      if (json.success) setCatalogResults(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingCatalog(false);
    }
  };

  // 🟢 ฟังก์ชันสำหรับกดเลือกรูปจากระบบ Catalog
  const executeLinkProduct = async (catalogItem: any) => {
    if (linkModal.target === 'new') {
      setNewItem({ ...newItem, catalog_image_url: catalogItem.image, preview_image: catalogItem.image });
      setLinkModal({ isOpen: false, target: 'existing', stockItem: null });
      return;
    }
    try {
      const res = await fetch('/api/inventory-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'link_product', stock_id: linkModal.stockItem.id, image_url: catalogItem.image }),
      });
      const result = await res.json();
      setLinkModal({ isOpen: false, target: 'existing', stockItem: null });
      if (result.success) {
        showAlert('success', 'สำเร็จ!', result.message);
        fetchData(); 
      } else {
        showAlert('error', 'ข้อผิดพลาด', result.message);
      }
    } catch (e) {
      showAlert('error', 'ข้อผิดพลาด', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    }
  };

  // 🟢 ฟังก์ชันสำหรับบันทึก URL รูปภาพที่กรอกเองตรงๆ
  const handleManualUrlSubmit = async () => {
    if (!manualUrl) return;

    if (linkModal.target === 'new') {
      setNewItem({ ...newItem, catalog_image_url: manualUrl, preview_image: manualUrl });
      setLinkModal({ isOpen: false, target: 'existing', stockItem: null });
      setManualUrl('');
      return;
    }

    try {
      const res = await fetch('/api/inventory-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'link_product', stock_id: linkModal.stockItem.id, image_url: manualUrl }),
      });
      const result = await res.json();
      setLinkModal({ isOpen: false, target: 'existing', stockItem: null });
      setManualUrl('');
      if (result.success) {
        showAlert('success', 'สำเร็จ!', result.message);
        fetchData(); 
      } else {
        showAlert('error', 'ข้อผิดพลาด', result.message);
      }
    } catch (e) {
      showAlert('error', 'ข้อผิดพลาด', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    }
  };

  // 🟢 ฟังก์ชันสั่งลบแถว
  const handleDeleteRow = async (stockId: string, itemName: string) => {
    if (!confirm(`ยืนยันการลบแถว "${itemName}" ออกจากตารางคลังสินค้า?\n(ประวัติ In/Out ของสินค้านี้จะหายไปด้วยนะ)`)) return;
    try {
      const res = await fetch('/api/inventory-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_stock_row', stock_id: stockId }),
      });
      const result = await res.json();
      if (result.success) {
        showAlert('success', 'สำเร็จ!', result.message);
        fetchData(); 
      } else {
        showAlert('error', 'ล้มเหลว', result.message);
      }
    } catch (e) {
      showAlert('error', 'ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory-management?type=balance`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setData([]); 
      }
    } catch (e) {
      console.error(e);
      setData([]); 
      showAlert('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (type: 'success' | 'error', title: string, message: string) => {
    setAlertModal({ isOpen: true, type, title, message });
  };

  const handleAddNewProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/inventory-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_master', user_id: currentUserId, ...newItem }),
      });
      const result = await res.json();
      if (result.success) {
        setShowAddModal(false);
        setNewItem({ series: '', item_name: '', color_name: '', material: '', height_mm: '', width_mm: '', thickness_mm: '', catalog_image_url: '', preview_image: '' });
        showAlert('success', 'สำเร็จ!', 'เพิ่มสินค้าใหม่เรียบร้อยแล้ว');
        fetchData();
      } else {
        showAlert('error', 'ล้มเหลว', result.message);
      }
    } catch (e) {
      console.error(e);
      showAlert('error', 'ล้มเหลว', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
  };

  const openTransactionModal = (item: any, type: 'in' | 'out') => {
    setTxModal({ isOpen: true, type, item });
    setTxForm({ qty: '', quotation: '', invoice_tps: '' });
  };

  const submitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = parseInt(txForm.qty);
    
    if (isNaN(qtyNum) || qtyNum <= 0) {
      showAlert('error', 'ข้อมูลไม่ถูกต้อง', 'กรุณาระบุจำนวนเป็นตัวเลขที่มากกว่า 0');
      return;
    }
    if (txModal.type === 'out' && qtyNum > txModal.item.qty) {
      showAlert('error', 'สต็อกไม่พอ!', `สินค้าคงเหลือ ${txModal.item.qty} แต่ต้องการเบิก ${qtyNum}`);
      return;
    }

    let payload: any = { 
      action: txModal.type, 
      product_id: txModal.item.id, 
      qty: qtyNum,
      user_id: currentUserId 
    };

    if (txModal.type === 'out') {
      payload.quotation = txForm.quotation || null;
      payload.invoice_tps = txForm.invoice_tps || null;
    }

    try {
      const res = await fetch('/api/inventory-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.success) {
        setTxModal({ ...txModal, isOpen: false });
        showAlert('success', 'สำเร็จ!', `บันทึกการ${txModal.type === 'in' ? 'รับเข้า' : 'เบิกออก'}เรียบร้อยแล้ว`);
        fetchData(); 
      } else {
        showAlert('error', 'ข้อผิดพลาด', result.message);
      }
    } catch (e) {
      console.error(e);
      showAlert('error', 'ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
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
                <input type="text" placeholder="ค้นหาสินค้า / ทะเบียนรถ..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
              </div>
              <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap transition-colors border border-green-700">
                <PlusCircle size={14} /> เพิ่มรายการ
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
                <th className="px-3 py-2 border border-slate-300 w-32 text-center">Operator</th>
                <th className="px-3 py-2 border border-slate-300 w-24 text-center">Available QTY</th>
                <th className="px-3 py-2 border border-slate-300 w-24 text-center text-orange-600">Pending</th>
                <th className="px-3 py-2 border border-slate-300 w-40 text-center">Dock Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={9} className="p-8 text-center text-slate-500 border border-slate-300">กำลังโหลดข้อมูล...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-slate-500 border border-slate-300">ไม่พบข้อมูล</td></tr>
              ) : (
                (Object.entries(groupedData) as [string, any[]][]).map(([groupName, items]) => (
                  <Fragment key={groupName}>
                    <tr className="bg-slate-100">
                      <td colSpan={9} className="px-3 py-1.5 border border-slate-300 font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          <Boxes size={14} className="text-blue-600" />
                          {groupName} <span className="font-normal text-slate-500 text-xs ml-2">({items.length} รายการ)</span>
                        </div>
                      </td>
                    </tr>
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-blue-50/50 transition-colors bg-white group">
                        <td className="px-3 py-1.5 border border-slate-300 text-center">
                          {item.catalog_image ? (
                            <div onClick={() => setLinkModal({ isOpen: true, target: 'existing', stockItem: item })} className={`w-8 h-8 rounded border border-slate-200 overflow-hidden mx-auto shadow-sm relative cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all`}>
                              <img src={item.catalog_image} alt="product" className="w-full h-full object-cover" />
                              <div title={`เปลี่ยนรูป`} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                <LinkIcon size={12} className="text-white" />
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setLinkModal({ isOpen: true, target: 'existing', stockItem: item })} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors mx-auto block" title="ลิงก์กับสินค้าย่อย">
                              <LinkIcon size={16} />
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-1.5 border border-slate-300">{item.series || '-'}</td>
                        <td className="px-3 py-1.5 border border-slate-300">{item.color_name || '-'}</td>
                        <td className="px-3 py-1.5 border border-slate-300 text-slate-600">{item.material || '-'}</td>
                        <td className="px-3 py-1.5 border border-slate-300 text-slate-600">{item.height_mm || 0} x {item.width_mm || 0} x {item.thickness_mm || 0}</td>
                        <td className="px-3 py-1.5 border border-slate-300 text-center text-blue-700 font-medium text-xs">{item.operator_name || '-'}</td>
                        <td className={`px-3 py-1.5 border border-slate-300 text-center font-bold ${item.qty > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                          {item.qty?.toLocaleString() || 0}
                        </td>
                        <td className="px-3 py-1.5 border border-slate-300 text-center">
                          {item.pending_qty > 0 ? (
                            <span className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1 font-bold shadow-sm">{item.pending_qty}</span>
                          ) : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="px-3 py-1 border border-slate-300">
                          <div className="flex justify-center gap-1">
                            <button onClick={() => openTransactionModal(item, 'in')} className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 rounded text-xs font-medium"><PlusCircle size={12} /> IN</button>
                            <button onClick={() => openTransactionModal(item, 'out')} className="flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 rounded text-xs font-medium"><MinusCircle size={12} /> OUT</button>
                            {/* 🟢 ปุ่มลบแถวมาแล้ว */}
                            <button onClick={() => handleDeleteRow(item.id, item.item_name)} className="flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded text-xs font-medium" title="ลบแถว">
                              <Trash size={12} /> ลบ
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer */}
        <div className="bg-slate-100 border-t border-slate-300 px-4 py-1.5 text-xs text-slate-500 flex justify-between">
          <span>{filteredData.length} records found (Master)</span>
          <span>Logistics & Inventory System • Online</span>
        </div>
      </div>

      {/* โมดอลเฉพาะที่ใช้ใน Master */}
      {/* 1. Modal แจ้งเตือน */}
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

      {/* 2. Modal เลือกลิงก์สินค้าจาก Catalog */}
      {linkModal.isOpen && (linkModal.stockItem || linkModal.target === 'new') && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center pt-20 p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[80vh]">
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-200 bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><LinkIcon size={20} className="text-blue-600"/> ลิงก์รูปภาพจาก Catalog</h2>
                <p className="text-xs text-slate-500 mt-1">{linkModal.target === 'new' ? 'กำลังเลือกรูปภาพสำหรับสินค้ารายการใหม่' : `กำลังเชื่อมโยงให้กับสต็อก: ${linkModal.stockItem.item_name} (${linkModal.stockItem.series || '-'})`}</p>
              </div>
              <button onClick={() => setLinkModal({ isOpen: false, target: 'existing', stockItem: null })} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-full transition-colors"><X size={20} /></button>
            </div>
            
            {/* 🟢 ส่วนที่กรอก URL ด้วยตัวเอง */}
            <div className="p-4 border-b border-slate-200 bg-blue-50/60 flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-700">หรือวาง URL รูปภาพตรงนี้เลยก็ได้ครับนาย:</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="https://example.com/image.jpg" 
                  value={manualUrl} 
                  onChange={(e) => setManualUrl(e.target.value)} 
                  className="flex-1 px-3 py-1.5 text-sm bg-white border border-slate-300 rounded focus:border-blue-500 outline-none"
                />
                <button 
                  type="button" 
                  onClick={handleManualUrlSubmit} 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors border border-blue-700 whitespace-nowrap"
                >
                  ใช้รูปนี้
                </button>
              </div>
            </div>

            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder="ค้นหาชื่อสินค้า หรือ รหัส SKU ในระบบ Catalog..." value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" autoFocus />
              </div>
            </div>

            <div className="flex-1 overflow-auto p-2 bg-slate-50/50">
              {isSearchingCatalog ? (
                <div className="p-10 text-center text-slate-500 flex flex-col items-center gap-2"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>กำลังค้นหาข้อมูล...</div>
              ) : catalogResults.length === 0 ? (
                <div className="p-10 text-center text-slate-500"><ImageIcon size={32} className="mx-auto text-slate-300 mb-2" />ไม่พบสินค้าที่ตรงกับการค้นหา</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-2">
                  {catalogResults.map(catalogItem => (
                    <div key={catalogItem.id} onClick={() => executeLinkProduct(catalogItem)} className="bg-white border border-slate-200 rounded-lg p-3 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all group">
                      <div className="aspect-video bg-slate-100 rounded-md mb-3 overflow-hidden flex items-center justify-center border border-slate-100">
                        {catalogItem.image ? <img src={catalogItem.image} alt={catalogItem.sku} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <ImageIcon className="text-slate-300" size={24} />}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 mb-0.5">{catalogItem.sku}</div>
                      <div className="text-sm font-bold text-slate-800 leading-tight line-clamp-1">{catalogItem.name}</div>
                      <div className="text-xs text-slate-500 mt-1 line-clamp-1">{catalogItem.color || 'ไม่มีสี'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal รับเข้า/เบิกออก */}
      {txModal.isOpen && txModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg w-full max-w-md shadow-xl overflow-hidden border border-slate-200">
            <div className={`px-4 py-3 flex items-center justify-between text-white ${txModal.type === 'in' ? 'bg-green-600' : 'bg-orange-600'}`}>
              <h2 className="text-base font-bold flex items-center gap-2">{txModal.type === 'in' ? <><Inbox size={18} /> โหลดของเข้าคลัง</> : <><Truck size={18} /> จ่ายของขึ้นรถ</>}</h2>
              <button onClick={() => setTxModal({ ...txModal, isOpen: false })} className="text-white/80 hover:text-white"><X size={20} /></button>
            </div>
            
            <form onSubmit={submitTransaction} className="p-5">
              <div className="mb-5 p-3 bg-slate-50 rounded border border-slate-200 text-sm flex gap-4 items-center">
                {txModal.item.catalog_image ? (
                  <div className="w-16 h-16 rounded border border-slate-200 overflow-hidden shrink-0"><img src={txModal.item.catalog_image} alt="product" className="w-full h-full object-cover" /></div>
                ) : (
                  <div className="w-16 h-16 rounded border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0"><ImageIcon className="text-slate-300" size={24} /></div>
                )}
                <div>
                  <div className="text-slate-500 mb-1 text-xs">รายการสินค้า:</div>
                  <div className="font-bold text-slate-800">{txModal.item.item_name}</div>
                  <div className="text-slate-600 mt-1 text-xs">ซีรีส์: <span className="font-medium text-slate-900">{txModal.item.series || '-'}</span> | คงเหลือ: <span className="font-bold text-blue-600 text-sm">{txModal.item.qty}</span> ชิ้น</div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">จำนวนที่ต้องการ{txModal.type === 'in' ? 'รับเข้า' : 'เบิกออก'} *</label>
                  <input required type="number" min="1" className="w-full p-2 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-base" value={txForm.qty} onChange={e => setTxForm({...txForm, qty: e.target.value})} placeholder="ระบุจำนวน..." autoFocus />
                </div>
                {txModal.type === 'out' && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Quotation</label><input type="text" className="w-full p-2 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-sm" value={txForm.quotation} onChange={e => setTxForm({...txForm, quotation: e.target.value})} placeholder="อ้างอิง..." /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Invoice</label><input type="text" className="w-full p-2 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-sm" value={txForm.invoice_tps} onChange={e => setTxForm({...txForm, invoice_tps: e.target.value})} placeholder="อ้างอิง..." /></div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-6">
                <button type="button" onClick={() => setTxModal({ ...txModal, isOpen: false })} className="flex-1 py-2 bg-slate-100 text-slate-700 rounded border border-slate-300 hover:bg-slate-200 text-sm font-medium">ยกเลิก</button>
                <button type="submit" className={`flex-1 py-2 text-white rounded text-sm font-medium ${txModal.type === 'in' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}>ยืนยันบันทึก</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal เพิ่มสินค้าใหม่ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg w-full max-w-md shadow-xl overflow-hidden border border-slate-200">
            <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200 bg-slate-50">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2"><Boxes size={18} className="text-blue-600"/> สร้างรายการสินค้าใหม่</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddNewProduct} className="p-5 space-y-3">
              <div className="flex flex-col items-center pb-4 border-b border-slate-100 mb-4">
                {newItem.preview_image ? (
                  <div className="relative w-24 h-24 rounded-lg border border-slate-200 shadow-sm overflow-hidden group">
                    <img src={newItem.preview_image} alt="preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      {/* 🟢 แก้ปุ่มลบรูปแล้ว */}
                      <button type="button" onClick={() => setNewItem({...newItem, catalog_image_url: '', preview_image: ''})} className="text-white p-1 hover:text-red-400"><X size={20} /></button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setLinkModal({ isOpen: true, target: 'new', stockItem: null })} className="w-24 h-24 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 text-slate-400 hover:text-blue-600 flex flex-col items-center justify-center transition-colors">
                    <ImageIcon size={24} className="mb-1" />
                    <span className="text-[10px] font-medium">เลือกรูปภาพ</span>
                  </button>
                )}
              </div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">ชื่อสินค้า (บังคับ) *</label><input required type="text" className="w-full p-2 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm" value={newItem.item_name} onChange={e => setNewItem({...newItem, item_name: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Series</label><input type="text" className="w-full p-2 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm" value={newItem.series} onChange={e => setNewItem({...newItem, series: e.target.value})} /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">สี / ลาย</label><input type="text" className="w-full p-2 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm" value={newItem.color_name} onChange={e => setNewItem({...newItem, color_name: e.target.value})} /></div>
              </div>
              <div className="flex gap-2 mt-5 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2 bg-slate-100 text-slate-700 rounded border border-slate-300 hover:bg-slate-200 text-sm font-medium">ยกเลิก</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium">บันทึกสินค้า</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
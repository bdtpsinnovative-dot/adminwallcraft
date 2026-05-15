'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { Search, Warehouse, Inbox, Truck, Route, Boxes, X, CheckCircle2, AlertCircle, Edit, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function OutInventoryPage() {
  const pathname = usePathname();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'success', title: '', message: '' });
  const [editModal, setEditModal] = useState<{ isOpen: boolean, item: any }>({ isOpen: false, item: null });
  const [txForm, setTxForm] = useState({ qty: '', quotation: '', invoice_tps: '' });
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, out_id: string, new_status: 'approved' | 'rejected', title: string, message: string }>({ 
    isOpen: false, out_id: '', new_status: 'approved', title: '', message: '' 
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory-management?type=out`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (e) {
      console.error(e);
      showAlert('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (type: 'success' | 'error', title: string, message: string) => {
    setAlertModal({ isOpen: true, type, title, message });
  };

  const openEditModal = (item: any) => {
    setEditModal({ isOpen: true, item });
    setTxForm({ qty: item.qty.toString(), quotation: item.quotation || '', invoice_tps: item.invoice_tps || '' });
  };

  const submitEditOut = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = parseInt(txForm.qty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      showAlert('error', 'ข้อมูลไม่ถูกต้อง', 'กรุณาระบุจำนวนเป็นตัวเลขที่มากกว่า 0');
      return;
    }
    try {
      const res = await fetch('/api/inventory-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'edit_out', out_id: editModal.item.id, qty: qtyNum, quotation: txForm.quotation, invoice_tps: txForm.invoice_tps }),
      });
      const result = await res.json();
      if (result.success) {
        setEditModal({ isOpen: false, item: null });
        showAlert('success', 'สำเร็จ!', 'แก้ไขข้อมูลการเบิกออกเรียบร้อยแล้ว');
        fetchData(); 
      } else {
        showAlert('error', 'ข้อผิดพลาด', result.message);
      }
    } catch (e) {
      showAlert('error', 'ข้อผิดพลาด', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    }
  };

  const openApprovalConfirm = (out_id: string, status: 'approved' | 'rejected') => {
    setConfirmModal({
      isOpen: true, out_id, new_status: status,
      title: status === 'approved' ? 'ยืนยันการอนุมัติ' : 'ไม่อนุมัติ และ คืนสต็อก',
      message: status === 'approved' ? 'คุณแน่ใจหรือไม่ที่จะ "อนุมัติ" รถขนส่งสินค้านี้?' : 'หากไม่อนุมัติ ระบบจะทำการ "คืนจำนวนสต็อก" กลับเข้าคลังโดยอัตโนมัติ คุณแน่ใจหรือไม่?'
    });
  };

  const executeApproval = async () => {
    try {
      const res = await fetch('/api/inventory-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status_out', out_id: confirmModal.out_id, new_status: confirmModal.new_status }),
      });
      const result = await res.json();
      setConfirmModal({ ...confirmModal, isOpen: false });
      if (result.success) {
        showAlert('success', 'สำเร็จ!', result.message);
        fetchData();
      } else {
        showAlert('error', 'ข้อผิดพลาด', result.message);
      }
    } catch (e) {
      setConfirmModal({ ...confirmModal, isOpen: false });
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

  const StatusBadge = ({ status }: { status: string }) => {
    if (status === 'pending') return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 border border-yellow-300 text-[11px] font-bold">Pending</span>;
    if (status === 'approved') return <span className="px-2 py-0.5 bg-green-100 text-green-800 border border-green-300 text-[11px] font-bold">Approved</span>;
    if (status === 'rejected') return <span className="px-2 py-0.5 bg-red-100 text-red-800 border border-red-300 text-[11px] font-bold">Rejected</span>;
    return <span className="text-slate-400">-</span>;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-2 md:p-4 text-slate-800 font-sans">
      <div className="max-w-[1600px] mx-auto bg-white border border-slate-300 shadow-sm min-h-[calc(100vh-2rem)] flex flex-col">
        
        {/* Toolbar */}
        <div className="bg-slate-100 border-b border-slate-300 p-3">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-slate-800 whitespace-nowrap flex items-center gap-2"><Truck size={22} className="text-blue-600" />Logistics & Inventory</h1>
              <div className="flex bg-white rounded border border-slate-300 overflow-hidden text-sm font-medium">
                <Link href="/inventory/master" className={`px-4 py-1.5 transition-colors border-r border-slate-300 flex items-center gap-2 ${pathname === '/inventory/master' ? 'bg-blue-100 text-blue-800' : 'hover:bg-slate-50'}`}><Warehouse size={14} /> Master</Link>
                <Link href="/inventory/in" className={`px-4 py-1.5 transition-colors border-r border-slate-300 flex items-center gap-2 ${pathname === '/inventory/in' ? 'bg-green-100 text-green-800' : 'hover:bg-slate-50'}`}><Inbox size={14} /> In</Link>
                <Link href="/inventory/out" className={`px-4 py-1.5 transition-colors border-r border-slate-300 flex items-center gap-2 ${pathname === '/inventory/out' ? 'bg-orange-100 text-orange-800' : 'hover:bg-slate-50'}`}><Truck size={14} /> Out</Link>
                <Link href="/inventory/log" className={`px-4 py-1.5 transition-colors flex items-center gap-2 ${pathname === '/inventory/log' ? 'bg-purple-100 text-purple-800' : 'hover:bg-slate-50'}`}><Route size={14} /> Log</Link>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full xl:w-auto">
              <div className="relative flex-1 xl:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input type="text" placeholder="ค้นหาสินค้า / ทะเบียนรถ..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
              </div>
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
                <th className="px-3 py-2 border border-slate-300 w-24">Date Out</th>
                <th className="px-3 py-2 border border-slate-300 w-32">Quotation</th>
                <th className="px-3 py-2 border border-slate-300 w-32">Invoice</th>
                <th className="px-3 py-2 border border-slate-300 w-24 text-center">Status</th>
                <th className="px-3 py-2 border border-slate-300 w-32 text-center">Operator</th>
                <th className="px-3 py-2 border border-slate-300 w-24 text-center">QTY</th>
                <th className="px-3 py-2 border border-slate-300 w-24 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={12} className="p-8 text-center text-slate-500 border border-slate-300">กำลังโหลดข้อมูล...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={12} className="p-8 text-center text-slate-500 border border-slate-300">ไม่พบข้อมูล</td></tr>
              ) : (
                Object.entries(groupedData)as [string, any[]][]).map(([groupName, items]) => (
                  <Fragment key={groupName}>
                    <tr className="bg-slate-100">
                      <td colSpan={12} className="px-3 py-1.5 border border-slate-300 font-bold text-slate-800">
                        <div className="flex items-center gap-2"><Boxes size={14} className="text-blue-600" />{groupName} <span className="font-normal text-slate-500 text-xs ml-2">({items.length} รายการ)</span></div>
                      </td>
                    </tr>
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-blue-50/50 transition-colors bg-white">
                        <td className="px-3 py-1.5 border border-slate-300 text-center">
                          {item.catalog_image ? (
                            <div className="w-8 h-8 rounded border border-slate-200 overflow-hidden mx-auto shadow-sm"><img src={item.catalog_image} alt="product" className="w-full h-full object-cover" /></div>
                          ) : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="px-3 py-1.5 border border-slate-300">{item.series || '-'}</td>
                        <td className="px-3 py-1.5 border border-slate-300">{item.color_name || '-'}</td>
                        <td className="px-3 py-1.5 border border-slate-300 text-slate-600">{item.material || '-'}</td>
                        <td className="px-3 py-1.5 border border-slate-300 text-slate-600">{item.height_mm || 0} x {item.width_mm || 0} x {item.thickness_mm || 0}</td>
                        <td className="px-3 py-1.5 border border-slate-300 whitespace-nowrap">{item.date_out}</td>
                        <td className="px-3 py-1.5 border border-slate-300 font-mono text-[11px]">{item.quotation || '-'}</td>
                        <td className="px-3 py-1.5 border border-slate-300 font-mono text-[11px]">{item.invoice_tps || '-'}</td>
                        <td className="px-3 py-1.5 border border-slate-300 text-center"><StatusBadge status={item.status} /></td>
                        <td className="px-3 py-1.5 border border-slate-300 text-center text-blue-700 font-medium text-xs">{item.operator_name || '-'}</td>
                        <td className="px-3 py-1.5 border border-slate-300 text-center font-bold text-orange-600">{item.qty?.toLocaleString() || 0}</td>
                        <td className="px-3 py-1 border border-slate-300">
                          {item.status === 'pending' ? (
                            <div className="flex justify-center gap-1">
                              <button onClick={() => openEditModal(item)} className="p-1 text-blue-600 hover:bg-blue-100 rounded" title="แก้ไขข้อมูล"><Edit size={16} /></button>
                              <button onClick={() => openApprovalConfirm(item.id, 'approved')} className="p-1 text-green-600 hover:bg-green-100 rounded" title="อนุมัติ"><CheckCircle2 size={16} /></button>
                              <button onClick={() => openApprovalConfirm(item.id, 'rejected')} className="p-1 text-red-600 hover:bg-red-100 rounded" title="ไม่อนุมัติ"><X size={16} /></button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))
              }
            </tbody>
          </table>
        </div>
        
        {/* Footer */}
        <div className="bg-slate-100 border-t border-slate-300 px-4 py-1.5 text-xs text-slate-500 flex justify-between">
          <span>{filteredData.length} records found (Out)</span>
          <span>Logistics & Inventory System • Online</span>
        </div>
      </div>

      {/* Modals */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl flex flex-col items-center text-center border border-slate-200">
            {alertModal.type === 'success' ? <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4"><CheckCircle2 size={24} /></div> : <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4"><AlertCircle size={24} /></div>}
            <h3 className="text-lg font-bold text-slate-800 mb-2">{alertModal.title}</h3>
            <p className="text-slate-500 mb-6 text-sm">{alertModal.message}</p>
            <button onClick={() => setAlertModal({ ...alertModal, isOpen: false })} className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded font-medium transition-colors text-sm">ตกลง</button>
          </div>
        </div>
      )}

      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl flex flex-col items-center text-center border border-slate-200">
            {confirmModal.new_status === 'approved' ? <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4"><Truck size={24} /></div> : <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4"><AlertCircle size={24} /></div>}
            <h3 className="text-lg font-bold text-slate-800 mb-2">{confirmModal.title}</h3>
            <p className="text-slate-500 mb-6 text-sm">{confirmModal.message}</p>
            <div className="flex gap-2 w-full">
              <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} className="flex-1 py-2 bg-slate-100 text-slate-700 rounded border border-slate-300 hover:bg-slate-200 text-sm font-medium">ยกเลิก</button>
              <button onClick={executeApproval} className={`flex-1 py-2 text-white rounded text-sm font-medium ${confirmModal.new_status === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>ยืนยัน</button>
            </div>
          </div>
        </div>
      )}

      {editModal.isOpen && editModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg w-full max-w-md shadow-xl overflow-hidden border border-slate-200">
            <div className="px-4 py-3 flex items-center justify-between text-white bg-blue-600">
              <h2 className="text-base font-bold flex items-center gap-2"><Edit size={18} /> แก้ไขข้อมูลการเบิกออก</h2>
              <button onClick={() => setEditModal({ isOpen: false, item: null })} className="text-white/80 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={submitEditOut} className="p-5">
              <div className="mb-5 p-3 bg-slate-50 rounded border border-slate-200 text-sm flex gap-4 items-center">
                {editModal.item.catalog_image ? <div className="w-16 h-16 rounded border border-slate-200 overflow-hidden shrink-0"><img src={editModal.item.catalog_image} alt="product" className="w-full h-full object-cover" /></div> : <div className="w-16 h-16 rounded border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0"><ImageIcon className="text-slate-300" size={24} /></div>}
                <div>
                  <div className="text-slate-500 mb-1 text-xs">รายการสินค้า:</div>
                  <div className="font-bold text-slate-800">{editModal.item.item_name}</div>
                  <div className="text-slate-600 mt-1 text-xs">ซีรีส์: <span className="font-medium text-slate-900">{editModal.item.series || '-'}</span></div>
                </div>
              </div>
              <div className="space-y-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">จำนวนที่ต้องการเบิกออก *</label><input required type="number" min="1" className="w-full p-2 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-base" value={txForm.qty} onChange={e => setTxForm({...txForm, qty: e.target.value})} placeholder="ระบุจำนวน..." autoFocus /></div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Quotation</label><input type="text" className="w-full p-2 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-sm" value={txForm.quotation} onChange={e => setTxForm({...txForm, quotation: e.target.value})} placeholder="อ้างอิง..." /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Invoice</label><input type="text" className="w-full p-2 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-sm" value={txForm.invoice_tps} onChange={e => setTxForm({...txForm, invoice_tps: e.target.value})} placeholder="อ้างอิง..." /></div>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button type="button" onClick={() => setEditModal({ isOpen: false, item: null })} className="flex-1 py-2 bg-slate-100 text-slate-700 rounded border border-slate-300 hover:bg-slate-200 text-sm font-medium">ยกเลิก</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium">บันทึกการแก้ไข</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
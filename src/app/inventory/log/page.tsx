'use client';

import React, { useState, useEffect } from 'react';
import { Search, Warehouse, Inbox, Truck, Route } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function LogInventoryPage() {
  const pathname = usePathname();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory-management?type=log`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = data.filter(item => 
    item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.series?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                <input type="text" placeholder="ค้นหาชื่อสินค้า / ซีรีส์..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Data Table - No grouping for LOG */}
        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full border-collapse text-left text-[13px] min-w-[1000px]">
            <thead className="sticky top-0 z-10 shadow-sm">
              <tr className="bg-slate-200 text-slate-700 font-semibold uppercase tracking-tight">
                <th className="px-3 py-2 border border-slate-300 w-16 text-center">Image</th>
                <th className="px-3 py-2 border border-slate-300 w-32">Date/Time</th>
                <th className="px-3 py-2 border border-slate-300 w-24 text-center">Movement</th>
                <th className="px-3 py-2 border border-slate-300">Product Name</th>
                <th className="px-3 py-2 border border-slate-300 w-32">Series / Color</th>
                <th className="px-3 py-2 border border-slate-300 w-20 text-center">QTY</th>
                <th className="px-3 py-2 border border-slate-300 w-32 text-center">Operator</th>
                <th className="px-3 py-2 border border-slate-300 w-24 text-center">Status</th>
                <th className="px-3 py-2 border border-slate-300 w-40">Transport Ref.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={9} className="p-8 text-center text-slate-500 border border-slate-300">กำลังโหลดข้อมูล...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-slate-500 border border-slate-300">ไม่พบข้อมูล</td></tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-3 py-1.5 border border-slate-300 text-center">
                      {item.catalog_image ? (
                        <div className="w-8 h-8 rounded border border-slate-200 overflow-hidden mx-auto shadow-sm"><img src={item.catalog_image} alt="product" className="w-full h-full object-cover" /></div>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-3 py-1.5 border border-slate-300 whitespace-nowrap">
                      {item.date} <span className="text-slate-400 ml-1">{new Date(item.timestamp).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}</span>
                    </td>
                    <td className="px-3 py-1.5 border border-slate-300 text-center">
                      <span className={`font-bold flex items-center justify-center gap-1 ${item.action_type === 'IN' ? 'text-green-600' : 'text-orange-600'}`}>
                        {item.action_type === 'IN' ? <><Inbox size={12}/> IN</> : <><Truck size={12}/> OUT</>}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 border border-slate-300 font-medium">{item.item_name}</td>
                    <td className="px-3 py-1.5 border border-slate-300 text-slate-600">{item.series || '-'} {item.color_name ? `/ ${item.color_name}` : ''}</td>
                    <td className={`px-3 py-1.5 border border-slate-300 text-center font-bold ${item.action_type === 'IN' ? 'text-green-600' : 'text-orange-600'}`}>{item.qty}</td>
                    <td className="px-3 py-1.5 border border-slate-300 text-center text-blue-700 font-medium text-xs">{item.operator_name || '-'}</td>
                    <td className="px-3 py-1.5 border border-slate-300 text-center"><StatusBadge status={item.status} /></td>
                    <td className="px-3 py-1.5 border border-slate-300 text-slate-500 text-xs">{item.ref}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer */}
        <div className="bg-slate-100 border-t border-slate-300 px-4 py-1.5 text-xs text-slate-500 flex justify-between">
          <span>{filteredData.length} records found (Log)</span>
          <span>Logistics & Inventory System • Online</span>
        </div>
      </div>
    </div>
  );
}
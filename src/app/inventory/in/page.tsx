'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { Search, Warehouse, Inbox, Truck, Route, Boxes, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function InInventoryPage() {
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
      const res = await fetch(`/api/inventory-management?type=in`);
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
                <input type="text" placeholder="ค้นหาสินค้า..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
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
                    {(items as any[]).map((item) => (
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
                        <td className="px-3 py-1.5 border border-slate-300">{item.date_in}</td>
                        <td className="px-3 py-1.5 border border-slate-300 text-center text-blue-700 font-medium text-xs">{item.operator_name || '-'}</td>
                        <td className="px-3 py-1.5 border border-slate-300 text-center font-bold text-blue-600">{item.qty?.toLocaleString() || 0}</td>
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
          <span>{filteredData.length} records found (In)</span>
          <span>Logistics & Inventory System • Online</span>
        </div>
      </div>
    </div>
  );
}
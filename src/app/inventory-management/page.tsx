'use client';

import { useState, useEffect } from 'react';
import { Search, Package, History, Edit3, Save, X } from 'lucide-react';

export default function InventoryManagement() {
  const [view, setView] = useState<'balance' | 'in'>('balance');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, [view]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory-management?type=${view}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string) => {
    const table = view === 'in' ? 'stock_in' : 'stock_balance';
    try {
      const res = await fetch('/api/inventory-management', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, new_qty: editValue, table }),
      });
      if (res.ok) {
        setEditingId(null);
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredData = data.filter(item => 
    item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.series?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-800 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Inventory System</h1>
            <p className="text-slate-500">จัดการและตรวจสอบยอดสต็อกสินค้า</p>
          </div>

          {/* View Switcher (Tabs) */}
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-fit">
            <button
              onClick={() => setView('balance')}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all ${view === 'balance' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Package size={18} />
              Stock Balance
            </button>
            <button
              onClick={() => setView('in')}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all ${view === 'in' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <History size={18} />
              Stock In
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="ค้นหาชื่อสินค้า หรือ ซีรีส์..."
            className="w-full pl-12 pr-4 py-3 bg-white rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold uppercase text-xs">
                <th className="p-4 border-b">Series</th>
                <th className="p-4 border-b">Item Name</th>
                <th className="p-4 border-b">Color / Material</th>
                <th className="p-4 border-b">Dimensions (H x W x T)</th>
                {view === 'in' && <th className="p-4 border-b">Date In</th>}
                <th className="p-4 border-b">QTY</th>
                <th className="p-4 border-b text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="p-10 text-center text-slate-400">กำลังโหลดข้อมูล...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={7} className="p-10 text-center text-slate-400">ไม่พบข้อมูลที่ค้นหา</td></tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4">
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                        {item.series || '-'}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-slate-900">{item.item_name}</td>
                    <td className="p-4">
                      <div className="text-sm text-slate-700">{item.color_name || '-'}</div>
                      <div className="text-xs text-slate-400 italic">{item.material || '-'}</div>
                    </td>
                    <td className="p-4 text-sm text-slate-500">
                      {item.height_mm} x {item.width_mm} x {item.thickness_mm} mm
                    </td>
                    {view === 'in' && <td className="p-4 text-sm text-slate-500">{item.date_in}</td>}
                    <td className="p-4">
                      {editingId === item.id ? (
                        <input
                          type="number"
                          className="w-24 p-2 border border-blue-400 rounded-lg outline-none focus:ring-2 focus:ring-blue-200"
                          value={editValue}
                          onChange={(e) => setEditValue(Number(e.target.value))}
                          autoFocus
                        />
                      ) : (
                        <span className={`text-lg font-bold ${item.qty > 10 ? 'text-blue-600' : 'text-orange-500'}`}>
                          {item.qty.toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center">
                        {editingId === item.id ? (
                          <div className="flex gap-2">
                            <button onClick={() => handleUpdate(item.id)} className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 shadow-sm"><Save size={18} /></button>
                            <button onClick={() => setEditingId(null)} className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300"><X size={18} /></button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingId(item.id); setEditValue(item.qty); }}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                          >
                            <Edit3 size={16} />
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';

export default function ManageStockPage() {
  const [stocks, setStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<number>(0);

  // ดึงข้อมูลตอนเปิดหน้าแรก
  useEffect(() => {
    fetchStock();
  }, []);

  const fetchStock = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/manage-stock');
      const json = await res.json();
      if (json.success) {
        setStocks(json.data);
      }
    } catch (error) {
      console.error('Error fetching stock:', error);
    } finally {
      setLoading(false);
    }
  };

  // เริ่มแก้ไข (เก็บ ID และ QTY ปัจจุบัน)
  const handleEditClick = (id: string, currentQty: number) => {
    setEditingId(id);
    setEditQty(currentQty);
  };

  // บันทึกข้อมูลที่แก้ไปที่ API
  const handleSaveClick = async (id: string) => {
    try {
      const res = await fetch('/api/manage-stock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, new_qty: editQty }),
      });
      const json = await res.json();
      
      if (json.success) {
        alert('อัปเดตยอดสต็อกสำเร็จ!');
        setEditingId(null);
        fetchStock(); // ดึงข้อมูลใหม่มาโชว์
      } else {
        alert('เกิดข้อผิดพลาด: ' + json.error);
      }
    } catch (error) {
      console.error('Error updating stock:', error);
    }
  };

  if (loading) return <div className="p-10 text-center text-white">กำลังโหลดข้อมูล...</div>;

  return (
    <div className="p-8 bg-zinc-900 min-h-screen text-white">
      <h1 className="text-2xl font-bold mb-6 text-cyan-400">ตรวจสอบและแก้ไขสต็อกสินค้า (Manage Stock)</h1>
      
      <div className="overflow-x-auto bg-zinc-800 rounded-lg shadow">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-700 text-zinc-300">
              <th className="p-4 border-b border-zinc-600">Series</th>
              <th className="p-4 border-b border-zinc-600">Item Name</th>
              <th className="p-4 border-b border-zinc-600">Color</th>
              <th className="p-4 border-b border-zinc-600">Size (H x W x T)</th>
              <th className="p-4 border-b border-zinc-600">Balance (QTY)</th>
              <th className="p-4 border-b border-zinc-600 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((item) => (
              <tr key={item.id} className="hover:bg-zinc-700/50 border-b border-zinc-700">
                <td className="p-4">{item.series || '-'}</td>
                <td className="p-4 font-semibold text-cyan-300">{item.item_name}</td>
                <td className="p-4">{item.color_name || '-'}</td>
                <td className="p-4 text-zinc-400 text-sm">
                  {item.height_mm || 0} x {item.width_mm || 0} x {item.thickness_mm || 0}
                </td>
                <td className="p-4">
                  {/* ถ้ารหัสตรงกับที่กำลังกด Edit อยู่ ให้โชว์ช่องกรอกตัวเลข */}
                  {editingId === item.id ? (
                    <input
                      type="number"
                      className="w-20 p-2 text-black rounded outline-none"
                      value={editQty}
                      onChange={(e) => setEditQty(Number(e.target.value))}
                    />
                  ) : (
                    <span className="text-xl font-bold text-green-400">{item.qty}</span>
                  )}
                </td>
                <td className="p-4 text-center">
                  {editingId === item.id ? (
                    <div className="flex justify-center gap-2">
                      <button onClick={() => handleSaveClick(item.id)} className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded">Save</button>
                      <button onClick={() => setEditingId(null)} className="px-3 py-1 bg-zinc-500 hover:bg-zinc-600 text-white rounded">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => handleEditClick(item.id, item.qty)} className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition">
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
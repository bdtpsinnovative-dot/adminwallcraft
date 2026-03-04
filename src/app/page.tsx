import { supabase } from '@/lib/supabase';
import { LayoutDashboard, ShoppingCart, Clock, CheckCircle } from 'lucide-react';

export const dynamic = 'force-dynamic'; // ✅ ดึงข้อมูลสดใหม่เสมอ

export default async function DashboardPage() {
  // 1. ดึงจำนวนออเดอร์ทั้งหมด
  const { count: totalOrders } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true });

  // 2. ดึงจำนวนออเดอร์ที่ยังไม่ได้ Sync ลง Google Sheet
  const { count: pendingSync } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('is_synced', false);

  // 3. ดึงรายการล่าสุด 5 รายการมาโชว์
  const { data: recentOrders } = await supabase
    .from('orders')
    .select('customer_name, created_at, phone')
    .order('created_at', { ascending: false })
    .limit(5);

  return (
    <main className="p-8 bg-gray-50 min-h-screen text-gray-800">
      <div className="flex items-center gap-2 mb-8">
        <LayoutDashboard className="text-blue-600" />
        <h1 className="text-2xl font-bold">Admin Portal Dashboard</h1>
      </div>

      {/* สรุปตัวเลข (Stats Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm">ออเดอร์ทั้งหมด</p>
              <h2 className="text-3xl font-bold mt-1">{totalOrders ?? 0}</h2>
            </div>
            <div className="bg-blue-50 p-2 rounded-lg"><ShoppingCart className="text-blue-500" /></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm">รอ Sync (Pending)</p>
              <h2 className="text-3xl font-bold mt-1 text-orange-500">{pendingSync ?? 0}</h2>
            </div>
            <div className="bg-orange-50 p-2 rounded-lg"><Clock className="text-orange-500" /></div>
          </div>
        </div>
      </div>

      {/* ตารางออเดอร์ล่าสุด */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50">
          <h3 className="font-semibold">ออเดอร์ล่าสุด 5 รายการ</h3>
        </div>
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-6 py-3">ชื่อลูกค้า</th>
              <th className="px-6 py-3">เบอร์โทร</th>
              <th className="px-6 py-3">วันที่</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-sm">
            {recentOrders?.map((order, idx) => (
              <tr key={idx} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-medium">{order.customer_name}</td>
                <td className="px-6 py-4 text-gray-500">{order.phone}</td>
                <td className="px-6 py-4 text-gray-400">
                   {new Date(order.created_at).toLocaleDateString('th-TH')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
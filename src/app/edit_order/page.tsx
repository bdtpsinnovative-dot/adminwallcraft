'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// ดึงค่าจาก .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 🚀 ย้าย Component ย่อยออกมาไว้ "ข้างนอก" ฟังก์ชันหลักแล้ว!
// เพื่อป้องกันไม่ให้ React รีเซ็ตช่อง Input ทุกครั้งที่พิมพ์ (แก้บั๊กพิมพ์ได้ตัวเดียวแล้วหลุด)
const EditableCell = ({ value, onChange, onBlur }: any) => (
  <td className="border border-gray-300 p-0 relative">
    <input 
      className="w-full h-full min-w-[140px] px-3 py-2 text-gray-800 outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-500 transition-colors"
      value={value || ''}
      onChange={onChange}
      onBlur={onBlur}
      placeholder="-"
    />
  </td>
);

export default function EditOrderPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [originalOrders, setOriginalOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<string>('');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, created_at, customer_name, phone, is_synced,
        developer_name, designer_name, architect_name, 
        interior_name, home_builder_name, turnkey_th_name, inhouse_designer_name,
        profiles(full_name, teams(team_name)),
        customer_types(name),
        companies(name)
      `)
      .order('created_at', { ascending: false })
      .limit(100); 

    if (error) {
      console.error('Error fetching orders:', error);
    } else {
      setOrders(data || []);
      setOriginalOrders(JSON.parse(JSON.stringify(data || [])));
    }
    setLoading(false);
  };

  // เวลาพิมพ์เปลี่ยนค่า (อัปเดตช่องทันที เคอร์เซอร์ไม่หลุดแล้ว)
  const handleInputChange = (index: number, field: string, value: string) => {
    const newOrders = [...orders];
    newOrders[index][field] = value;
    setOrders(newOrders);
  };

  // บันทึกลงฐานข้อมูลตอนคลิกเมาส์ออก (On Blur)
  const handleInputBlur = async (index: number, field: string) => {
    const currentVal = orders[index][field];
    const originalVal = originalOrders[index][field];

    if (currentVal === originalVal) return; // ถ้าไม่ได้แก้อะไรก็ไม่ต้องเซฟ

    setSavingStatus('กำลังบันทึก...');

    try {
      const { error } = await supabase
        .from('orders')
        .update({
          [field]: currentVal,
          is_synced: false, 
        })
        .eq('id', orders[index].id);

      if (error) throw error;

      const newOrders = [...orders];
      newOrders[index].is_synced = false;
      setOrders(newOrders);

      const newOriginals = [...originalOrders];
      newOriginals[index][field] = currentVal;
      newOriginals[index].is_synced = false;
      setOriginalOrders(newOriginals);

      setSavingStatus('บันทึกสำเร็จ');
      setTimeout(() => setSavingStatus(''), 2000);

    } catch (error: any) {
      alert('เซฟไม่สำเร็จ: ' + error.message);
      setSavingStatus('เกิดข้อผิดพลาด');
    }
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleDateString('th-TH');
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A8A]">ตารางจัดการออเดอร์</h1>
          <p className="text-sm text-gray-500 mt-1">คลิกที่ช่องเพื่อแก้ไขข้อมูล ระบบจะบันทึกอัตโนมัติเมื่อเปลี่ยนช่อง (Spreadsheet Mode)</p>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-blue-600">{savingStatus}</span>
          <button 
            onClick={fetchOrders}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded shadow hover:bg-blue-700 transition"
          >
            รีเฟรชข้อมูล
          </button>
        </div>
      </div>

      <div className="bg-white shadow-sm overflow-x-auto border border-gray-300" style={{ maxHeight: '75vh' }}>
        {loading ? (
          <div className="p-10 text-center text-gray-500 font-medium">กำลังโหลดข้อมูล...</div>
        ) : (
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-gray-100 text-gray-700 font-semibold sticky top-0 z-20 shadow-sm">
              <tr>
                <th className="border border-gray-300 px-4 py-3 whitespace-nowrap bg-gray-100">Date</th>
                <th className="border border-gray-300 px-4 py-3 whitespace-nowrap bg-gray-100">Time</th>
                <th className="border border-gray-300 px-4 py-3 whitespace-nowrap bg-gray-100">Sales Name</th>
                <th className="border border-gray-300 px-4 py-3 whitespace-nowrap bg-gray-100">Team Name</th>
                
                <th className="border border-gray-300 px-4 py-3 whitespace-nowrap bg-[#F0F5FF] text-blue-900">Customer Name</th>
                <th className="border border-gray-300 px-4 py-3 whitespace-nowrap bg-gray-100">Customer Type</th>
                <th className="border border-gray-300 px-4 py-3 whitespace-nowrap bg-[#F0F5FF] text-blue-900">Phone</th>
                <th className="border border-gray-300 px-4 py-3 whitespace-nowrap bg-gray-100">Company</th>
                
                <th className="border border-gray-300 px-4 py-3 whitespace-nowrap bg-[#F0F5FF] text-blue-900">Designer</th>
                <th className="border border-gray-300 px-4 py-3 whitespace-nowrap bg-[#F0F5FF] text-blue-900">Interior</th>
                <th className="border border-gray-300 px-4 py-3 whitespace-nowrap bg-[#F0F5FF] text-blue-900">Developer</th>
                <th className="border border-gray-300 px-4 py-3 whitespace-nowrap bg-[#F0F5FF] text-blue-900">TurnKey-TH</th>
                <th className="border border-gray-300 px-4 py-3 whitespace-nowrap bg-[#F0F5FF] text-blue-900">Inhouse Designer</th>
                <th className="border border-gray-300 px-4 py-3 whitespace-nowrap bg-[#F0F5FF] text-blue-900">Home Builder</th>
                <th className="border border-gray-300 px-4 py-3 whitespace-nowrap bg-[#F0F5FF] text-blue-900">Architect</th>
                
                <th className="border border-gray-300 px-4 py-3 whitespace-nowrap text-center bg-gray-100">สถานะ Sync</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, index) => (
                <tr key={order.id} className="hover:bg-blue-50/30 transition-colors">
                  
                  {/* ข้อมูลที่แก้ไขไม่ได้ (พื้นหลังเทาอ่อนบางๆ) */}
                  <td className="border border-gray-300 px-4 py-2 bg-gray-50/50 whitespace-nowrap text-gray-600">{formatDate(order.created_at)}</td>
                  <td className="border border-gray-300 px-4 py-2 bg-gray-50/50 whitespace-nowrap text-gray-600">{formatTime(order.created_at)}</td>
                  <td className="border border-gray-300 px-4 py-2 bg-gray-50/50 whitespace-nowrap text-gray-600">{order.profiles?.full_name || '-'}</td>
                  <td className="border border-gray-300 px-4 py-2 bg-gray-50/50 whitespace-nowrap text-gray-600">{order.profiles?.teams?.team_name || '-'}</td>

                  {/* ช่องที่แก้ไขได้ */}
                  <EditableCell 
                    value={order.customer_name} 
                    onChange={(e: any) => handleInputChange(index, 'customer_name', e.target.value)}
                    onBlur={() => handleInputBlur(index, 'customer_name')}
                  />

                  <td className="border border-gray-300 px-4 py-2 bg-gray-50/50 whitespace-nowrap text-gray-600">{order.customer_types?.name || '-'}</td>
                  
                  <EditableCell 
                    value={order.phone} 
                    onChange={(e: any) => handleInputChange(index, 'phone', e.target.value)}
                    onBlur={() => handleInputBlur(index, 'phone')}
                  />
                  
                  <td className="border border-gray-300 px-4 py-2 bg-gray-50/50 whitespace-nowrap text-gray-600">{order.companies?.name || '-'}</td>

                  <EditableCell 
                    value={order.designer_name} 
                    onChange={(e: any) => handleInputChange(index, 'designer_name', e.target.value)}
                    onBlur={() => handleInputBlur(index, 'designer_name')}
                  />
                  <EditableCell 
                    value={order.interior_name} 
                    onChange={(e: any) => handleInputChange(index, 'interior_name', e.target.value)}
                    onBlur={() => handleInputBlur(index, 'interior_name')}
                  />
                  <EditableCell 
                    value={order.developer_name} 
                    onChange={(e: any) => handleInputChange(index, 'developer_name', e.target.value)}
                    onBlur={() => handleInputBlur(index, 'developer_name')}
                  />
                  <EditableCell 
                    value={order.turnkey_th_name} 
                    onChange={(e: any) => handleInputChange(index, 'turnkey_th_name', e.target.value)}
                    onBlur={() => handleInputBlur(index, 'turnkey_th_name')}
                  />
                  <EditableCell 
                    value={order.inhouse_designer_name} 
                    onChange={(e: any) => handleInputChange(index, 'inhouse_designer_name', e.target.value)}
                    onBlur={() => handleInputBlur(index, 'inhouse_designer_name')}
                  />
                  <EditableCell 
                    value={order.home_builder_name} 
                    onChange={(e: any) => handleInputChange(index, 'home_builder_name', e.target.value)}
                    onBlur={() => handleInputBlur(index, 'home_builder_name')}
                  />
                  <EditableCell 
                    value={order.architect_name} 
                    onChange={(e: any) => handleInputChange(index, 'architect_name', e.target.value)}
                    onBlur={() => handleInputBlur(index, 'architect_name')}
                  />

                  {/* สถานะ Sync */}
                  <td className="border border-gray-300 px-4 py-2 text-center bg-white">
                    {order.is_synced ? (
                      <span className="px-3 py-1 bg-gray-100 text-gray-500 border border-gray-200 rounded text-xs font-semibold whitespace-nowrap">
                        Synced
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 border border-blue-200 rounded text-xs font-semibold whitespace-nowrap">
                        รอ Sync
                      </span>
                    )}
                  </td>

                </tr>
              ))}
              {orders.length === 0 && !loading && (
                <tr>
                  <td colSpan={16} className="text-center py-8 text-gray-500">ไม่มีข้อมูลออเดอร์</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
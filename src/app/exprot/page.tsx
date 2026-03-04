'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase'; // ตรวจสอบ path ของ supabase client ด้วยนะครับ
import { Download } from 'lucide-react'; // 🌟 import ไอคอนเข้ามาด้วย (ถ้ายังไม่ได้ลง lucide-react ให้ลงก่อนนะครับ)

export default function CompanyList() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompanies = async () => {
      // ดึงข้อมูล Join กันระหว่างตาราง companies และ customer_types
      const { data: companies, error } = await supabase
        .from('companies')
        .select(`
          name,
          customer_types (
            name
          )
        `)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching data:', error);
      } else {
        setData(companies || []);
      }
      setLoading(false);
    };

    fetchCompanies();
  }, []);

  // 🌟 ฟังก์ชันสำหรับ Export CSV
  const exportToCSV = () => {
    if (data.length === 0) return;

    // 1. กำหนดหัวคอลัมน์ (Header)
    const headers = ['ชื่อบริษัท (Company)', 'ประเภท (Type)'];

    // 2. Map ข้อมูลให้อยู่ในรูปแบบ CSV
    // ใช้เครื่องหมาย "" ครอบ Text ไว้กันเหนียว เผื่อชื่อบริษัทมีลูกน้ำ (,)
    const csvRows = data.map((item) => {
      const companyName = item.name ? `"${item.name.replace(/"/g, '""')}"` : '""';
      const typeName = item.customer_types?.name ? `"${item.customer_types.name.replace(/"/g, '""')}"` : '"ไม่ระบุ"';
      return `${companyName},${typeName}`;
    });

    // 3. เอาหัวคอลัมน์มาต่อกับข้อมูล
    const csvContent = [headers.join(','), ...csvRows].join('\n');

    // 4. ใส่ BOM (\uFEFF) นำหน้า เพื่อให้ Excel อ่านภาษาไทยออก 100%
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

    // 5. สร้าง Link และสั่งดาวน์โหลด
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // ตั้งชื่อไฟล์พร้อมวันที่
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `Company_List_${dateStr}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="p-10 text-center">กำลังโหลดข้อมูล 1,700 บริษัท...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      
      {/* 🌟 ปรับส่วน Header ให้มีปุ่ม Export อยู่ขวามือ */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">รายชื่อบริษัทและประเภท (ทั้งหมด {data.length} รายการ)</h1>
        
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-medium transition-all shadow-sm active:scale-95"
        >
          <Download size={18} />
          Export CSV
        </button>
      </div>
      
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 font-bold text-slate-700 w-2/3">ชื่อบริษัท (Company)</th>
              <th className="p-4 font-bold text-slate-700">ประเภท (Type)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((item, index) => (
              <tr key={index} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 text-slate-800">{item.name}</td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    item.customer_types?.name === 'Developer' ? 'bg-blue-100 text-blue-700' :
                    item.customer_types?.name === 'Architect' ? 'bg-purple-100 text-purple-700' :
                    item.customer_types?.name === 'Interior' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {item.customer_types?.name || 'ไม่ระบุ'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
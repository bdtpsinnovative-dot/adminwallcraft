// src/app/admin-logs/page.tsx
import { supabase } from '@/lib/supabase'; // กลับมาใช้ตัวดึงข้อมูลปกติของนาย
import { createClient } from '@supabase/supabase-js';
import { ShieldAlert, Clock, UserCog, User, FileEdit, ArrowRight, Trash2 } from 'lucide-react';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export default async function AdminLogsPage() {
  // 1. ดึงข้อมูล Log ด้วย supabase ปกติ (ไม่ต้องใช้สิทธิ์ Admin ในการอ่าน)
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`id, customer_name, admin_edits, profiles (full_name)`)
    .not('admin_edits', 'is', null)
    .neq('admin_edits', '[]' as any); 

  if (error) {
    console.error('Error fetching logs:', error);
    return <div className="p-8 text-red-500">เกิดข้อผิดพลาดในการดึงข้อมูล Log</div>;
  }

  // 2. แตกข้อมูล (Flatten)
  let allLogs: any[] = [];
  orders?.forEach((order: any) => {
    if (Array.isArray(order.admin_edits)) {
      order.admin_edits.forEach((edit: any) => {
        allLogs.push({
          orderId: order.id,
          customerName: order.customer_name || 'ไม่ระบุชื่อลูกค้า',
          ownerName: order.profiles?.full_name || 'ไม่ระบุเซลส์', 
          editorName: edit.editor_name || 'แอดมิน',      
          editedAtIso: edit.edited_at, 
          editedAt: new Date(edit.edited_at),
          details: edit.details || 'แก้ไขข้อมูล'
        });
      });
    }
  });

  // 3. เรียงลำดับจากล่าสุดไปเก่าสุด
  allLogs.sort((a, b) => b.editedAt.getTime() - a.editedAt.getTime());

  // 🌟 ฟังก์ชัน Server Action สำหรับลบ Log (ทำงานฝั่ง Server ทันทีที่กดปุ่ม)
  async function deleteLogEntry(formData: FormData) {
    'use server';
    const targetOrderId = formData.get('orderId') as string;
    const targetEditedAt = formData.get('editedAtIso') as string;

    if (!targetOrderId || !targetEditedAt) return;

    // ✨ ย้ายการสร้างพลังพระเจ้า (Admin) เข้ามาหลบในฟังก์ชันนี้! 
    // รับรองว่าไม่เกิด Error Module Evaluation อีกต่อไป
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // ไปดึง Log เดิมของ Order นี้มาก่อน
    const { data } = await supabaseAdmin.from('orders').select('admin_edits').eq('id', targetOrderId).single();
    if (data && Array.isArray(data.admin_edits)) {
      // คัดกรองเอาตัวที่เรากดลบ "ออกไป"
      const newEdits = data.admin_edits.filter((e: any) => e.edited_at !== targetEditedAt);
      
      // อัปเดตกลับเข้า Database
      await supabaseAdmin.from('orders').update({ admin_edits: newEdits }).eq('id', targetOrderId);
      
      // สั่งให้ Next.js โหลดหน้าต่างนี้ใหม่ทันที (ไม่ต้องกด F5)
      revalidatePath('/admin-logs');
    }
  }

  return (
    <main className="p-4 md:p-8 bg-slate-50 min-h-screen text-slate-800 font-sans">
      
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 text-rose-600 mb-2">
          <ShieldAlert size={32} className="stroke-[2.5]" />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800">
            System Audit Logs
          </h1>
          <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider ml-2 shadow-sm border border-rose-200">
            Admin Tracking
          </span>
        </div>
        <p className="text-slate-500 text-sm flex items-center gap-1.5">
          <Clock size={14} /> บันทึกประวัติการเปลี่ยนแปลงข้อมูลของเซลส์โดยผู้ดูแลระบบ
        </p>
      </div>

      {/* Summary Card */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 mb-6 flex items-center gap-4">
        <div className="p-3 bg-rose-50 text-rose-600 rounded-full">
          <FileEdit size={24} />
        </div>
        <div>
          <p className="text-slate-500 text-sm font-medium">ประวัติการแก้ไขทั้งหมด</p>
          <p className="text-2xl font-bold text-slate-800">{allLogs.length} <span className="text-sm font-normal text-slate-500">รายการ</span></p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">วัน/เวลา ที่แก้ไข</th>
                <th className="px-6 py-4 whitespace-nowrap">การกระทำ (Action)</th>
                <th className="px-6 py-4 whitespace-nowrap">ชื่อลูกค้า / ออเดอร์</th>
                <th className="px-6 py-4">รายละเอียดการเปลี่ยนแปลง</th>
                <th className="px-6 py-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-500">
                    <ShieldAlert size={32} className="mx-auto mb-3 text-slate-300" />
                    ยังไม่มีประวัติการแก้ไขข้อมูลจากแอดมิน
                  </td>
                </tr>
              ) : (
                allLogs.map((log, index) => (
                  <tr key={index} className="hover:bg-slate-50 transition-colors">
                    
                    {/* เวลา */}
                    <td className="px-6 py-4 whitespace-nowrap align-top">
                      <div className="text-slate-800 font-medium">
                        {log.editedAt.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                      <div className="text-slate-400 text-xs mt-0.5">
                        {log.editedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                      </div>
                    </td>

                    {/* ใครแก้ของใคร */}
                    <td className="px-6 py-4 whitespace-nowrap align-top">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 text-rose-600 font-semibold bg-rose-50 px-2 py-1 rounded border border-rose-100">
                          <UserCog size={14} />
                          {log.editorName}
                        </div>
                        <ArrowRight size={14} className="text-slate-400" />
                        <div className="flex items-center gap-1.5 text-indigo-600 font-medium bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                          <User size={14} />
                          {log.ownerName}
                        </div>
                      </div>
                    </td>

                    {/* ออเดอร์ไหน */}
                    <td className="px-6 py-4 whitespace-nowrap align-top">
                      <div className="text-slate-700 font-bold">
                        {log.customerName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-1 bg-slate-100 inline-block px-1.5 py-0.5 rounded" title={log.orderId}>
                        ID: {log.orderId.substring(0, 8)}...
                      </div>
                    </td>

                    {/* ✨ รายละเอียด (สับเป็นข้อๆ) */}
                    <td className="px-6 py-4 align-top">
                      <ul className="space-y-1.5">
                        {log.details.replace('แก้ไข: ', '').split(', ').map((detailItem: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-slate-600">
                            <span className="text-rose-400 mt-1.5 h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0"></span>
                            <span className="leading-snug">{detailItem}</span>
                          </li>
                        ))}
                      </ul>
                    </td>

                    {/* 🗑️ ปุ่มลบ */}
                    <td className="px-6 py-4 align-top text-center">
                      <form action={deleteLogEntry}>
                        <input type="hidden" name="orderId" value={log.orderId} />
                        <input type="hidden" name="editedAtIso" value={log.editedAtIso} />
                        <button 
                          type="submit"
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="ลบประวัตินี้"
                        >
                          <Trash2 size={18} />
                        </button>
                      </form>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
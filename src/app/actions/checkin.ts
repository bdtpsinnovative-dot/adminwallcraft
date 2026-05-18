'use server';

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function updateCheckInData(
  orderItemId: string,
  projectId: string,
  categoryId: string,
  areaSqm: number,
  userId: string // รับมาเพื่อใช้ revalidate หน้าของ user คนนี้
) {
  try {
    // 1. อัปเดต หมวดหมู่สินค้า (product_category_id) ในตาราง order_items
    const { error: itemError } = await supabase
      .from('order_items')
      .update({ product_category_id: categoryId || null })
      .eq('id', orderItemId);

    if (itemError) throw new Error(`อัปเดต Category ไม่สำเร็จ: ${itemError.message}`);

    // 2. อัปเดต พื้นที่ (area_sqm) ในตาราง order_item_projects
    const { error: projectError } = await supabase
      .from('order_item_projects')
      .update({ area_sqm: areaSqm })
      .eq('id', projectId);

    if (projectError) throw new Error(`อัปเดต Area ไม่สำเร็จ: ${projectError.message}`);

    // รีเฟรชหน้าเว็บเพื่อให้ข้อมูลใหม่แสดงผล
    revalidatePath(`/users/${userId}/history`); // เปลี่ยน path ให้ตรงกับ URL ของนาย
    
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
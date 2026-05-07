import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

// Helper Function สำหรับดึงข้อมูลทั้งหมดโดยไม่ติด Limit 1000 แถว
async function fetchAllData(tableName: string) {
  let allData: any[] = [];
  let from = 0;
  let to = 999;
  const PAGE_SIZE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, to)
      .order('created_at', { ascending: true }); // แนะนำให้ Order ไว้เพื่อให้ข้อมูลไม่สลับกัน

    if (error) {
      console.error(`Error fetching ${tableName}:`, error);
      break;
    }

    if (data && data.length > 0) {
      allData = [...allData, ...data];
    }

    // ถ้าข้อมูลที่ดึงมาได้น้อยกว่า Page Size แสดงว่าหมดตารางแล้ว
    if (!data || data.length < PAGE_SIZE) {
      break;
    }

    // ขยับ Range ไปหน้าถัดไป
    from += PAGE_SIZE;
    to += PAGE_SIZE;
  }

  return allData;
}

export async function GET() {
  try {
   const tables = [
  // กลุ่ม Order
  'orders', 'order_items', 'order_item_projects', 
  // กลุ่ม Product (เพิ่ม product_list_summary เข้ามาให้แล้วครับครบ 24)
  'products', 'product_variants', 'product_categories', 'product_knowledge', 'product_list_summary',
  // กลุ่ม Stock
  'stock_inbound', 'stock_outbound', 'stock_balance', 'stock_purposes',
  // กลุ่ม Project
  'projects', 'project_types', 'project_orders',
  // กลุ่ม Profile & Company
  'profiles', 'teams', 'companies', 'customer_types',
  // กลุ่ม Summary
  'summary_daily', 'summary_weekly', 'summary_monthly',
  // กลุ่มอื่นๆ
  'notifications', 'chat_history'
];

    const workbook = XLSX.utils.book_new();

    // เปลี่ยนมาใช้ fetchAllData แทนการ select แบบเดิม
    const fetchPromises = tables.map(async (tableName) => {
      const data = await fetchAllData(tableName);
      return { tableName, data };
    });

    const results = await Promise.all(fetchPromises);

    results.forEach(({ tableName, data }) => {
      const worksheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, tableName.substring(0, 31));
    });

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `database_backup_full_${dateStr}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });

  } catch (error) {
    console.error('Backup API Error:', error);
    return NextResponse.json({ error: 'Failed to backup database' }, { status: 500 });
  }
}
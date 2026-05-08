import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 📌 ดึงข้อมูลสต็อกปัจจุบัน
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('stock_balance')
      .select('*')
      .order('last_updated', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 📌 อัปเดตยอดสต็อก (และบันทึกเวลาอัปเดต)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, new_qty } = body;

    if (!id || new_qty === undefined) {
      return NextResponse.json({ success: false, error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
    }

    const { error } = await supabase
      .from('stock_balance')
      .update({ 
        qty: new_qty, 
        last_updated: new Date().toISOString() 
      })
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true, message: 'อัปเดตสต็อกเรียบร้อยแล้ว' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
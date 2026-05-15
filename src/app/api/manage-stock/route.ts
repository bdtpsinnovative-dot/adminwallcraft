import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // รับค่า 'balance', 'in', หรือ 'out'

  try {
    let tableName = 'stock_balance';
    let orderBy = 'last_updated';

    // เช็คเงื่อนไขว่าเป็นตารางไหน
    if (type === 'in') {
      tableName = 'stock_in';
      orderBy = 'date_in';
    } else if (type === 'out') {
      tableName = 'stock_out';
      orderBy = 'date_out'; // เรียงตามวันที่ออก
    }

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order(orderBy, { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, new_qty, table } = body; 

    const { error } = await supabase
      .from(table)
      .update({ qty: new_qty })
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
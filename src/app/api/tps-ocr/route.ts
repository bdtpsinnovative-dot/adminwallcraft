// src/app/api/tps-ocr/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// เช็คค่าจาก env ตรงๆ เพื่อความชัวร์ในฝั่ง Server
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { batchDate, batchCode, records } = body;

    // ตรวจสอบว่ามีข้อมูลส่งมาจากหน้าบ้านไหม
    if (!records || records.length === 0) {
      return NextResponse.json(
        { success: false, error: "ไม่พบข้อมูลพัสดุที่ส่งมาบันทึกครับนาย" }, 
        { status: 400 }
      );
    }

    // 1. บันทึกตารางหลัก (Batch)
    const { data: batchData, error: batchError } = await supabase
      .from('tps_batches')
      .insert([{ 
        batch_date: batchDate, 
        batch_code: batchCode || "-" // ถ้านายไม่ได้กรอกรหัสรอบบิล จะใส่ "-" แทนเพื่อไม่ให้ DB พัง
      }])
      .select('id')
      .single();

    if (batchError) throw batchError;

    // 2. เตรียมข้อมูลสำหรับตารางย่อย (tps_records)
    const recordsToInsert = records.map((record: any) => ({
      batch_id: batchData.id,
      ref_code: record.refCode,
      jk_code: record.jkCode,
      ctn: parseInt(record.ctn) || 0,
      tracking_number: record.tracking === "-" ? null : record.tracking,
      status: record.status || "in_transit"
    }));

    // 3. บันทึกตารางย่อย
    const { error: recordsError } = await supabase
      .from('tps_records')
      .insert(recordsToInsert);

    if (recordsError) throw recordsError;

    // ส่ง JSON สำเร็จกลับไปให้หน้าบ้าน
    return NextResponse.json({ 
      success: true, 
      message: "บันทึกข้อมูลเรียบร้อยแล้วครับนาย",
      batchId: batchData.id
    }, { status: 200 });

  } catch (error: any) {
    console.error("API Error at tps-ocr:", error);
    // บังคับส่งกลับเป็น JSON เสมอ แม้หลังบ้านจะพัง เพื่อไม่ให้หน้าบ้านพ่น SyntaxError ครับ
    return NextResponse.json(
      { success: false, error: error.message || "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, 
      { status: 500 }
    );
  }
}
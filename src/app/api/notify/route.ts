// src/app/api/notify/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // 1. รับข้อมูลมาจากหน้า Modal ของเรา
    const body = await req.json();

    // 2. ยิงแบบ Server-to-Server ข้ามไปหาเว็บหลัก (ไม่ติด CORS แน่นอน)
    const response = await fetch('https://www.wallcraftthailand.com/api/v1/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // 3. ส่งผลลัพธ์กลับไปให้หน้าเว็บ
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error: any) {
    console.error('Notify Proxy Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

// ดึง Key จาก .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const { message, context } = await req.json();

    // ใช้โมเดล gemini-1.5-flash ที่เน้นความรวดเร็วและวิเคราะห์ข้อความได้ดี
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 
    
    const prompt = `
    คุณคือ "AI Data Analyst" ประจำ Dashboard ผู้บริหารระดับสูง (God Mode)
    หน้าที่ของคุณคือวิเคราะห์ข้อมูลและตอบคำถามผู้บริหารอย่างฉลาด เฉียบขาด และใช้ภาษาเชิงธุรกิจแบบมืออาชีพ
    
    นี่คือบริบทข้อมูล (Data Context) ของ Dashboard ในปัจจุบัน:
    ${context}
    
    คำถามจากผู้บริหาร: "${message}"
    
    เงื่อนไขการตอบ:
    1. ตอบให้ตรงคำถาม กระชับ ไม่ยืดเยื้อ
    2. อ้างอิงตัวเลขจากข้อมูลที่ให้ไปเท่านั้น ห้ามแต่งตัวเลขเอง
    3. ถ้าผู้บริหารขอให้วิเคราะห์ ให้วิเคราะห์แนวโน้มจากข้อมูลที่มี
    4. จัดหน้าให้อ่านง่าย มีการขึ้นบรรทัดใหม่ หรือใช้ Bullet points
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ reply: text });
  } catch (error) {
    console.error("Gemini API Error:", error);
    return NextResponse.json({ error: "ระบบ AI ขัดข้อง กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
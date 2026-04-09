import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const S3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// POST — แทนที่ PDF เดิมด้วยไฟล์ใหม่ (slug เดิม)
export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const file = data.get('file') as File | null;
    const slug = (data.get('slug') as string | null)?.trim();

    if (!file) return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 400 });
    if (!slug) return NextResponse.json({ error: 'ไม่พบ slug' }, { status: 400 });

    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await S3.send(new PutObjectCommand({
      Bucket:      process.env.R2_BUCKET_NAME!,
      Key:         `ebook/${slug}.pdf`,
      Body:        buffer,
      ContentType: 'application/pdf',
    }));

    return NextResponse.json({ success: true, slug });
  } catch (error) {
    console.error('Replace catalog error:', error);
    return NextResponse.json({ error: 'แทนที่ไฟล์ไม่สำเร็จ' }, { status: 500 });
  }
}

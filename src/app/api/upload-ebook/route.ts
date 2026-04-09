import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const S3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const file = data.get('file') as File | null;
    const name = (data.get('name') as string | null)?.trim();

    if (!file) return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 400 });

    // slug = timestamp + ชื่อไฟล์ (เหมือนชื่อไฟล์ใน R2 แต่ไม่มี .pdf)
    const cleanName = file.name.replace(/\s+/g, '-').replace(/\.pdf$/i, '');
    const slug = `${Date.now()}-${cleanName}`;
    const key  = `ebook/${slug}.pdf`;

    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await S3.send(new PutObjectCommand({
      Bucket:      process.env.R2_BUCKET_NAME!,
      Key:         key,
      Body:        buffer,
      ContentType: 'application/pdf',
    }));

    const publicUrl  = `${process.env.R2_PUBLIC_URL}/${key}`;
    const shareLink  = `/catalog/${slug}`;

    return NextResponse.json({ success: true, url: publicUrl, slug, shareLink });

  } catch (error) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: 'อัปโหลดไม่สำเร็จ' }, { status: 500 });
  }
}

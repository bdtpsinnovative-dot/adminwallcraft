import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const S3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  requestChecksumCalculation: 'when_required',
  responseChecksumValidation: 'when_required',
});

export async function POST(request: NextRequest) {
  try {
    const { fileName, folder = 'original' } = await request.json();
    if (!fileName) return NextResponse.json({ error: 'ไม่พบชื่อไฟล์' }, { status: 400 });

    const key = `${folder}/${fileName}`;
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      ContentType: 'image/webp',
    });

    const presignedUrl = await getSignedUrl(S3, command, { expiresIn: 600 });
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

    return NextResponse.json({ success: true, presignedUrl, publicUrl });
  } catch (error) {
    console.error('Presign Image Error:', error);
    return NextResponse.json({ error: 'สร้าง URL ไม่สำเร็จ' }, { status: 500 });
  }
}

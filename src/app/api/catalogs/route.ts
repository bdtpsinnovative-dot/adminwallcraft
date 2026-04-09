import { NextRequest, NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';

const S3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// GET — list all catalogs
export async function GET() {
  try {
    const res = await S3.send(new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME!,
      Prefix: 'ebook/',
    }));

    const items = (res.Contents ?? [])
      .filter(obj => obj.Key?.endsWith('.pdf'))
      .map(obj => {
        const key      = obj.Key!;                          // ebook/slug.pdf
        const slug     = key.replace('ebook/', '').replace('.pdf', '');
        const fileName = slug.replace(/^\d+-/, '');        // ตัด timestamp ออก → ชื่อไฟล์เดิม
        return {
          slug,
          fileName,
          key,
          size:         obj.Size ?? 0,
          lastModified: obj.LastModified?.toISOString() ?? '',
        };
      })
      .sort((a, b) => b.lastModified.localeCompare(a.lastModified)); // ใหม่สุดก่อน

    return NextResponse.json({ success: true, items });
  } catch (err) {
    console.error('List catalogs error:', err);
    return NextResponse.json({ error: 'ดึงรายการไม่สำเร็จ' }, { status: 500 });
  }
}

// DELETE — ลบ catalog
export async function DELETE(req: NextRequest) {
  const { slug } = await req.json();
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

  try {
    await S3.send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key:    `ebook/${slug}.pdf`,
    }));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete catalog error:', err);
    return NextResponse.json({ error: 'ลบไม่สำเร็จ' }, { status: 500 });
  }
}

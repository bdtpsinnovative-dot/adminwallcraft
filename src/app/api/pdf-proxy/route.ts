import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  const url  = req.nextUrl.searchParams.get('url')

  // รับได้ทั้ง ?slug=xxx และ ?url=xxx
  const targetUrl = slug
    ? `${process.env.R2_PUBLIC_URL}/ebook/${slug}.pdf`
    : url

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing slug or url param' }, { status: 400 })
  }

  try {
    // 1. ดึง conditional headers จาก client เพื่อส่งต่อให้ Cloudflare R2
    const ifNoneMatch = req.headers.get('if-none-match');
    const ifModifiedSince = req.headers.get('if-modified-since');

    const fetchHeaders: HeadersInit = {};
    if (ifNoneMatch) fetchHeaders['If-None-Match'] = ifNoneMatch;
    if (ifModifiedSince) fetchHeaders['If-Modified-Since'] = ifModifiedSince;

    // 2. ยิงขอไฟล์จาก R2 พร้อม conditional headers
    const res = await fetch(targetUrl, {
      headers: fetchHeaders,
      cache: 'no-store',
    });

    // 3. ถ้า R2 ตอบ 304 Not Modified (ไฟล์เดิมยังไม่ถูก replace)
    if (res.status === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
          'ETag': res.headers.get('etag') || ifNoneMatch || '',
          'Last-Modified': res.headers.get('last-modified') || ifModifiedSince || '',
        },
      });
    }

    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch PDF (${res.status})` }, { status: res.status });
    }

    // 4. ถ้าดึงไฟล์สำเร็จ (เปิดครั้งแรก หรือไฟล์เพิ่งถูก Replace ใน /ebook)
    const etag = res.headers.get('etag');
    const lastModified = res.headers.get('last-modified');
    const contentLength = res.headers.get('content-length');

    const headers: HeadersInit = {
      'Content-Type': 'application/pdf',
      'Access-Control-Allow-Origin': '*',
      // แคชที่ Browser 1 ชม., แคชที่ CDN/Edge 1 วัน พร้อม auto-revalidate ผ่าน ETag
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
    };
    if (etag) headers['ETag'] = etag;
    if (lastModified) headers['Last-Modified'] = lastModified;
    if (contentLength) headers['Content-Length'] = contentLength;

    // Stream โดยตรง ไม่โหลด buffer 20MB-50MB ทั้งก้อนลง RAM
    return new NextResponse(res.body, {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error('PDF Proxy Error:', err);
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server'

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
    const res = await fetch(targetUrl, { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch PDF (${res.status})` }, { status: res.status })
    }

    const buffer = await res.arrayBuffer()
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (err) {
    console.error('PDF Proxy Error:', err)
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 })
  }
}

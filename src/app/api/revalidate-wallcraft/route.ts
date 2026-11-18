import { NextResponse } from 'next/server';
import { getAdminContext } from '@/lib/admin-api-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_WALLCRAFT_WEB_URL = 'https://www.wallcraftthailand.com';

export async function POST(request: Request) {
  const auth = await getAdminContext(request);
  if (auth.error) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    );
  }

  const secret = process.env.REVALIDATE_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      {
        success: false,
        error: 'ยังไม่ได้ตั้งค่า REVALIDATE_SECRET ใน Environment Variables ของฝั่ง Admin',
      },
      { status: 500 }
    );
  }

  let payload: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      payload = JSON.parse(text) as Record<string, unknown>;
    }
  } catch {
    payload = {};
  }

  const rawTargets = process.env.WALLCRAFT_WEB_URL?.trim() || DEFAULT_WALLCRAFT_WEB_URL;
  const targets = rawTargets
    .split(',')
    .map((u) => u.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  if (targets.length === 0) {
    return NextResponse.json(
      { success: false, error: 'WALLCRAFT_WEB_URL ไม่ถูกต้อง' },
      { status: 500 }
    );
  }

  const results = await Promise.all(
    targets.map(async (baseUrl) => {
      const endpoint = `${baseUrl}/api/revalidate`;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-revalidate-secret': secret,
          },
          body: JSON.stringify({
            productId: payload.productId,
            productIds: payload.productIds,
            collection: payload.collection,
            collections: payload.collections,
            reason: payload.reason || 'admin-product-update',
          }),
          cache: 'no-store',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await res.json().catch(() => ({}));
        return {
          target: baseUrl,
          ok: res.ok,
          status: res.status,
          data,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Network error';
        return {
          target: baseUrl,
          ok: false,
          status: 502,
          error: message,
        };
      }
    })
  );

  const allOk = results.every((r) => r.ok);
  return NextResponse.json(
    {
      success: allOk,
      revalidatedAt: new Date().toISOString(),
      results,
      error: allOk
        ? undefined
        : results
            .filter((r) => !r.ok)
            .map((r) => `${r.target}: ${r.error || (r.data as { error?: string })?.error || `HTTP ${r.status}`}`)
            .join(' | '),
    },
    {
      status: allOk ? 200 : 502,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}

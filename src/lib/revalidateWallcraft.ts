import { supabase } from '@/lib/supabase';

export interface RevalidateWallcraftOptions {
  productId?: string | number;
  productIds?: Array<string | number>;
  collection?: string | null;
  collections?: string[];
  reason?: string;
}

export interface RevalidateWallcraftResult {
  ok: boolean;
  message: string;
}

export async function revalidateWallcraftCache(
  options: RevalidateWallcraftOptions = {}
): Promise<RevalidateWallcraftResult> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    const res = await fetch('/api/revalidate-wallcraft', {
      method: 'POST',
      headers,
      body: JSON.stringify(options),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      return {
        ok: false,
        message: data?.error || `ล้างแคชหน้าเว็บไม่สำเร็จ (HTTP ${res.status})`,
      };
    }

    const firstTarget = Array.isArray(data?.results) ? data.results[0] : null;
    const cfStatus = firstTarget?.data?.cloudflare;

    if (cfStatus?.purged) {
      return {
        ok: true,
        message: 'ล้างแคช Vercel + Cloudflare เรียบร้อยแล้ว',
      };
    }
    if (cfStatus && !cfStatus.skipped && cfStatus.error) {
      return {
        ok: false,
        message: `ล้างแคช Vercel แล้ว แต่ Cloudflare ไม่สำเร็จ: ${cfStatus.error}`,
      };
    }

    return {
      ok: true,
      message: 'ล้างแคชหน้าเว็บ Wallcraft (Vercel) เรียบร้อยแล้ว',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network error';
    return {
      ok: false,
      message: `เชื่อมต่อระบบล้างแคชไม่สำเร็จ: ${msg}`,
    };
  }
}

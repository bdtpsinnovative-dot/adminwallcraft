import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_SETTINGS = {
  id: 'wallcraft_mobile',
  latest_version_android: '2.2.0',
  download_url_android: 'https://app.wallcraftthailand.com/app-release.apk',
  force_update_android: false,
  latest_version_ios: '2.0.7',
  download_url_ios: 'https://testflight.apple.com/join/BXMvdwVM',
  force_update_ios: false,
  release_date: '2026-11-12',
  change_log: 'เพิ่มระบบบันทึกประวัติการโทรทุกเบอร์อัตโนมัติ, ขอสิทธิ์ Caller ID ตั้งแต่เปิดแอป, ย้ายสมุดเบอร์ไว้ในตั้งค่าบัญชี และปรับ UI โทนเข้มเรียบหรู',
  updated_at: null as string | null,
};

function isMissingRelationError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('could not find the table') ||
    msg.includes('does not exist')
  );
}

function parseVersionParts(raw: string): number[] {
  const cleaned = String(raw || '')
    .trim()
    .replace(/^v/i, '')
    .split('+')[0]
    .split('-')[0];
  if (!cleaned) return [0];
  return cleaned.split('.').map((part) => {
    const match = part.match(/\d+/);
    return match ? Number.parseInt(match[0], 10) : 0;
  });
}

function compareVersions(currentVersion: string, latestVersion: string): number {
  const a = parseVersionParts(currentVersion);
  const b = parseVersionParts(latestVersion);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function getAdminContext(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      error: 'ระบบยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY บนเซิร์ฟเวอร์',
      status: 503,
    };
  }

  const authorization = request.headers.get('authorization');
  const cookieToken = request.cookies.get('admin_token')?.value;
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : cookieToken
      ? decodeURIComponent(cookieToken)
      : null;

  if (!token) {
    return { error: 'ไม่พบเซสชันผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่', status: 401 };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error: authErr,
  } = await supabaseAdmin.auth.getUser(token);

  if (authErr || !user) {
    return { error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', status: 401 };
  }

  const { data: requesterProfile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (requesterProfile?.role !== 'admin') {
    return {
      error: 'เฉพาะผู้ดูแลระบบ (admin) เท่านั้นที่เข้าถึงหน้านี้ได้',
      status: 403,
    };
  }

  return { supabaseAdmin, user };
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAdminContext(request);
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const missingTables: string[] = [];

    const [settingsRes, devicesRes, profilesRes, teamsRes, ordersRes] = await Promise.all([
      ctx.supabaseAdmin
        .from('app_release_settings')
        .select('*')
        .eq('id', 'wallcraft_mobile')
        .maybeSingle(),
      ctx.supabaseAdmin
        .from('user_app_devices')
        .select('*')
        .order('last_seen_at', { ascending: false }),
      ctx.supabaseAdmin
        .from('profiles')
        .select('id, full_name, email, role, team_id, fcm_tokens, updated_at')
        .order('full_name', { ascending: true }),
      ctx.supabaseAdmin.from('teams').select('id, team_name'),
      ctx.supabaseAdmin
        .from('orders')
        .select('user_id, audit_log, created_at')
        .not('audit_log', 'is', null)
        .order('created_at', { ascending: false })
        .limit(600),
    ]);

    if (isMissingRelationError(settingsRes.error)) {
      missingTables.push('app_release_settings');
    } else if (settingsRes.error) {
      throw settingsRes.error;
    }

    if (isMissingRelationError(devicesRes.error)) {
      missingTables.push('user_app_devices');
    } else if (devicesRes.error) {
      throw devicesRes.error;
    }

    if (profilesRes.error) throw profilesRes.error;
    if (teamsRes.error) throw teamsRes.error;

    const settings = settingsRes.data
      ? {
          id: settingsRes.data.id || 'wallcraft_mobile',
          latest_version_android:
            settingsRes.data.latest_version_android ||
            DEFAULT_SETTINGS.latest_version_android,
          download_url_android:
            settingsRes.data.download_url_android ||
            DEFAULT_SETTINGS.download_url_android,
          force_update_android: Boolean(settingsRes.data.force_update_android),
          latest_version_ios:
            settingsRes.data.latest_version_ios ||
            DEFAULT_SETTINGS.latest_version_ios,
          download_url_ios:
            settingsRes.data.download_url_ios || DEFAULT_SETTINGS.download_url_ios,
          force_update_ios: Boolean(settingsRes.data.force_update_ios),
          release_date:
            settingsRes.data.release_date || DEFAULT_SETTINGS.release_date,
          change_log: settingsRes.data.change_log ?? DEFAULT_SETTINGS.change_log,
          updated_at: settingsRes.data.updated_at || null,
        }
      : DEFAULT_SETTINGS;

    const teamMap = new Map<string, string>();
    for (const t of teamsRes.data || []) {
      teamMap.set(String(t.id), String(t.team_name || ''));
    }

    const devicesByUser = new Map<string, any[]>();
    for (const row of devicesRes.data || []) {
      const uid = String(row.user_id || '');
      if (!uid) continue;
      const platform = String(row.platform || 'other').toLowerCase();
      const targetLatest =
        platform === 'ios'
          ? settings.latest_version_ios
          : settings.latest_version_android;
      const cmp = compareVersions(String(row.app_version || ''), targetLatest);
      const list = devicesByUser.get(uid) || [];
      list.push({
        id: row.id,
        device_key: row.device_key,
        platform,
        app_version: row.app_version,
        build_number: row.build_number,
        device_brand: row.device_brand || '',
        device_model: row.device_model || '',
        os_version: row.os_version || '',
        last_seen_at: row.last_seen_at,
        status: cmp < 0 ? 'outdated' : 'up_to_date',
      });
      devicesByUser.set(uid, list);
    }

    const latestOrderDeviceByUser = new Map<string, any>();
    for (const order of ordersRes.data || []) {
      const uid = String(order.user_id || '');
      if (!uid || latestOrderDeviceByUser.has(uid)) continue;
      const dev = (order.audit_log as any)?.device;
      if (dev && typeof dev === 'object') {
        latestOrderDeviceByUser.set(uid, {
          platform: String(dev.os || '').toLowerCase() === 'ios' ? 'ios' : 'android',
          device_brand: String(dev.brand || ''),
          device_model: String(dev.model || ''),
          os_version: String(dev.version || ''),
          last_seen_at: order.created_at || null,
        });
      }
    }

    const employees = (profilesRes.data || []).map((profile: any) => {
      const uid = String(profile.id);
      const devices = devicesByUser.get(uid) || [];

      const legacyDevices: any[] = [];
      if (devices.length === 0) {
        const orderHint = latestOrderDeviceByUser.get(uid);
        if (orderHint) {
          legacyDevices.push({ ...orderHint, source: 'order_audit' });
        } else if (Array.isArray(profile.fcm_tokens) && profile.fcm_tokens.length > 0) {
          const seenPlatforms = new Set<string>();
          for (const item of profile.fcm_tokens) {
            if (item && typeof item === 'object') {
              const plat = String(item.device || item.device_type || '').toLowerCase();
              const normalizedPlat = plat === 'ios' ? 'ios' : plat === 'android' ? 'android' : 'unknown';
              if (seenPlatforms.has(normalizedPlat)) continue;
              seenPlatforms.add(normalizedPlat);
              legacyDevices.push({
                platform: normalizedPlat,
                device_brand: '',
                device_model: '',
                os_version: '',
                last_seen_at: item.last_seen || null,
                source: 'fcm_token',
              });
            }
          }
        }
      }

      let summaryStatus: 'up_to_date' | 'outdated' | 'legacy_untracked' = 'legacy_untracked';
      if (devices.length > 0) {
        summaryStatus = devices.every((d) => d.status === 'up_to_date')
          ? 'up_to_date'
          : 'outdated';
      }

      return {
        id: uid,
        full_name: profile.full_name || 'ไม่ระบุชื่อ',
        email: profile.email || '',
        role: profile.role || 'user',
        team_name: profile.team_id ? teamMap.get(String(profile.team_id)) || null : null,
        devices,
        legacyDevices,
        summaryStatus,
      };
    });

    return NextResponse.json({
      ok: true,
      migrationRequired: missingTables.length > 0,
      missingTables,
      settings,
      employees,
    });
  } catch (error: any) {
    console.error('[api/app-updates GET] error:', error);
    return NextResponse.json(
      { error: error?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ctx = await getAdminContext(request);
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const body = await request.json();
    const latestVersionAndroid = String(body?.latest_version_android || '').trim();
    const downloadUrlAndroid = String(body?.download_url_android || '').trim();
    const forceUpdateAndroid = Boolean(body?.force_update_android);
    const latestVersionIos = String(body?.latest_version_ios || '').trim();
    const downloadUrlIos = String(body?.download_url_ios || '').trim();
    const forceUpdateIos = Boolean(body?.force_update_ios);
    const releaseDate =
      String(body?.release_date || '').trim() ||
      new Date().toISOString().slice(0, 10);
    const changeLog = String(body?.change_log || '').trim();

    if (!latestVersionAndroid || !latestVersionIos) {
      return NextResponse.json(
        { error: 'กรุณาระบุเลขเวอร์ชันล่าสุดของทั้ง Android และ iOS' },
        { status: 400 }
      );
    }

    if (!isValidHttpUrl(downloadUrlAndroid) || !isValidHttpUrl(downloadUrlIos)) {
      return NextResponse.json(
        { error: 'กรุณากรอก URL ดาวน์โหลดที่ขึ้นต้นด้วย http:// หรือ https:// ให้ถูกต้อง' },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const { data, error } = await ctx.supabaseAdmin
      .from('app_release_settings')
      .upsert(
        {
          id: 'wallcraft_mobile',
          latest_version_android: latestVersionAndroid,
          download_url_android: downloadUrlAndroid,
          force_update_android: forceUpdateAndroid,
          latest_version_ios: latestVersionIos,
          download_url_ios: downloadUrlIos,
          force_update_ios: forceUpdateIos,
          release_date: releaseDate,
          change_log: changeLog,
          updated_by: ctx.user.id,
          updated_at: nowIso,
        },
        { onConflict: 'id' }
      )
      .select('*')
      .single();

    if (error) {
      if (isMissingRelationError(error)) {
        return NextResponse.json(
          {
            error:
              'ยังไม่ได้สร้างตาราง app_release_settings ใน Supabase กรุณารันสคริปต์ SQL ด้านบนก่อนครับ',
          },
          { status: 400 }
        );
      }
      throw error;
    }

    // Auto-purge /api/v1/check-update cache on Wallcraft (Vercel + Cloudflare)
    let cacheRevalidated = false;
    const revalidateSecret = process.env.REVALIDATE_SECRET?.trim();
    if (revalidateSecret) {
      const targetBase = (
        process.env.WALLCRAFT_WEB_URL?.trim() || 'https://www.wallcraftthailand.com'
      )
        .split(',')[0]
        .trim()
        .replace(/\/+$/, '');
      try {
        const revRes = await fetch(`${targetBase}/api/revalidate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-revalidate-secret': revalidateSecret,
          },
          body: JSON.stringify({ reason: 'app-update-settings' }),
          cache: 'no-store',
        });
        cacheRevalidated = revRes.ok;
      } catch (revErr) {
        console.warn('[api/app-updates PUT] revalidate failed:', revErr);
      }
    }

    return NextResponse.json({ ok: true, settings: data, cacheRevalidated });
  } catch (error: any) {
    console.error('[api/app-updates PUT] error:', error);
    return NextResponse.json(
      { error: error?.message || 'ไม่สามารถบันทึกการตั้งค่าได้' },
      { status: 500 }
    );
  }
}

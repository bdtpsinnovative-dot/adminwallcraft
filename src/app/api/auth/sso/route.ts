import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Singapore Supabase details (Employee Portal)
const SINGAPORE_SUPABASE_URL = process.env.SINGAPORE_SUPABASE_URL || 'https://gshppxgvdrmbfcxsxeph.supabase.co';
const SINGAPORE_SUPABASE_ANON_KEY = process.env.SINGAPORE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzaHBweGd2ZHJtYmZjeHN4ZXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwMjQzODAsImV4cCI6MjEwNzYwMDM4MH0.lhpLOeb7oY0e-ZCIgSBgzHfPAgAzK8eqFgUPg9te8XM';

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.redirect(new URL('/login?error=missing_token', request.url));
    }

    // 1. ตรวจสอบ Token กับ Supabase สิงคโปร์ (Employee Portal)
    const singaporeClient = createClient(SINGAPORE_SUPABASE_URL, SINGAPORE_SUPABASE_ANON_KEY);
    const { data: userData, error: userError } = await singaporeClient.auth.getUser(token);

    if (userError || !userData?.user?.email) {
      console.error('SSO Singapore verify error:', userError?.message);
      return NextResponse.redirect(new URL('/login?error=invalid_portal_session', request.url));
    }

    const email = userData.user.email.toLowerCase().trim();

    // 2. ค้นหาหรือเตรียมบัญชีใน Supabase ของ Wallcraft (exspotdensjbmwzvifpk)
    let { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
    });

    // ถ้าผู้ใช้ยังไม่มีบัญชีใน Wallcraft ให้สร้างบัญชีอัตโนมัติให้ทันที
    if (linkError || !linkData?.properties?.hashed_token) {
      console.log(`User ${email} not found in Wallcraft, auto-provisioning account...`);
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        email_confirm: true,
        user_metadata: userData.user.user_metadata || {},
      });

      if (!createError && newUser?.user) {
        // ลองสร้าง magiclink ใหม่อีกครั้ง
        const retry = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: email,
        });
        linkData = retry.data;
        linkError = retry.error;
      }
    }

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error('SSO generateLink failed:', linkError?.message);
      return NextResponse.redirect(new URL('/login?error=wallcraft_user_not_found', request.url));
    }

    // 3. แลกเปลี่ยน Magic Token เป็น Session ของ Wallcraft (ได้ทั้ง access_token และ refresh_token)
    const wallcraftAnon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: verifyData, error: verifyError } = await wallcraftAnon.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink',
    });

    if (verifyError || !verifyData?.session) {
      console.error('SSO verifyOtp failed:', verifyError?.message);
      return NextResponse.redirect(new URL('/login?error=sso_exchange_failed', request.url));
    }

    const { access_token, refresh_token } = verifyData.session;

    // 4. ส่ง Token ไปยังบริดจ์หน้า /sso เพื่อเซฟเข้า localStorage และเซ็ตคุกกี้ admin_token
    const ssoLandingUrl = new URL('/sso', request.url);
    ssoLandingUrl.searchParams.set('access_token', access_token);
    if (refresh_token) {
      ssoLandingUrl.searchParams.set('refresh_token', refresh_token);
    }

    const response = NextResponse.redirect(ssoLandingUrl);

    // เซ็ตคุกกี้ admin_token เพื่อให้ Server Component และ middleware ผ่านฉลุย
    response.cookies.set('admin_token', access_token, {
      path: '/',
      maxAge: 60 * 60 * 24 * 400, // 400 วัน
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch (err: any) {
    console.error('SSO route exception:', err);
    return NextResponse.redirect(new URL('/login?error=sso_server_error', request.url));
  }
}

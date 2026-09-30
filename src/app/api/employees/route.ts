import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getAdminContext(request: NextRequest) {
  if (!supabaseUrl || !serviceRoleKey) {
    return { error: 'ระบบยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY บนเซิร์ฟเวอร์', status: 503 };
  }

  const authorization = request.headers.get('authorization');
  const cookieToken = request.cookies.get('admin_token')?.value;
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
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
    return { error: 'เฉพาะผู้ดูแลระบบ (admin) เท่านั้นที่สามารถจัดการพนักงานได้', status: 403 };
  }

  return { supabaseAdmin, user };
}

// POST: เพิ่มพนักงานใหม่ (สร้างใน Supabase Auth + บันทึกลงตาราง profiles)
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAdminContext(request);
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const body = await request.json();
    const fullName = (body.full_name || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    const role = body.role === 'admin' ? 'admin' : 'user';
    const teamId = body.team_id ? String(body.team_id).trim() || null : null;

    if (!fullName) {
      return NextResponse.json({ error: 'กรุณาระบุชื่อ-นามสกุลพนักงาน' }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: 'กรุณาระบุอีเมลสำหรับเข้าสู่ระบบ' }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร' }, { status: 400 });
    }

    // 1. สร้าง User ใน Supabase Auth (ยืนยันอีเมลอัตโนมัติ ไม่ส่งเมลกวน และไม่กระทบ Session แอดมิน)
    const { data: createdAuth, error: createAuthErr } = await ctx.supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role,
      },
    });

    if (createAuthErr || !createdAuth?.user) {
      const msg = createAuthErr?.message || 'ไม่สามารถสร้างบัญชีผู้ใช้ได้';
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('exists')) {
        return NextResponse.json({ error: 'อีเมลนี้มีอยู่ในระบบแล้ว กรุณาใช้อีเมลอื่น' }, { status: 400 });
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const newUserId = createdAuth.user.id;

    // 2. Upsert ข้อมูลลงตาราง profiles (รองรับกรณีมี Database Trigger สร้างแถวให้อัตโนมัติอยู่แล้ว)
    const { data: profileData, error: profileErr } = await ctx.supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: newUserId,
          email,
          full_name: fullName,
          role,
          team_id: teamId,
        },
        { onConflict: 'id' }
      )
      .select('id, full_name, email, role, team_id')
      .single();

    if (profileErr) {
      console.error('Error upserting profile:', profileErr);
      return NextResponse.json(
        { error: 'สร้างบัญชีสำเร็จ แต่บันทึกข้อมูลโปรไฟล์ไม่สำเร็จ: ' + profileErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      profile: profileData,
    });
  } catch (err: any) {
    console.error('POST /api/employees error:', err);
    return NextResponse.json({ error: err?.message || 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' }, { status: 500 });
  }
}

// PATCH: อัปเดตข้อมูลพนักงาน (ชื่อ, ทีม, สิทธิ์ user/admin, หรือรีเซ็ตรหัสผ่าน)
export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getAdminContext(request);
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const body = await request.json();
    const userId = (body.id || '').trim();
    if (!userId) {
      return NextResponse.json({ error: 'ไม่พบรหัสพนักงาน (id)' }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (body.full_name !== undefined) {
      const trimmedName = String(body.full_name).trim();
      if (!trimmedName) {
        return NextResponse.json({ error: 'ชื่อ-นามสกุลห้ามว่าง' }, { status: 400 });
      }
      updates.full_name = trimmedName;
    }

    if (body.role !== undefined) {
      if (body.role !== 'user' && body.role !== 'admin') {
        return NextResponse.json({ error: 'สิทธิ์การใช้งานรองรับเฉพาะ user และ admin เท่านั้น' }, { status: 400 });
      }
      updates.role = body.role;
    }

    if (body.team_id !== undefined) {
      updates.team_id = body.team_id ? String(body.team_id).trim() : null;
    }

    // หากมีการตั้งรหัสผ่านใหม่
    if (body.password && String(body.password).trim().length > 0) {
      const newPassword = String(body.password).trim();
      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร' }, { status: 400 });
      }
      const { error: passErr } = await ctx.supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword,
      });
      if (passErr) {
        return NextResponse.json({ error: 'เปลี่ยนรหัสผ่านไม่สำเร็จ: ' + passErr.message }, { status: 400 });
      }
    }

    if (Object.keys(updates).length > 0) {
      const { data: updatedProfile, error: updateErr } = await ctx.supabaseAdmin
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select('id, full_name, email, role, team_id')
        .single();

      if (updateErr) {
        return NextResponse.json({ error: 'อัปเดตข้อมูลไม่สำเร็จ: ' + updateErr.message }, { status: 400 });
      }

      return NextResponse.json({ ok: true, profile: updatedProfile });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('PATCH /api/employees error:', err);
    return NextResponse.json({ error: err?.message || 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' }, { status: 500 });
  }
}

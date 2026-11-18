import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

export type AdminAuthSuccess = {
  supabaseAdmin: SupabaseClient;
  user: User;
  error?: undefined;
  status?: undefined;
};

export type AdminAuthFailure = {
  error: string;
  status: number;
  supabaseAdmin?: undefined;
  user?: undefined;
};

export function createServiceRoleClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: string; message?: string };
  const code = String(err.code || '');
  const msg = String(err.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  );
}

function extractBearerOrCookieToken(request: Request): string {
  const authHeader =
    request.headers.get('authorization') || request.headers.get('Authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const cookieHeader = request.headers.get('cookie') || '';
  const cookieMatch = cookieHeader.match(/(?:^|;\s*)admin_token=([^;]+)/);
  if (cookieMatch?.[1]) {
    try {
      return decodeURIComponent(cookieMatch[1]);
    } catch {
      return cookieMatch[1];
    }
  }

  return '';
}

export async function getAdminContext(
  request: Request
): Promise<AdminAuthSuccess | AdminAuthFailure> {
  const supabaseAdmin = createServiceRoleClient();
  if (!supabaseAdmin) {
    return {
      error: 'Server configuration error: missing SUPABASE_SERVICE_ROLE_KEY',
      status: 500,
    };
  }

  const token = extractBearerOrCookieToken(request);
  if (!token) {
    return {
      error: 'กรุณาเข้าสู่ระบบผู้ดูแลระบบ (Missing Authorization Token)',
      status: 401,
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return {
      error: 'Unauthorized: invalid session token',
      status: 401,
    };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || profile?.role !== 'admin') {
    return {
      error: 'Forbidden: เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น',
      status: 403,
    };
  }

  return { supabaseAdmin, user };
}

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// This endpoint is deliberately server-to-server. The HR backend supplies the
// shared key; browser clients never receive it.
export async function GET(request: Request) {
  const apiKey = process.env.PI_RECORDS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'PI Record API is not configured' }, { status: 503 });
  }
  if (request.headers.get('x-pi-records-key') !== apiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return NextResponse.json({ error: 'Supabase server credentials are not configured' }, { status: 503 });
  }

  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from('pi_records')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('PI Record API error:', error.message);
    return NextResponse.json({ error: 'Unable to load PI Record data' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: data || [] });
}

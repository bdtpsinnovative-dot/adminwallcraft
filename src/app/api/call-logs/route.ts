import { NextResponse } from 'next/server';
import { getAdminContext, isMissingRelationError } from '@/lib/admin-api-auth';
import { cleanText, fetchAllRows } from '@/lib/customer-contact-analyzer';

interface CallLogRow {
  id: string;
  user_id: string;
  contact_id: string | null;
  phone_normalized: string;
  phone_display: string;
  contact_name_snapshot: string;
  company_name_snapshot: string;
  contact_category_snapshot: string;
  call_direction: 'incoming' | 'outgoing' | 'missed';
  call_source: 'android_call_log' | 'in_app_dial' | 'manual';
  started_at: string;
  duration_sec: number;
  outcome: 'connected' | 'no_answer' | 'busy' | 'follow_up' | 'unknown';
  note: string;
  created_at: string;
}

export async function GET(request: Request) {
  try {
    const auth = await getAdminContext(request);
    if (auth.error || !auth.supabaseAdmin) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
    }
    const { supabaseAdmin } = auth;

    const url = new URL(request.url);
    const days = Math.min(Math.max(Number(url.searchParams.get('days') || '30') || 30, 1), 365);
    const sinceIso = new Date(Date.now() - days * 86400 * 1000).toISOString();

    const probe = await supabaseAdmin.from('customer_call_logs').select('id').limit(1);
    if (probe.error) {
      if (isMissingRelationError(probe.error)) {
        return NextResponse.json({
          success: true,
          migrationRequired: true,
          logs: [],
          salesStats: [],
          summary: {
            totalCalls: 0,
            outgoing: 0,
            incoming: 0,
            missed: 0,
            connected: 0,
            followUp: 0,
            totalDurationSec: 0,
            uniqueCustomers: 0,
            activeSalesCount: 0,
          },
        });
      }
      return NextResponse.json({ error: probe.error.message }, { status: 500 });
    }

    const [logs, profiles] = await Promise.all([
      fetchAllRows<CallLogRow>(supabaseAdmin, 'customer_call_logs', '*', (q) =>
        q
          .not('contact_id', 'is', null)
          .neq('contact_category_snapshot', 'unlisted')
          .gte('started_at', sinceIso)
          .order('started_at', { ascending: false })
      ),
      fetchAllRows<{ id: string; full_name: string | null; email: string | null }>(
        supabaseAdmin,
        'profiles',
        'id, full_name, email'
      ),
    ]);

    const profileMap = new Map<string, string>();
    for (const p of profiles) {
      profileMap.set(p.id, cleanText(p.full_name) || cleanText(p.email) || 'พนักงาน');
    }

    let outgoing = 0;
    let incoming = 0;
    let missed = 0;
    let connected = 0;
    let followUp = 0;
    let totalDurationSec = 0;
    const uniquePhones = new Set<string>();

    const salesMap = new Map<
      string,
      {
        user_id: string;
        sale_name: string;
        totalCalls: number;
        outgoing: number;
        incoming: number;
        missed: number;
        connected: number;
        totalDurationSec: number;
        uniquePhones: Set<string>;
        lastCallAt: string;
      }
    >();

    const enrichedLogs = logs.map((row) => {
      const saleName = profileMap.get(row.user_id) || 'พนักงาน';
      const dur = Number(row.duration_sec || 0);
      totalDurationSec += dur;
      uniquePhones.add(row.phone_normalized);

      if (row.call_direction === 'outgoing') outgoing += 1;
      else if (row.call_direction === 'incoming') incoming += 1;
      else if (row.call_direction === 'missed') missed += 1;

      if (row.outcome === 'connected') connected += 1;
      else if (row.outcome === 'follow_up') followUp += 1;

      let stat = salesMap.get(row.user_id);
      if (!stat) {
        stat = {
          user_id: row.user_id,
          sale_name: saleName,
          totalCalls: 0,
          outgoing: 0,
          incoming: 0,
          missed: 0,
          connected: 0,
          totalDurationSec: 0,
          uniquePhones: new Set<string>(),
          lastCallAt: row.started_at,
        };
        salesMap.set(row.user_id, stat);
      }
      stat.totalCalls += 1;
      if (row.call_direction === 'outgoing') stat.outgoing += 1;
      else if (row.call_direction === 'incoming') stat.incoming += 1;
      else if (row.call_direction === 'missed') stat.missed += 1;
      if (row.outcome === 'connected') stat.connected += 1;
      stat.totalDurationSec += dur;
      stat.uniquePhones.add(row.phone_normalized);
      if (row.started_at > stat.lastCallAt) stat.lastCallAt = row.started_at;

      return {
        ...row,
        sale_name: saleName,
      };
    });

    const salesStats = Array.from(salesMap.values())
      .map((s) => ({
        user_id: s.user_id,
        sale_name: s.sale_name,
        totalCalls: s.totalCalls,
        outgoing: s.outgoing,
        incoming: s.incoming,
        missed: s.missed,
        connected: s.connected,
        totalDurationSec: s.totalDurationSec,
        uniqueCustomersCount: s.uniquePhones.size,
        lastCallAt: s.lastCallAt,
      }))
      .sort((a, b) => b.totalCalls - a.totalCalls);

    return NextResponse.json({
      success: true,
      migrationRequired: false,
      logs: enrichedLogs,
      salesStats,
      summary: {
        totalCalls: enrichedLogs.length,
        outgoing,
        incoming,
        missed,
        connected,
        followUp,
        totalDurationSec,
        uniqueCustomers: uniquePhones.size,
        activeSalesCount: salesStats.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'ดึงประวัติการโทรไม่สำเร็จ';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeCompanyName, chooseBestCompanyName, MappingGroup } from '@/lib/company-utils';

export const dynamic = 'force-dynamic';

const CONFIG_PATH = 'configs/company-mappings.json';
const BUCKET_NAME = 'orders';

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 300): Promise<T> {
  let lastErr: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < retries) {
        await new Promise(r => setTimeout(r, delayMs * (i + 1)));
      }
    }
  }
  throw lastErr;
}

async function fetchAllCompanies() {
  let all: { id: string; name: string; created_at: string; customer_type_id: string | null }[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await withRetry(async () => {
      return await supabaseAdmin
        .from('companies')
        .select('id, name, created_at, customer_type_id')
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);
    });

    if (error) throw error;
    if (data && data.length > 0) {
      all = all.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    } else {
      break;
    }
  }
  return all;
}

async function fetchAllOrderCompanyIds() {
  const countMap: Record<string, number> = {};
  let from = 0;
  const pageSize = 1000;

  try {
    while (true) {
      const { data, error } = await withRetry(async () => {
        return await supabaseAdmin
          .from('orders')
          .select('company_id')
          .not('company_id', 'is', null)
          .range(from, from + pageSize - 1);
      });

      if (error) throw error;
      if (!data || data.length === 0) break;

      data.forEach(o => {
        if (o.company_id) {
          countMap[o.company_id] = (countMap[o.company_id] || 0) + 1;
        }
      });

      if (data.length < pageSize) break;
      from += pageSize;
    }
  } catch (err) {
    console.warn('[company-mappings] Warning: Failed to fetch order counts:', err);
    // Graceful fallback: return whatever counts were collected, don't crash
  }
  return countMap;
}

export async function GET() {
  try {
    // 1. Load saved custom mappings from storage using admin client (bypasses RLS)
    let savedGroups: MappingGroup[] = [];
    try {
      const { data: file, error: downErr } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .download(CONFIG_PATH);

      if (file && !downErr) {
        const text = await file.text();
        const json = JSON.parse(text);
        if (json && Array.isArray(json.groups)) {
          savedGroups = json.groups;
        }
      }
    } catch (e) {
      console.log('[company-mappings] No saved config found in storage, starting fresh.');
    }

    // 2. Load all companies & all orders with complete pagination (no 1000 limit)
    const [allCompanies, orderCountMap] = await Promise.all([
      fetchAllCompanies(),
      fetchAllOrderCompanyIds()
    ]);

    // 3. Group companies by normalized name to discover suggestions
    const configuredCompanyIdSet = new Set<string>();
    savedGroups.forEach(g => {
      g.companyIds.forEach(id => configuredCompanyIdSet.add(id));
      // Sort companies inside each configured group so highest order count is first
      g.companyIds.sort((idA, idB) => (orderCountMap[idB] || 0) - (orderCountMap[idA] || 0));
    });

    // Sort configured groups by total orders descending
    savedGroups.sort((a, b) => {
      const ordersA = a.companyIds.reduce((sum, id) => sum + (orderCountMap[id] || 0), 0);
      const ordersB = b.companyIds.reduce((sum, id) => sum + (orderCountMap[id] || 0), 0);
      return ordersB - ordersA;
    });

    const normGroups: Record<string, { id: string; name: string; created_at: string; orderCount: number }[]> = {};

    allCompanies.forEach(c => {
      const norm = normalizeCompanyName(c.name);
      if (!norm) return;
      if (!normGroups[norm]) normGroups[norm] = [];
      normGroups[norm].push({
        id: c.id,
        name: c.name,
        created_at: c.created_at,
        orderCount: orderCountMap[c.id] || 0
      });
    });

    // 4. Build suggested groups for candidates with > 1 company that haven't been configured
    const suggestedGroups: MappingGroup[] = [];

    Object.entries(normGroups).forEach(([normKey, list]) => {
      if (list.length <= 1) return;

      // Check if all or any are already in configured groups
      const unmappedItems = list.filter(item => !configuredCompanyIdSet.has(item.id));
      // Deduplicate by ID
      const uniqueUnmapped = Array.from(new Map(unmappedItems.map(item => [item.id, item])).values());

      if (uniqueUnmapped.length > 1) {
        // Sort items inside this group: highest order count FIRST!
        uniqueUnmapped.sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0));

        // Pick best formatted target name
        let bestTarget = uniqueUnmapped[0].name;
        uniqueUnmapped.forEach(item => {
          bestTarget = chooseBestCompanyName(bestTarget, item.name);
        });

        suggestedGroups.push({
          id: `suggested-${normKey.replace(/[^a-zA-Z0-9ก-๙]/g, '-')}`,
          targetName: bestTarget.trim(),
          companyIds: uniqueUnmapped.map(item => item.id),
          aliasNames: uniqueUnmapped.map(item => item.name),
          isSuggested: true
        });
      }
    });

    // Sort suggestions by total orders descending so high-value duplicates are top
    suggestedGroups.sort((a, b) => {
      const ordersA = a.companyIds.reduce((sum, id) => sum + (orderCountMap[id] || 0), 0);
      const ordersB = b.companyIds.reduce((sum, id) => sum + (orderCountMap[id] || 0), 0);
      return ordersB - ordersA;
    });

    // Build complete id -> name lookup for ALL companies
    const companyMap: Record<string, string> = {};
    allCompanies.forEach(c => {
      companyMap[c.id] = c.name;
    });

    return NextResponse.json({
      success: true,
      configuredGroups: savedGroups,
      suggestedGroups,
      allCompanies: allCompanies.map(c => ({ id: c.id, name: c.name })),
      companyMap,
      companiesCount: allCompanies.length,
      orderCountMap
    });
  } catch (error: any) {
    console.error('Error fetching company mappings:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error fetching mappings' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const groups: MappingGroup[] = body.groups || [];

    // Filter valid groups
    const cleanGroups = groups
      .filter(g => g.targetName?.trim() && Array.isArray(g.companyIds) && g.companyIds.length > 0)
      .map(g => ({
        id: g.id || `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        targetName: g.targetName.trim(),
        companyIds: Array.from(new Set(g.companyIds)),
        aliasNames: Array.from(new Set(g.aliasNames || [])),
        isSuggested: false
      }));

    const payload = {
      version: 1,
      updated_at: new Date().toISOString(),
      groups: cleanGroups
    };

    // Use supabaseAdmin to upload so RLS policies don't reject the save
    const { error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(CONFIG_PATH, JSON.stringify(payload, null, 2), {
        contentType: 'application/json',
        upsert: true
      });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, updated_at: payload.updated_at, count: cleanGroups.length });
  } catch (error: any) {
    console.error('Error saving company mappings:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error saving mappings' }, { status: 500 });
  }
}

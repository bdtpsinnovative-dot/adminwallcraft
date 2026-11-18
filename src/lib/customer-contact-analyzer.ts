import { SupabaseClient } from '@supabase/supabase-js';

export type ReviewStatus = 'pending_review' | 'verified' | 'ignored';

export type ContactCategory =
  | 'general'
  | 'interior'
  | 'architect'
  | 'developer'
  | 'contractor'
  | 'office'
  | 'team'
  | 'vip'
  | 'other';

export interface AnalyzedContactRecord {
  phone_normalized: string;
  phone_display: string;
  display_name: string;
  contact_category: ContactCategory;
  company_name: string;
  project_names: string[];
  alternate_names: string[];
  raw_phones: string[];
  source_tables: string[];
  owner_sale_id: string | null;
  owner_sale_name: string;
  order_count: number;
  last_order_at: string | null;
  review_status: ReviewStatus;
  manually_edited: boolean;
  notes: string;
}

export interface InvalidPhoneOrderEntry {
  order_id: string;
  customer_name: string;
  company_name: string;
  raw_phone: string;
  reason: string;
  owner_sale_name: string;
  created_at: string | null;
}

export interface AnalyzerResult {
  contacts: AnalyzedContactRecord[];
  invalidOrderEntries: InvalidPhoneOrderEntry[];
  sourceCounts: {
    ordersScanned: number;
    ordersWithPhone: number;
    projectsScanned: number;
    projectsWithPhone: number;
    profilesWithPhone: number;
    uniqueNormalizedPhones: number;
    multiNameConflicts: number;
    invalidOrderPhoneCount: number;
  };
}

type ExtractedPhoneSegment = {
  normalized: string;
  display: string;
  rawMatched: string;
  extractedInlineName: string;
};

const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF\u00A0]/g;

const PLACEHOLDER_NAMES = new Set([
  '-',
  '--',
  '---',
  '.',
  'n/a',
  'na',
  'none',
  'null',
  'undefined',
  'ไม่ระบุ',
  'ไม่มี',
  'ไม่ทราบ',
  'ลูกค้าทั่วไป',
  'walk in',
  'walk-in',
  'เงินสด',
]);

const GENERIC_CATEGORY_LABELS = new Set([
  'ลูกค้าทั่วไป',
  'walk in',
  'walk-in',
  'เงินสด',
]);

export function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(ZERO_WIDTH_REGEX, ' ').replace(/\s+/g, ' ').trim();
}

export function isUsefulName(name: string): boolean {
  const cleaned = cleanText(name);
  if (!cleaned) return false;
  const lower = cleaned.toLowerCase();
  if (PLACEHOLDER_NAMES.has(lower)) return false;
  if (/^(?:ยังไม่มี|ไม่มี|ไม่ระบุ|ไม่ทราบ|ยังไม่ได้ระบุ)\d*$/i.test(cleaned)) return false;
  if (/^ไม่มีการระบุ/i.test(cleaned)) return false;
  if (/^(?:test|ทดสอบ|demo)$/i.test(cleaned)) return false;
  // Ignore values that are purely phone numbers or digits/symbols
  if (/^[\d\s\-+().#,/]+$/.test(cleaned)) return false;
  if (cleaned.length < 2) return false;
  return true;
}

export function isUsefulProjectName(name: string): boolean {
  const cleaned = cleanText(name);
  if (!cleaned) return false;
  if (/^(?:-|ไม่มี|ยังไม่มี|ไม่ระบุ|ไม่มีการระบุโครงการ|ไม่ระบุโครงการ|ยังไม่มีโครงการ)\d*$/i.test(cleaned)) {
    return false;
  }
  return true;
}

function cleanInlineName(remainder: string): string {
  let text = cleanText(remainder)
    // Remove extensions like "ต่อ 102", "ext 12", "#101"
    .replace(/(?:ต่อ|ext\.?|#)\s*\d+/gi, ' ')
    // Remove phone label prefixes/suffixes
    .replace(/\b(?:tel|phone|mobile|mob|ph|line\s*id|line)\b\s*[:.]?/gi, ' ')
    .replace(/(?:เบอร์โทร|เบอร์ติดต่อ|เบอร์|โทร\.?|มือถือ|คุณลูกค้า)\s*[:.]?/g, ' ')
    .replace(/[()[\]{}:;|/\\,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Trim stray leading/trailing dashes or dots
  text = text.replace(/^[\-.]+|[\-.]+$/g, '').trim();
  return isUsefulName(text) ? text : '';
}

export function formatThaiPhoneDisplay(normalized: string): string {
  if (/^0\d{9}$/.test(normalized)) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`;
  }
  if (/^02\d{7}$/.test(normalized)) {
    return `${normalized.slice(0, 2)}-${normalized.slice(2, 5)}-${normalized.slice(5)}`;
  }
  if (/^0\d{8}$/.test(normalized)) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`;
  }
  return normalized;
}

export function normalizeSinglePhone(input: string): string | null {
  const cleaned = cleanText(input);
  if (!cleaned) return null;

  let digits = cleaned.replace(/\D/g, '');
  if (!digits) return null;

  // Convert Thailand country code +66 / 66 / 0066 followed by 8 or 9 digits -> 0xxxxxxxxx
  if (/^0066\d{8,9}$/.test(digits)) {
    digits = `0${digits.slice(4)}`;
  } else if (/^66\d{8,9}$/.test(digits)) {
    digits = `0${digits.slice(2)}`;
  } else if (/^066\d{8,9}$/.test(digits)) {
    digits = `0${digits.slice(3)}`;
  }

  // Must be Thai 9 or 10 digits starting with 0
  if (!/^0\d{8,9}$/.test(digits)) {
    return null;
  }

  // Reject obvious dummy all-zero numbers
  if (/^0+$/.test(digits)) {
    return null;
  }

  return digits;
}

export function extractThaiPhonesFromText(rawInput: unknown): {
  phones: ExtractedPhoneSegment[];
  cleanedRaw: string;
} {
  const cleanedRaw = cleanText(rawInput);
  if (!cleanedRaw || cleanedRaw === '-' || cleanedRaw === '--') {
    return { phones: [], cleanedRaw };
  }

  const segments = cleanedRaw.split(/[,;|\n/]+/).map((s) => s.trim()).filter(Boolean);
  const phones: ExtractedPhoneSegment[] = [];
  const seenNormalized = new Set<string>();

  for (const segment of segments.length > 0 ? segments : [cleanedRaw]) {
    // Match candidate phone patterns not embedded inside longer digit sequences
    const candidateMatches = segment.match(/(?<!\d)(?:\+?66|0)[\s.\-()]*\d(?:[\s.\-()]*\d){7,9}(?!\d)/g);
    if (!candidateMatches) continue;

    let remainder = segment;
    for (const match of candidateMatches) {
      remainder = remainder.replace(match, ' ');
    }
    const inlineName = cleanInlineName(remainder);

    for (const match of candidateMatches) {
      const normalized = normalizeSinglePhone(match);
      if (!normalized || seenNormalized.has(normalized)) continue;
      seenNormalized.add(normalized);
      phones.push({
        normalized,
        display: formatThaiPhoneDisplay(normalized),
        rawMatched: cleanText(match),
        extractedInlineName: inlineName,
      });
    }
  }

  return { phones, cleanedRaw };
}

function mapCategorySlug(raw: string | null | undefined): ContactCategory | null {
  const text = cleanText(raw).toLowerCase();
  if (!text) return null;
  if (text.includes('interior')) return 'interior';
  if (text.includes('architect')) return 'architect';
  if (text.includes('developer')) return 'developer';
  if (text.includes('contractor')) return 'contractor';
  if (text.includes('office')) return 'office';
  if (text.includes('team') || text.includes('staff')) return 'team';
  if (text.includes('vip')) return 'vip';
  return null;
}

function classifyInvalidOrderReason(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) {
    return 'เป็นข้อความ/ไม่มีตัวเลขเบอร์โทร';
  }
  if (digits.length < 9) {
    return `ตัวเลขสั้นเกินไป (${digits.length} หลัก)`;
  }
  if (digits.length > 11) {
    return `ตัวเลขยาวเกินรูปแบบเบอร์ไทย (${digits.length} หลัก)`;
  }
  return 'รูปแบบเบอร์โทรไม่ถูกต้อง';
}

export async function fetchAllRows<T = Record<string, unknown>>(
  supabaseAdmin: SupabaseClient,
  table: string,
  select: string,
  modifyQuery?: (query: any) => any
): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const rows: T[] = [];

  while (true) {
    let query = supabaseAdmin.from(table).select(select).range(from, from + pageSize - 1);
    if (modifyQuery) {
      query = modifyQuery(query);
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed reading ${table}: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    rows.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

export async function fetchInvalidOrderEntries(
  supabaseAdmin: SupabaseClient
): Promise<InvalidPhoneOrderEntry[]> {
  const [ordersWithPhone, companies, profiles] = await Promise.all([
    fetchAllRows<{
      id: string;
      customer_name: string | null;
      created_at: string | null;
      company_id: string | null;
      user_id: string | null;
      phone: string | null;
    }>(
      supabaseAdmin,
      'orders',
      'id, customer_name, created_at, company_id, user_id, phone',
      (q) => q.not('phone', 'is', null)
    ),
    fetchAllRows<{ id: string; name: string }>(supabaseAdmin, 'companies', 'id, name'),
    fetchAllRows<{ id: string; full_name: string | null; email: string | null }>(
      supabaseAdmin,
      'profiles',
      'id, full_name, email'
    ),
  ]);

  const companyMap = new Map<string, string>();
  for (const c of companies) {
    companyMap.set(c.id, cleanText(c.name));
  }

  const profileMap = new Map<string, string>();
  for (const p of profiles) {
    profileMap.set(p.id, cleanText(p.full_name) || cleanText(p.email));
  }

  const invalidEntries: InvalidPhoneOrderEntry[] = [];
  for (const order of ordersWithPhone) {
    const rawPhone = cleanText(order.phone);
    if (!rawPhone || rawPhone === '-' || rawPhone === '--') continue;

    const { phones } = extractThaiPhonesFromText(rawPhone);
    if (phones.length === 0) {
      invalidEntries.push({
        order_id: order.id,
        customer_name: cleanText(order.customer_name) || '-',
        company_name: order.company_id ? companyMap.get(order.company_id) || '' : '',
        raw_phone: rawPhone,
        reason: classifyInvalidOrderReason(rawPhone),
        owner_sale_name: order.user_id ? profileMap.get(order.user_id) || '' : '',
        created_at: order.created_at,
      });
    }
  }

  invalidEntries.sort((a, b) => {
    const aTime = a.created_at ? Date.parse(a.created_at) || 0 : 0;
    const bTime = b.created_at ? Date.parse(b.created_at) || 0 : 0;
    return bTime - aTime;
  });

  return invalidEntries;
}

type ContactAccumulator = {
  phone_normalized: string;
  phone_display: string;
  rawPhones: Set<string>;
  sourceTables: Set<string>;
  projectNames: Set<string>;
  companyCounts: Map<string, number>;
  nameScores: Map<string, { score: number; count: number; lastSeenMs: number }>;
  categoryCounts: Map<ContactCategory, number>;
  ownerSaleCounts: Map<string, { count: number; lastSeenMs: number }>;
  orderIds: Set<string>;
  lastOrderAt: string | null;
  lastOrderMs: number;
  isInternalTeam: boolean;
};

function addCandidateName(
  acc: ContactAccumulator,
  rawName: string,
  baseWeight: number,
  seenMs: number
) {
  const name = cleanText(rawName);
  if (!isUsefulName(name)) return;
  const lower = name.toLowerCase();
  const weight = GENERIC_CATEGORY_LABELS.has(lower) ? 1 : baseWeight;

  const existing = acc.nameScores.get(name);
  if (existing) {
    existing.score += weight;
    existing.count += 1;
    if (seenMs > existing.lastSeenMs) existing.lastSeenMs = seenMs;
  } else {
    acc.nameScores.set(name, { score: weight, count: 1, lastSeenMs: seenMs });
  }
}

export function getRawMultiPhoneFlag(rawPhones: string[] | null | undefined): boolean {
  if (!Array.isArray(rawPhones)) return false;
  return rawPhones.some(
    (rp) => /[,/;|&\n]/.test(rp) || extractThaiPhonesFromText(rp).phones.length > 1
  );
}

export function getRawMultiPhoneMixedFlag(rawPhones: string[] | null | undefined): boolean {
  if (!Array.isArray(rawPhones)) return false;
  return rawPhones.some((rp) => {
    const hasMulti = /[,/;|&\n]/.test(rp) || extractThaiPhonesFromText(rp).phones.length > 1;
    if (!hasMulti) return false;
    // Pure comma/slash-separated office numbers for 1 company have zero letters; only flag mixed text + multi-phones
    return /[a-zA-Zก-๙]/.test(rp);
  });
}

export function evaluateContactConfidence(contact: {
  phone_normalized: string;
  display_name: string;
  contact_category: string;
  alternate_names: string[];
  raw_phones: string[];
  source_tables: string[];
}): {
  isHighConfidence: boolean;
  reviewStatus: ReviewStatus;
  reasons: string[];
} {
  const reasons: string[] = [];
  const name = cleanText(contact.display_name);
  const lower = name.toLowerCase();

  if (!name) {
    reasons.push('ยังไม่มีชื่อผู้ติดต่อ');
  } else if (GENERIC_CATEGORY_LABELS.has(lower) || PLACEHOLDER_NAMES.has(lower)) {
    reasons.push('ชื่อยังเป็นคำกว้าง/ทั่วไป');
  } else if (name.length < 3) {
    reasons.push('ชื่อสั้นเกินไป');
  }

  if (Array.isArray(contact.alternate_names) && contact.alternate_names.length > 1) {
    reasons.push(`พบ ${contact.alternate_names.length} ชื่อในระบบ`);
  }

  if (
    contact.contact_category === 'team' ||
    (Array.isArray(contact.source_tables) && contact.source_tables.includes('profiles'))
  ) {
    reasons.push('เบอร์ทีมงานภายใน');
  }

  if (getRawMultiPhoneMixedFlag(contact.raw_phones)) {
    reasons.push('ช่องเดิมมีหลายเบอร์และข้อความผสม');
  }

  if (
    !/^0[23456789]/.test(contact.phone_normalized) ||
    /^0(\d)\1{6,}$/.test(contact.phone_normalized)
  ) {
    reasons.push('รูปแบบเบอร์ควรตรวจสอบซ้ำ');
  }

  const isHighConfidence = reasons.length === 0;
  return {
    isHighConfidence,
    reviewStatus: isHighConfidence ? 'verified' : 'pending_review',
    reasons,
  };
}

export async function analyzeCustomerContacts(
  supabaseAdmin: SupabaseClient
): Promise<AnalyzerResult> {
  const [customerTypes, companies, profiles, orders, orderItems, projects] = await Promise.all([
    fetchAllRows<{ id: string; name: string }>(supabaseAdmin, 'customer_types', 'id, name'),
    fetchAllRows<{ id: string; name: string; customer_type_id: string | null }>(
      supabaseAdmin,
      'companies',
      'id, name, customer_type_id'
    ),
    fetchAllRows<{
      id: string;
      full_name: string | null;
      email: string | null;
      phone_number: string | null;
      role: string | null;
    }>(supabaseAdmin, 'profiles', 'id, full_name, email, phone_number, role'),
    fetchAllRows<{
      id: string;
      customer_name: string | null;
      created_at: string | null;
      company_id: string | null;
      user_id: string | null;
      phone: string | null;
      customer_type_id: string | null;
    }>(supabaseAdmin, 'orders', 'id, customer_name, created_at, company_id, user_id, phone, customer_type_id'),
    fetchAllRows<{ id: string; order_id: string | null }>(
      supabaseAdmin,
      'order_items',
      'id, order_id'
    ),
    fetchAllRows<{
      id: string;
      order_item_id: string | null;
      created_at: string | null;
      project_name: string | null;
      account_developer: string | null;
      contact_developer: string | null;
      account_architecture: string | null;
      contact_architecture: string | null;
      account_interior: string | null;
      contact_interior: string | null;
      account_contractor: string | null;
      contact_contractor: string | null;
      is_deleted: boolean | null;
    }>(
      supabaseAdmin,
      'order_item_projects',
      'id, order_item_id, created_at, project_name, account_developer, contact_developer, account_architecture, contact_architecture, account_interior, contact_interior, account_contractor, contact_contractor, is_deleted',
      (q) => q.or('is_deleted.is.null,is_deleted.eq.false')
    ),
  ]);

  const customerTypeMap = new Map<string, string>();
  for (const ct of customerTypes) {
    customerTypeMap.set(ct.id, cleanText(ct.name));
  }

  const companyMap = new Map<string, { name: string; customer_type_id: string | null }>();
  for (const c of companies) {
    companyMap.set(c.id, {
      name: cleanText(c.name),
      customer_type_id: c.customer_type_id,
    });
  }

  const profileMap = new Map<string, { name: string; role: string }>();
  for (const p of profiles) {
    const label = cleanText(p.full_name) || cleanText(p.email);
    profileMap.set(p.id, { name: label, role: cleanText(p.role) });
  }

  const orderByIdMap = new Map<
    string,
    {
      id: string;
      user_id: string | null;
      created_at: string | null;
      company_id: string | null;
      customer_name: string | null;
      customer_type_id: string | null;
    }
  >();
  for (const o of orders) {
    orderByIdMap.set(o.id, {
      id: o.id,
      user_id: o.user_id,
      created_at: o.created_at,
      company_id: o.company_id,
      customer_name: o.customer_name,
      customer_type_id: o.customer_type_id,
    });
  }

  const orderItemToOrderId = new Map<string, string>();
  for (const oi of orderItems) {
    if (oi.id && oi.order_id) {
      orderItemToOrderId.set(oi.id, oi.order_id);
    }
  }

  const map = new Map<string, ContactAccumulator>();
  const getOrCreate = (normalized: string): ContactAccumulator => {
    let existing = map.get(normalized);
    if (!existing) {
      existing = {
        phone_normalized: normalized,
        phone_display: formatThaiPhoneDisplay(normalized),
        rawPhones: new Set<string>(),
        sourceTables: new Set<string>(),
        projectNames: new Set<string>(),
        companyCounts: new Map<string, number>(),
        nameScores: new Map(),
        categoryCounts: new Map<ContactCategory, number>(),
        ownerSaleCounts: new Map(),
        orderIds: new Set<string>(),
        lastOrderAt: null,
        lastOrderMs: 0,
        isInternalTeam: false,
      };
      map.set(normalized, existing);
    }
    return existing;
  };

  let ordersWithPhone = 0;
  const invalidOrderEntries: InvalidPhoneOrderEntry[] = [];

  for (const order of orders) {
    const rawPhone = cleanText(order.phone);
    if (!rawPhone || rawPhone === '-' || rawPhone === '--') continue;

    ordersWithPhone += 1;
    const companyInfo = order.company_id ? companyMap.get(order.company_id) : undefined;
    const companyName = companyInfo?.name || '';
    const customerName = cleanText(order.customer_name);
    const ownerProfile = order.user_id ? profileMap.get(order.user_id) : undefined;
    const createdMs = order.created_at ? Date.parse(order.created_at) || 0 : 0;

    const { phones } = extractThaiPhonesFromText(rawPhone);
    if (phones.length === 0) {
      invalidOrderEntries.push({
        order_id: order.id,
        customer_name: customerName || '-',
        company_name: companyName,
        raw_phone: rawPhone,
        reason: classifyInvalidOrderReason(rawPhone),
        owner_sale_name: ownerProfile?.name || '',
        created_at: order.created_at,
      });
      continue;
    }

    const typeId = order.customer_type_id || companyInfo?.customer_type_id || null;
    const mappedCat = typeId ? mapCategorySlug(customerTypeMap.get(typeId)) : null;

    for (const seg of phones) {
      const acc = getOrCreate(seg.normalized);
      acc.rawPhones.add(rawPhone);
      acc.sourceTables.add('orders');
      acc.orderIds.add(order.id);

      if (createdMs >= acc.lastOrderMs && order.created_at) {
        acc.lastOrderMs = createdMs;
        acc.lastOrderAt = order.created_at;
      }

      if (companyName) {
        acc.companyCounts.set(companyName, (acc.companyCounts.get(companyName) || 0) + 1);
      }

      const hasUsefulCustomer = isUsefulName(customerName);
      if (hasUsefulCustomer) {
        addCandidateName(acc, customerName, 10, createdMs);
      }
      if (seg.extractedInlineName) {
        addCandidateName(acc, seg.extractedInlineName, 7, createdMs);
      }
      if (!hasUsefulCustomer && companyName && isUsefulName(companyName)) {
        addCandidateName(acc, companyName, 4, createdMs);
      }

      if (mappedCat) {
        acc.categoryCounts.set(mappedCat, (acc.categoryCounts.get(mappedCat) || 0) + 1);
      }

      if (order.user_id) {
        const ownerStat = acc.ownerSaleCounts.get(order.user_id);
        if (ownerStat) {
          ownerStat.count += 1;
          if (createdMs > ownerStat.lastSeenMs) ownerStat.lastSeenMs = createdMs;
        } else {
          acc.ownerSaleCounts.set(order.user_id, { count: 1, lastSeenMs: createdMs });
        }
      }
    }
  }

  let projectsWithPhone = 0;
  const projectRoleFields: Array<{
    contactKey:
      | 'contact_developer'
      | 'contact_architecture'
      | 'contact_interior'
      | 'contact_contractor';
    accountKey:
      | 'account_developer'
      | 'account_architecture'
      | 'account_interior'
      | 'account_contractor';
    category: ContactCategory;
  }> = [
    { contactKey: 'contact_interior', accountKey: 'account_interior', category: 'interior' },
    { contactKey: 'contact_architecture', accountKey: 'account_architecture', category: 'architect' },
    { contactKey: 'contact_developer', accountKey: 'account_developer', category: 'developer' },
    { contactKey: 'contact_contractor', accountKey: 'account_contractor', category: 'contractor' },
  ];

  for (const proj of projects) {
    let projectHadPhone = false;
    const projectName = cleanText(proj.project_name);
    const linkedOrderId = proj.order_item_id
      ? orderItemToOrderId.get(proj.order_item_id) || null
      : null;
    const linkedOrder = linkedOrderId ? orderByIdMap.get(linkedOrderId) : undefined;
    const createdMs =
      (proj.created_at ? Date.parse(proj.created_at) : 0) ||
      (linkedOrder?.created_at ? Date.parse(linkedOrder.created_at) : 0) ||
      0;

    for (const roleCfg of projectRoleFields) {
      const rawContact = cleanText(proj[roleCfg.contactKey]);
      if (!rawContact || rawContact === '-' || rawContact === '--') continue;

      const { phones } = extractThaiPhonesFromText(rawContact);
      if (phones.length === 0) continue;

      projectHadPhone = true;
      const accountName = cleanText(proj[roleCfg.accountKey]);

      for (const seg of phones) {
        const acc = getOrCreate(seg.normalized);
        acc.rawPhones.add(rawContact);
        acc.sourceTables.add('order_item_projects');
        if (isUsefulProjectName(projectName)) {
          acc.projectNames.add(projectName);
        }

        acc.categoryCounts.set(roleCfg.category, (acc.categoryCounts.get(roleCfg.category) || 0) + 1);

        if (accountName) {
          addCandidateName(acc, accountName, 8, createdMs);
        }
        if (seg.extractedInlineName) {
          addCandidateName(acc, seg.extractedInlineName, 7, createdMs);
        }

        if (linkedOrder) {
          acc.orderIds.add(linkedOrder.id);
          const orderMs = linkedOrder.created_at ? Date.parse(linkedOrder.created_at) || 0 : 0;
          if (orderMs >= acc.lastOrderMs && linkedOrder.created_at) {
            acc.lastOrderMs = orderMs;
            acc.lastOrderAt = linkedOrder.created_at;
          }
          if (linkedOrder.user_id) {
            const ownerStat = acc.ownerSaleCounts.get(linkedOrder.user_id);
            if (ownerStat) {
              ownerStat.count += 1;
              if (orderMs > ownerStat.lastSeenMs) ownerStat.lastSeenMs = orderMs;
            } else {
              acc.ownerSaleCounts.set(linkedOrder.user_id, { count: 1, lastSeenMs: orderMs });
            }
          }
        } else if (createdMs >= acc.lastOrderMs && proj.created_at) {
          acc.lastOrderMs = createdMs;
          acc.lastOrderAt = proj.created_at;
        }
      }
    }

    if (projectHadPhone) {
      projectsWithPhone += 1;
    }
  }

  let profilesWithPhone = 0;
  for (const prof of profiles) {
    const raw = cleanText(prof.phone_number);
    if (!raw) continue;
    const { phones } = extractThaiPhonesFromText(raw);
    if (phones.length === 0) continue;

    profilesWithPhone += 1;
    const profName = cleanText(prof.full_name) || cleanText(prof.email);

    for (const seg of phones) {
      const acc = getOrCreate(seg.normalized);
      acc.rawPhones.add(raw);
      acc.sourceTables.add('profiles');
      acc.isInternalTeam = true;
      acc.categoryCounts.set('team', (acc.categoryCounts.get('team') || 0) + 5);
      if (profName) {
        addCandidateName(acc, `${profName} (ทีมงาน WallCraft)`, 12, Date.now());
      }
    }
  }

  const contacts: AnalyzedContactRecord[] = [];
  let multiNameConflicts = 0;

  for (const acc of map.values()) {
    // Sort alternate names by weighted score desc, then recency desc
    const sortedNames = Array.from(acc.nameScores.entries()).sort((a, b) => {
      if (b[1].score !== a[1].score) return b[1].score - a[1].score;
      if (b[1].count !== a[1].count) return b[1].count - a[1].count;
      return b[1].lastSeenMs - a[1].lastSeenMs;
    });

    const alternateNames = sortedNames.map(([name]) => name);
    if (alternateNames.length > 1) {
      multiNameConflicts += 1;
    }

    const sortedCompanies = Array.from(acc.companyCounts.entries()).sort((a, b) => b[1] - a[1]);
    const bestCompany = sortedCompanies[0]?.[0] || '';
    const displayName = alternateNames[0] || bestCompany || '';

    // Pick contact category
    let bestCategory: ContactCategory = 'general';
    if (acc.isInternalTeam) {
      bestCategory = 'team';
    } else if (acc.categoryCounts.size > 0) {
      const sortedCats = Array.from(acc.categoryCounts.entries()).sort((a, b) => b[1] - a[1]);
      bestCategory = sortedCats[0][0];
    }

    // Pick most active owner sale
    const sortedOwners = Array.from(acc.ownerSaleCounts.entries()).sort((a, b) => {
      if (b[1].count !== a[1].count) return b[1].count - a[1].count;
      return b[1].lastSeenMs - a[1].lastSeenMs;
    });
    const bestOwnerId = sortedOwners[0]?.[0] || null;
    const bestOwnerName = bestOwnerId ? profileMap.get(bestOwnerId)?.name || '' : '';

    const rawPhonesList = Array.from(acc.rawPhones);
    const sourceTablesList = Array.from(acc.sourceTables);
    const confidence = evaluateContactConfidence({
      phone_normalized: acc.phone_normalized,
      display_name: displayName,
      contact_category: bestCategory,
      alternate_names: alternateNames,
      raw_phones: rawPhonesList,
      source_tables: sourceTablesList,
    });

    contacts.push({
      phone_normalized: acc.phone_normalized,
      phone_display: acc.phone_display,
      display_name: displayName,
      contact_category: bestCategory,
      company_name: bestCompany,
      project_names: Array.from(acc.projectNames),
      alternate_names: alternateNames,
      raw_phones: rawPhonesList,
      source_tables: sourceTablesList,
      owner_sale_id: bestOwnerId,
      owner_sale_name: bestOwnerName,
      order_count: acc.orderIds.size,
      last_order_at: acc.lastOrderAt,
      review_status: confidence.reviewStatus,
      manually_edited: false,
      notes: '',
    });
  }

  // Sort contacts: multi-name or highest activity first, then newest order
  contacts.sort((a, b) => {
    const aTime = a.last_order_at ? Date.parse(a.last_order_at) || 0 : 0;
    const bTime = b.last_order_at ? Date.parse(b.last_order_at) || 0 : 0;
    if (b.order_count !== a.order_count) return b.order_count - a.order_count;
    return bTime - aTime;
  });

  invalidOrderEntries.sort((a, b) => {
    const aTime = a.created_at ? Date.parse(a.created_at) || 0 : 0;
    const bTime = b.created_at ? Date.parse(b.created_at) || 0 : 0;
    return bTime - aTime;
  });

  return {
    contacts,
    invalidOrderEntries,
    sourceCounts: {
      ordersScanned: orders.length,
      ordersWithPhone,
      projectsScanned: projects.length,
      projectsWithPhone,
      profilesWithPhone,
      uniqueNormalizedPhones: contacts.length,
      multiNameConflicts,
      invalidOrderPhoneCount: invalidOrderEntries.length,
    },
  };
}

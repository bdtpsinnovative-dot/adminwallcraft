import { NextResponse } from 'next/server';
import { getAdminContext, isMissingRelationError } from '@/lib/admin-api-auth';
import {
  analyzeCustomerContacts,
  cleanText,
  fetchAllRows,
  fetchInvalidOrderEntries,
  formatThaiPhoneDisplay,
  normalizeSinglePhone,
  ReviewStatus,
} from '@/lib/customer-contact-analyzer';

interface CustomerContactRow {
  id: string;
  phone_normalized: string;
  phone_display: string;
  display_name: string;
  contact_category: string;
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
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const VALID_REVIEW_STATUSES = new Set<ReviewStatus>(['pending_review', 'verified', 'ignored']);

function computeSummary(
  contacts: Array<{
    review_status: string;
    alternate_names?: string[] | null;
    display_name?: string | null;
    contact_category?: string | null;
  }>,
  invalidOrderPhoneCount: number
) {
  let pendingReview = 0;
  let verified = 0;
  let ignored = 0;
  let multiNameCount = 0;
  let missingNameCount = 0;
  const byCategory: Record<string, number> = {};

  for (const row of contacts) {
    if (row.review_status === 'verified') verified += 1;
    else if (row.review_status === 'ignored') ignored += 1;
    else pendingReview += 1;

    if (Array.isArray(row.alternate_names) && row.alternate_names.length > 1) {
      multiNameCount += 1;
    }
    if (!cleanText(row.display_name)) {
      missingNameCount += 1;
    }

    const cat = cleanText(row.contact_category) || 'general';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  }

  return {
    total: contacts.length,
    pendingReview,
    verified,
    ignored,
    multiNameCount,
    missingNameCount,
    invalidOrderPhoneCount,
    byCategory,
  };
}

export async function GET(request: Request) {
  try {
    const auth = await getAdminContext(request);
    if (auth.error || !auth.supabaseAdmin) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
    }
    const { supabaseAdmin } = auth;

    // Probe customer_contacts table existence first
    const probe = await supabaseAdmin.from('customer_contacts').select('id').limit(1);

    if (probe.error) {
      if (isMissingRelationError(probe.error)) {
        const analyzed = await analyzeCustomerContacts(supabaseAdmin);
        const previewContacts: CustomerContactRow[] = analyzed.contacts.map((c, idx) => ({
          id: `preview-${idx}-${c.phone_normalized}`,
          ...c,
          reviewed_by: null,
          reviewed_at: null,
          created_at: null,
          updated_at: null,
        }));

        return NextResponse.json({
          success: true,
          migrationRequired: true,
          previewMode: true,
          contacts: previewContacts,
          invalidOrderEntries: analyzed.invalidOrderEntries,
          sourceCounts: analyzed.sourceCounts,
          summary: computeSummary(previewContacts, analyzed.invalidOrderEntries.length),
        });
      }

      return NextResponse.json(
        { error: `ไม่สามารถอ่านตาราง customer_contacts: ${probe.error.message}` },
        { status: 500 }
      );
    }

    const [contacts, invalidOrderEntries] = await Promise.all([
      fetchAllRows<CustomerContactRow>(supabaseAdmin, 'customer_contacts', '*', (q) =>
        q
          .order('last_order_at', { ascending: false, nullsFirst: false })
          .order('order_count', { ascending: false })
          .order('phone_normalized', { ascending: true })
      ),
      fetchInvalidOrderEntries(supabaseAdmin),
    ]);

    return NextResponse.json({
      success: true,
      migrationRequired: false,
      previewMode: false,
      contacts,
      invalidOrderEntries,
      summary: computeSummary(contacts, invalidOrderEntries.length),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการดึงข้อมูลเบอร์ลูกค้า';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAdminContext(request);
    if (auth.error || !auth.supabaseAdmin || !auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
    }
    const { supabaseAdmin, user } = auth;

    const body = await request.json();
    const rawPhone = cleanText(body?.phone || body?.phone_normalized || '');
    const normalized = normalizeSinglePhone(rawPhone);
    if (!normalized) {
      return NextResponse.json(
        {
          error:
            'กรุณาระบุเบอร์โทรศัพท์ไทย 9-10 หลักที่ถูกต้อง (เช่น 081-234-5678 หรือ 02-123-4567)',
        },
        { status: 400 }
      );
    }

    const displayName = cleanText(body?.display_name);
    if (!displayName) {
      return NextResponse.json({ error: 'กรุณาระบุชื่อผู้ติดต่อ / ชื่อลูกค้า' }, { status: 400 });
    }

    const reviewStatus: ReviewStatus = VALID_REVIEW_STATUSES.has(body?.review_status)
      ? body.review_status
      : 'verified';

    const phoneDisplay = cleanText(body?.phone_display) || formatThaiPhoneDisplay(normalized);
    const companyName = cleanText(body?.company_name);
    const contactCategory = cleanText(body?.contact_category).toLowerCase() || 'general';
    const ownerSaleName = cleanText(body?.owner_sale_name);
    const notes = cleanText(body?.notes);
    const rawProjects: string[] = Array.isArray(body?.project_names)
      ? body.project_names.map((p: unknown) => cleanText(p)).filter(Boolean)
      : [];

    const nowIso = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('customer_contacts')
      .insert({
        phone_normalized: normalized,
        phone_display: phoneDisplay,
        display_name: displayName,
        contact_category: contactCategory,
        company_name: companyName,
        project_names: Array.from(new Set(rawProjects)),
        alternate_names: [displayName],
        raw_phones: rawPhone ? [rawPhone] : [phoneDisplay],
        source_tables: ['manual'],
        owner_sale_name: ownerSaleName,
        order_count: 0,
        review_status: reviewStatus,
        manually_edited: true,
        notes,
        reviewed_by: reviewStatus === 'pending_review' ? null : user.id,
        reviewed_at: reviewStatus === 'pending_review' ? null : nowIso,
      })
      .select('*')
      .single();

    if (error) {
      if (isMissingRelationError(error)) {
        return NextResponse.json(
          { error: 'กรุณารัน SQL สร้างตาราง customer_contacts ใน Supabase ก่อนเพิ่มเบอร์ครับ', migrationRequired: true },
          { status: 400 }
        );
      }
      if (error.code === '23505') {
        return NextResponse.json(
          { error: `เบอร์ ${phoneDisplay} (${normalized}) มีอยู่ในระบบแล้ว สามารถค้นหาเพื่อแก้ไขได้เลย` },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, contact: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'เพิ่มเบอร์ติดต่อไม่สำเร็จ';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAdminContext(request);
    if (auth.error || !auth.supabaseAdmin || !auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
    }
    const { supabaseAdmin, user } = auth;

    const body = await request.json();
    const nowIso = new Date().toISOString();

    // Bulk status update support
    if (Array.isArray(body?.ids) && body.ids.length > 0 && body?.review_status) {
      if (!VALID_REVIEW_STATUSES.has(body.review_status)) {
        return NextResponse.json({ error: 'สถานะไม่ถูกต้อง' }, { status: 400 });
      }
      const nextStatus: ReviewStatus = body.review_status;
      const { data, error } = await supabaseAdmin
        .from('customer_contacts')
        .update({
          review_status: nextStatus,
          manually_edited: true,
          reviewed_by: nextStatus === 'pending_review' ? null : user.id,
          reviewed_at: nextStatus === 'pending_review' ? null : nowIso,
        })
        .in('id', body.ids)
        .select('*');

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, contacts: data || [] });
    }

    const id = cleanText(body?.id);
    if (!id) {
      return NextResponse.json({ error: 'กรุณาระบุ id ของรายการที่ต้องการแก้ไข' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    let isContentEdited = false;

    if (typeof body?.display_name === 'string') {
      updates.display_name = cleanText(body.display_name);
      isContentEdited = true;
    }
    if (typeof body?.company_name === 'string') {
      updates.company_name = cleanText(body.company_name);
      isContentEdited = true;
    }
    if (typeof body?.contact_category === 'string') {
      updates.contact_category = cleanText(body.contact_category).toLowerCase() || 'general';
      isContentEdited = true;
    }
    if (typeof body?.owner_sale_name === 'string') {
      updates.owner_sale_name = cleanText(body.owner_sale_name);
      isContentEdited = true;
    }
    if (typeof body?.notes === 'string') {
      updates.notes = cleanText(body.notes);
      isContentEdited = true;
    }
    if (Array.isArray(body?.project_names)) {
      updates.project_names = Array.from(
        new Set(body.project_names.map((p: unknown) => cleanText(p)).filter(Boolean))
      );
      isContentEdited = true;
    }

    if (typeof body?.phone === 'string' && cleanText(body.phone)) {
      const normalized = normalizeSinglePhone(body.phone);
      if (!normalized) {
        return NextResponse.json(
          { error: 'เบอร์โทรใหม่ไม่ถูกต้อง (ต้องเป็นเบอร์ไทย 9-10 หลักขึ้นต้นด้วย 0)' },
          { status: 400 }
        );
      }
      updates.phone_normalized = normalized;
      updates.phone_display = formatThaiPhoneDisplay(normalized);
      isContentEdited = true;
    }

    if (typeof body?.review_status === 'string') {
      if (!VALID_REVIEW_STATUSES.has(body.review_status as ReviewStatus)) {
        return NextResponse.json({ error: 'ค่า review_status ไม่ถูกต้อง' }, { status: 400 });
      }
      const nextStatus = body.review_status as ReviewStatus;
      updates.review_status = nextStatus;
      updates.manually_edited = true;
      updates.reviewed_by = nextStatus === 'pending_review' ? null : user.id;
      updates.reviewed_at = nextStatus === 'pending_review' ? null : nowIso;
    }

    if (isContentEdited) {
      updates.manually_edited = true;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'ไม่มีข้อมูลที่ต้องการแก้ไข' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('customer_contacts')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'เบอร์โทรศัพท์นี้ซ้ำกับรายการอื่นที่มีอยู่แล้วในระบบ' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, contact: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'บันทึกการแก้ไขไม่สำเร็จ';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getAdminContext(request);
    if (auth.error || !auth.supabaseAdmin) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
    }
    const { supabaseAdmin } = auth;

    const url = new URL(request.url);
    let id = cleanText(url.searchParams.get('id'));
    if (!id) {
      try {
        const body = await request.json();
        id = cleanText(body?.id);
      } catch {
        // ignore missing body
      }
    }

    if (!id) {
      return NextResponse.json({ error: 'กรุณาระบุ id ของรายการที่ต้องการลบ' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('customer_contacts').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'ลบรายการไม่สำเร็จ';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

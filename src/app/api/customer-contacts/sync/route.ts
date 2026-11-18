import { NextResponse } from 'next/server';
import { getAdminContext, isMissingRelationError } from '@/lib/admin-api-auth';
import {
  analyzeCustomerContacts,
  cleanText,
  fetchAllRows,
  isUsefulName,
  isUsefulProjectName,
  ReviewStatus,
} from '@/lib/customer-contact-analyzer';

interface ExistingContactRow {
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
  review_status: ReviewStatus;
  manually_edited: boolean;
  notes: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

function mergeUniqueStrings(primary: string[] | null | undefined, secondary: string[] | null | undefined): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const list of [primary || [], secondary || []]) {
    for (const item of list) {
      const cleaned = cleanText(item);
      if (cleaned && !seen.has(cleaned)) {
        seen.add(cleaned);
        result.push(cleaned);
      }
    }
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const auth = await getAdminContext(request);
    if (auth.error || !auth.supabaseAdmin) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
    }
    const { supabaseAdmin } = auth;

    // Ensure target table exists before analyzing/writing
    const probe = await supabaseAdmin.from('customer_contacts').select('id').limit(1);
    if (probe.error) {
      if (isMissingRelationError(probe.error)) {
        return NextResponse.json(
          {
            error: 'ยังไม่ได้สร้างตาราง customer_contacts ใน Supabase กรุณารันคำสั่ง SQL ด้านบนก่อนครับ',
            migrationRequired: true,
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: probe.error.message }, { status: 500 });
    }

    const [analyzed, existingRows] = await Promise.all([
      analyzeCustomerContacts(supabaseAdmin),
      fetchAllRows<ExistingContactRow>(
        supabaseAdmin,
        'customer_contacts',
        'id, phone_normalized, phone_display, display_name, contact_category, company_name, project_names, alternate_names, raw_phones, source_tables, owner_sale_id, owner_sale_name, review_status, manually_edited, notes, reviewed_by, reviewed_at'
      ),
    ]);

    const existingMap = new Map<string, ExistingContactRow>();
    for (const row of existingRows) {
      existingMap.set(row.phone_normalized, row);
    }

    let inserted = 0;
    let updated = 0;
    let preservedManualCount = 0;
    let verifiedCount = 0;
    let pendingReviewCount = 0;

    const upsertPayloads = analyzed.contacts.map((item) => {
      const existing = existingMap.get(item.phone_normalized);
      if (!existing) {
        inserted += 1;
        if (item.review_status === 'verified') verifiedCount += 1;
        else if (item.review_status === 'pending_review') pendingReviewCount += 1;
        return item;
      }

      updated += 1;
      const preserveAdminEdits =
        existing.manually_edited === true || existing.review_status === 'ignored';
      if (preserveAdminEdits) {
        preservedManualCount += 1;
      }

      const nextStatus: ReviewStatus = preserveAdminEdits
        ? existing.review_status || 'pending_review'
        : item.review_status;

      if (nextStatus === 'verified') verifiedCount += 1;
      else if (nextStatus === 'pending_review') pendingReviewCount += 1;

      return {
        phone_normalized: item.phone_normalized,
        phone_display: preserveAdminEdits
          ? cleanText(existing.phone_display) || item.phone_display
          : item.phone_display,
        display_name: preserveAdminEdits
          ? cleanText(existing.display_name) || item.display_name
          : item.display_name,
        contact_category: preserveAdminEdits
          ? cleanText(existing.contact_category) || item.contact_category
          : item.contact_category,
        company_name: preserveAdminEdits
          ? cleanText(existing.company_name) || item.company_name
          : item.company_name,
        project_names: mergeUniqueStrings(
          (existing.project_names || []).filter((p) => isUsefulProjectName(p)),
          item.project_names
        ),
        alternate_names: mergeUniqueStrings(
          item.alternate_names,
          (existing.alternate_names || []).filter((n) => isUsefulName(n))
        ),
        raw_phones: mergeUniqueStrings(item.raw_phones, existing.raw_phones),
        source_tables: mergeUniqueStrings(item.source_tables, existing.source_tables),
        owner_sale_id: preserveAdminEdits
          ? existing.owner_sale_id || item.owner_sale_id
          : item.owner_sale_id,
        owner_sale_name: preserveAdminEdits
          ? cleanText(existing.owner_sale_name) || item.owner_sale_name
          : item.owner_sale_name,
        order_count: item.order_count,
        last_order_at: item.last_order_at,
        review_status: nextStatus,
        manually_edited: Boolean(existing.manually_edited),
        notes: existing.notes || '',
        reviewed_by: existing.reviewed_by,
        reviewed_at: existing.reviewed_at,
      };
    });

    const chunkSize = 100;
    for (let i = 0; i < upsertPayloads.length; i += chunkSize) {
      const chunk = upsertPayloads.slice(i, i + chunkSize);
      const { error: upsertError } = await supabaseAdmin
        .from('customer_contacts')
        .upsert(chunk, { onConflict: 'phone_normalized' });

      if (upsertError) {
        return NextResponse.json(
          { error: `บันทึกข้อมูลไม่สำเร็จ (ชุดที่ ${Math.floor(i / chunkSize) + 1}): ${upsertError.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      migrationRequired: false,
      inserted,
      updated,
      preservedManualCount,
      verifiedCount,
      pendingReviewCount,
      totalAnalyzed: analyzed.contacts.length,
      sourceCounts: analyzed.sourceCounts,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'ซิงค์ข้อมูลเบอร์ลูกค้าไม่สำเร็จ';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

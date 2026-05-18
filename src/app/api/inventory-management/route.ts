import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 🟢 ป้องกัน Next.js จำข้อมูล (แก้ปัญหาข้อมูลไม่ยอมอัปเดต) 🟢
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ตั้งค่า Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// [GET] สำหรับดึงข้อมูลไปแสดงที่ตาราง
// ==========================================
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'balance';

  try {
    if (type === 'balance') {
      const { data, error } = await supabase
        .from('stock_balance')
        .select(`
          *,
          linked_item:product_variants!linked_variant_id(
            id, sku, variant_image,
            products ( image_url )
          )
        `) 
        .order('item_name', { ascending: true })
        .order('series', { ascending: true });

      if (error) throw error;

      const { data: pendingData } = await supabase
        .from('stock_out')
        .select('product_id, qty')
        .eq('status', 'pending');

      const pendingMap: Record<string, number> = {};
      if (pendingData) {
        pendingData.forEach((p: any) => {
          pendingMap[p.product_id] = (pendingMap[p.product_id] || 0) + p.qty;
        });
      }

      const enrichedData = data.map((item: any) => {
        const imgUrl = item.linked_item?.variant_image || item.linked_item?.products?.image_url || null;
        return {
          ...item,
          pending_qty: pendingMap[item.id] || 0,
          catalog_image: imgUrl,
          catalog_sku: item.linked_item?.sku || null
        };
      });

      return NextResponse.json({ success: true, data: enrichedData });
    }
    
    else if (type === 'catalog_search') {
      const searchTerm = searchParams.get('q') || '';
      let query = supabase
        .from('products')
        .select(`id, name, image_url, collection, product_variants ( id, sku, color, variant_image )`)
        .limit(20);

      if (searchTerm) query = query.or(`name.ilike.%${searchTerm}%,collection.ilike.%${searchTerm}%`);
      const { data, error } = await query;
      if (error) throw error;

      const formatted: any[] = [];
      data.forEach((product: any) => {
        if (product.product_variants && product.product_variants.length > 0) {
          product.product_variants.forEach((variant: any) => {
            formatted.push({
              id: variant.id, sku: variant.sku, name: product.name, color: variant.color,
              image: variant.variant_image || product.image_url, collection: product.collection
            });
          });
        }
      });
      return NextResponse.json({ success: true, data: formatted });
    }
    
    else if (type === 'in') {
      const { data, error } = await supabase
        .from('stock_in')
        .select(`
          id, date_in, qty, product_id, created_at,
          stock_balance ( 
            series, item_name, color_name, material, height_mm, width_mm, thickness_mm,
            linked_item:product_variants!linked_variant_id(sku, variant_image, products ( image_url ))
          ),
          operator:profiles!created_by(full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const flattenedData = data.map((item: any) => {
        const imgUrl = item.stock_balance?.linked_item?.variant_image || item.stock_balance?.linked_item?.products?.image_url || null;
        return {
          id: item.id, product_id: item.product_id, qty: item.qty, date_in: item.date_in,
          operator_name: item.operator?.full_name || 'System',
          catalog_image: imgUrl,
          catalog_sku: item.stock_balance?.linked_item?.sku || null,
          ...item.stock_balance
        }
      });

      return NextResponse.json({ success: true, data: flattenedData });
    } 
    
    else if (type === 'out') {
      const { data, error } = await supabase
        .from('stock_out')
        .select(`
          id, date_out, qty, status, product_id, quotation, invoice_tps, created_at,
          stock_balance ( 
            series, item_name, color_name, material, height_mm, width_mm, thickness_mm,
            linked_item:product_variants!linked_variant_id(sku, variant_image, products ( image_url ))
          ),
          operator:profiles!created_by(full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const flattenedData = data.map((item: any) => {
        const imgUrl = item.stock_balance?.linked_item?.variant_image || item.stock_balance?.linked_item?.products?.image_url || null;
        return {
          id: item.id, product_id: item.product_id, qty: item.qty, date_out: item.date_out,
          status: item.status, quotation: item.quotation, invoice_tps: item.invoice_tps,
          operator_name: item.operator?.full_name || 'System',
          catalog_image: imgUrl,
          catalog_sku: item.stock_balance?.linked_item?.sku || null,
          ...item.stock_balance
        }
      });

      return NextResponse.json({ success: true, data: flattenedData });
    }

    else if (type === 'log') {
      const selectLog = `id, date_in, qty, created_at, stock_balance ( series, item_name, color_name, linked_item:product_variants!linked_variant_id(sku, variant_image, products(image_url)) ), operator:profiles!created_by(full_name)`;
      const selectLogOut = `id, date_out, qty, status, quotation, invoice_tps, created_at, stock_balance ( series, item_name, color_name, linked_item:product_variants!linked_variant_id(sku, variant_image, products(image_url)) ), operator:profiles!created_by(full_name)`;
      
      const { data: inData, error: inError } = await supabase.from('stock_in').select(selectLog);
      if (inError) throw inError;

      const { data: outData, error: outError } = await supabase.from('stock_out').select(selectLogOut);
      if (outError) throw outError;

      const extractImg = (stock_balance: any) => stock_balance?.linked_item?.variant_image || stock_balance?.linked_item?.products?.image_url || null;

      const logs = [
        ...(inData || []).map((item: any) => ({
          id: `in-${item.id}`, action_type: 'IN', status: 'approved', date: item.date_in, timestamp: item.created_at, qty: item.qty, operator_name: item.operator?.full_name || 'System', ref: '-',
          catalog_image: extractImg(item.stock_balance),
          ...(item.stock_balance || {})
        })),
        ...(outData || []).map((item: any) => ({
          id: `out-${item.id}`, action_type: 'OUT', status: item.status, date: item.date_out, timestamp: item.created_at, qty: item.qty, operator_name: item.operator?.full_name || 'System', ref: [item.quotation, item.invoice_tps].filter(Boolean).join(' / ') || '-',
          catalog_image: extractImg(item.stock_balance),
          ...(item.stock_balance || {})
        }))
      ];

      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return NextResponse.json({ success: true, data: logs });
    }
    
    return NextResponse.json({ success: false, message: 'Invalid type parameter' }, { status: 400 });

  } catch (error: any) {
    console.error("API GET Error:", error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// ==========================================
// [POST] รวมทุก Action สำหรับจัดการสต็อก
// ==========================================
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const { 
      action, 
      product_id, 
      qty, 
      quotation, 
      invoice_tps, 
      series, 
      item_name, 
      color_name, 
      material, 
      height_mm, 
      width_mm, 
      thickness_mm, 
      out_id, 
      new_status, 
      user_id, 
      stock_id, 
      variant_id,
      csvData
    } = body;

    if (action === 'link_product') {
      if (!stock_id || !variant_id) return NextResponse.json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
      const { error } = await supabase.from('stock_balance').update({ linked_variant_id: variant_id }).eq('id', stock_id);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'เชื่อมโยงรูปภาพสินค้าเรียบร้อยแล้ว' });
    }

    // 2. 🟢 อัปเดตสถานะการเบิก (Approve/Reject) พร้อมเซฟเลขเอกสาร
    if (action === 'update_status_out') {
      if (!out_id || !new_status) return NextResponse.json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
      
      // เตรียมข้อมูลอัปเดต ถ้ามี quotation หรือ invoice_tps แนบมา ให้จับยัดเข้าไปด้วยเลย
      const updateData: any = { status: new_status };
      if (quotation !== undefined) updateData.quotation = quotation || null;
      if (invoice_tps !== undefined) updateData.invoice_tps = invoice_tps || null;

      const { error } = await supabase.from('stock_out').update(updateData).eq('id', out_id);
      if (error) throw error;
      
      return NextResponse.json({ success: true, message: `เปลี่ยนสถานะเป็น ${new_status === 'approved' ? 'อนุมัติ' : 'ไม่อนุมัติ'} สำเร็จ` });
    }

    if (action === 'create_master') {
      if (!item_name) return NextResponse.json({ success: false, message: 'ต้องระบุชื่อสินค้า' }, { status: 400 });
      const { error } = await supabase.from('stock_balance').insert([{ 
        item_name, 
        series: series || null,
        color_name: color_name || null,
        material: material || null,
        height_mm: height_mm ? Number(height_mm) : null,
        width_mm: width_mm ? Number(width_mm) : null,
        thickness_mm: thickness_mm ? Number(thickness_mm) : null,
        qty: 0,
        created_by: user_id,
        linked_variant_id: body.linked_variant_id || null
      }]);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'สร้างสินค้าหลักสำเร็จ' });
    }

    if (action === 'in') {
      if (!product_id || !qty || qty <= 0) return NextResponse.json({ success: false, message: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
      const { error } = await supabase.from('stock_in').insert([{ product_id, qty, created_by: user_id }]);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'บันทึกการรับเข้าสำเร็จ' });
    }

    if (action === 'out') {
      if (!product_id || !qty || qty <= 0) return NextResponse.json({ success: false, message: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
      const { error } = await supabase.from('stock_out').insert([{ 
        product_id, qty, quotation: quotation || null, invoice_tps: invoice_tps || null, status: 'pending', created_by: user_id 
      }]);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'ส่งคำขอเบิกสินค้าสำเร็จ' });
    }

    if (action === 'edit_out') {
      if (!out_id || !qty || qty <= 0) return NextResponse.json({ success: false, message: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
      const { error } = await supabase.from('stock_out').update({
        qty, quotation: quotation || null, invoice_tps: invoice_tps || null
      }).eq('id', out_id);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'แก้ไขข้อมูลการเบิกสำเร็จ' });
    }

    // 🚀 Smart Import CSV (หา/สร้างสินค้า + รับเข้าอัตโนมัติ)
    if (action === 'import_csv') {
      if (!csvData || !Array.isArray(csvData) || csvData.length === 0) {
        return NextResponse.json({ success: false, message: 'ไม่พบข้อมูล CSV' }, { status: 400 });
      }

      for (const row of csvData) {
        // 1. หาหรือสร้างสินค้าใหม่
        const { data: finalProductId, error: productError } = await supabase.rpc('get_or_create_stock_item', {
          p_series: row.series || null,
          p_item_name: row.item_name || 'สินค้าจากระบบนำเข้า', 
          p_color_name: row.color_name || null,
          p_material: row.material || null,
          p_height: row.height_mm ? Number(row.height_mm) : 0,
          p_width: row.width_mm ? Number(row.width_mm) : 0,
          p_thickness: row.thickness_mm ? Number(row.thickness_mm) : 0
        });

        if (productError) {
          console.error(`RPC Error: ${productError.message}`);
          throw new Error(`เกิดข้อผิดพลาดในการตรวจสอบสินค้า: ${productError.message}`);
        }

        // เมื่อได้ ID มาแล้ว (ไม่ว่าจะของเดิมหรือสร้างใหม่) ก็ Insert ลง stock_in
        if (finalProductId && row.qty && Number(row.qty) > 0) {
          
          // 🟢 เตรียมข้อมูลสำหรับบันทึก
          const insertPayload: any = { 
            product_id: finalProductId, 
            qty: Number(row.qty), 
            created_by: user_id
          };

          // 🟢 ถ้าระบบอ่านวันที่จาก CSV มาได้ ให้ใช้วันที่นั้น (แต่ถ้าอ่านไม่ได้ DB จะใช้วันปัจจุบันอัตโนมัติ)
          if (row.date_in) {
            insertPayload.date_in = row.date_in;
          }

          const { error: inError } = await supabase.from('stock_in').insert([insertPayload]);

          if (inError) {
            console.error(`Stock In Error: ${inError.message}`);
            throw new Error(`บันทึกรับเข้าไม่สำเร็จ: ${inError.message}`);
          }
        }
      }
      return NextResponse.json({ success: true, message: 'นำเข้าข้อมูล CSV และอัปเดตสต็อกเรียบร้อย' });
    }

    return NextResponse.json({ success: false, message: 'ไม่พบ Action ที่ระบุ' }, { status: 400 });

  } catch (error: any) {
    console.error("API POST Error:", error.message);
    // ส่งข้อความ Error สีแดงกลับไปแสดงที่หน้าเว็บให้นายเห็นชัดๆ
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// 🚀 ใช้ Service Key (กุญแจผี) ทะลวงทุก RLS ไม่ต้องสน Login
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

export async function POST(req: Request) {
  try {
    const { excelData } = await req.json();

    const groupedOrders: Record<string, any> = {};

    for (const row of excelData) {
      const customerName = row['Customer Name'] || '-';
      const phone = row['Contact'] || '-'; 
      const orderKey = `${customerName}_${phone}`; 

      // 🌟 ดักจับทุกรูปแบบคำผิดและคำที่โดนตัด (แก้ปัญหาพิกเซลต่อพิกเซลตามรูปของพี่)
      const accDev = row['Account Developer'] || row['Account Devoloper'] || null;
      const conDev = row['Contact Developer'] || row['Contact Devoloper'] || null;
      const accInt = row['Account Interior'] || null;
      const conInt = row['Contact Interior'] || row['Contact interior'] || null;
      
      // 🌟 ดักตัว e หาย
      const accArch = row['Account Architecture'] || row['Account Architectur'] || null;
      const conArch = row['Contact Architecture'] || row['Contact Architectur'] || null;
      
      // 🌟 ดักตัว r หาย
      const accCont = row['Account Contractor'] || row['Account Contracto'] || null;
      const conCont = row['Contact Contractor'] || null;

      // อนุมานชื่อบริษัทจากช่องไหนก็ได้ที่มีข้อมูล
      const inferredCompanyName = accDev || accInt || accArch || accCont || null;

      if (!groupedOrders[orderKey]) {
        groupedOrders[orderKey] = {
          sales_email: row['Sales Email'] || row['Sales Name'] || null, 
          customer_name: customerName,
          phone: phone,
          company_name: inferredCompanyName,
          items: {}
        };
      }

      const categoryName = row['Product'] || 'Uncategorized'; 
      if (!groupedOrders[orderKey].items[categoryName]) {
        groupedOrders[orderKey].items[categoryName] = {
          category_name: categoryName,
          interest_level: row['Interest Level'] || null,
          note: row['Details'] || null, 
          projects: []
        };
      }

      // ใส่ข้อมูลเข้าถูกช่องแน่นอน 100%
      groupedOrders[orderKey].items[categoryName].projects.push({
        project_name: row['Project Name'] || '-',
        area_sqm: parseFloat(row['Area (sqm)']) || 0,
        account_developer: accDev, 
        contact_developer: conDev,
        account_interior: accInt,
        contact_interior: conInt, 
        account_architecture: accArch,
        contact_architecture: conArch,
        account_contractor: accCont,
        contact_contractor: conCont,
      });
    }

    // เริ่มบันทึกเข้า Database
    for (const orderKey in groupedOrders) {
      const orderData = groupedOrders[orderKey];

      let orderUserId = null; 
      let orderTeamId = null;

      // ค้นหา ID เซลส์จากอีเมล
      if (orderData.sales_email) {
        const { data: salesProfile } = await supabase
          .from('profiles')
          .select('id, team_id')
          .eq('email', orderData.sales_email.toString().trim()) 
          .single();

        if (salesProfile) {
          orderUserId = salesProfile.id; 
          orderTeamId = salesProfile.team_id;
        }
      }

      let companyId = null;
      if (orderData.company_name && orderData.company_name !== '-') {
        const { data: comp } = await supabase.from('companies').select('id').eq('name', orderData.company_name).single();
        if (comp) companyId = comp.id;
      }

      const { data: insertedOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_name: orderData.customer_name,
          phone: orderData.phone,
          company_id: companyId,
          user_id: orderUserId, 
          team_id: orderTeamId,
          source: 'Excel Import',
          is_synced: false // เพื่อให้ชีทฝั่ง Google ดูดไป
        })
        .select('id').single();

      if (orderError) throw orderError;
      const orderId = insertedOrder.id;

      for (const catName in orderData.items) {
        const itemData = orderData.items[catName];

        const { data: cat } = await supabase.from('product_categories').select('id').eq('name', itemData.category_name).single();
        const categoryId = cat?.id || null;

        if (!categoryId) continue; 

        const { data: insertedItem, error: itemError } = await supabase
          .from('order_items')
          .insert({
            order_id: orderId,
            product_category_id: categoryId,
            interest_level: itemData.interest_level,
            note: itemData.note 
          })
          .select('id').single();

        if (itemError) throw itemError;
        const itemId = insertedItem.id;

        const projectsPayload = itemData.projects.map((proj: any) => ({
          ...proj,
          order_item_id: itemId
        }));

        const { error: projError } = await supabase.from('order_item_projects').insert(projectsPayload);
        if (projError) throw projError;
      }
    }

    return NextResponse.json({ message: 'นำเข้าข้อมูลสำเร็จ!' });

  } catch (error: any) {
    console.error('Import API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
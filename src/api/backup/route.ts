import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// Helper Function ดึงข้อมูลให้ครบทุกบรรทัดโดยไม่สนใจเรื่อง created_at
async function fetchAllRows(tableName: string) {
  let allData: any[] = [];
  let isFetching = true;
  let startRow = 0;
  const step = 1000; 

  while (isFetching) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(startRow, startRow + step - 1);

    if (error) {
      console.error(`[Error in ${tableName}]:`, error.message);
      throw error; 
    }

    if (data && data.length > 0) {
      allData = [...allData, ...data];
      startRow += step;
    }

    if (!data || data.length < step) {
      isFetching = false;
    }
  }

  return allData;
}

export async function GET(request: Request) {
  try {
    console.log("🚀 Starting Full Database Backup...");

    // ดึง 22 ตาราง (ชื่อเป๊ะตาม Schema จริง)
    const [
      products, productVariants, chatHistory, productKnowledge,
      profiles, teams, customerTypes, productCategories, projectTypes,
      projectOrders, companies, projects, orders, orderItems, orderItemProjects,
      notifications, summaryDaily, summaryWeekly, summaryMonthly,
      stockBalance, stockIn, stockOut
    ] = await Promise.all([
      fetchAllRows('products'),
      fetchAllRows('product_variants'),
      fetchAllRows('chat_history'),
      fetchAllRows('product_knowledge'),
      fetchAllRows('profiles'),
      fetchAllRows('teams'),
      fetchAllRows('customer_types'),
      fetchAllRows('product_categories'),
      fetchAllRows('project_types'),
      fetchAllRows('project_orders'),
      fetchAllRows('companies'),
      fetchAllRows('projects'),
      fetchAllRows('orders'),
      fetchAllRows('order_items'),
      fetchAllRows('order_item_projects'),
      fetchAllRows('notifications'),
      fetchAllRows('summary_daily'),
      fetchAllRows('summary_weekly'),
      fetchAllRows('summary_monthly'),
      fetchAllRows('stock_balance'),
      fetchAllRows('stock_in'),
      fetchAllRows('stock_out')
    ]);

    const backupData = {
      timestamp: new Date().toISOString(),
      profiles, teams, customer_types: customerTypes, product_categories: productCategories, 
      project_types: projectTypes, companies, products, product_variants: productVariants, 
      product_knowledge: productKnowledge, orders, order_items: orderItems, 
      order_item_projects: orderItemProjects, projects, project_orders: projectOrders, 
      stock_balance: stockBalance, stock_in: stockIn, stock_out: stockOut, 
      summary_daily: summaryDaily, summary_weekly: summaryWeekly, summary_monthly: summaryMonthly, 
      chat_history: chatHistory, notifications
    };

    const jsonString = JSON.stringify(backupData);
    
    // ตั้งชื่อไฟล์
    const nowUTC = new Date();
    const thaiTime = new Date(nowUTC.getTime() + (7 * 60 * 60 * 1000));
    
    const year = thaiTime.getUTCFullYear();
    const month = String(thaiTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(thaiTime.getUTCDate()).padStart(2, '0');
    const hours = String(thaiTime.getUTCHours()).padStart(2, '0');
    const minutes = String(thaiTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(thaiTime.getUTCSeconds()).padStart(2, '0');

    const newFileName = `database-backups/full-system-backup-${year}-${month}-${day}-${hours}-${minutes}-${seconds}.json`;

    // อัปโหลด
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: newFileName,
      Body: jsonString,
      ContentType: "application/json",
    }));

    console.log("✅ Backup Successful:", newFileName);

    return NextResponse.json({ 
      success: true, 
      message: `สำรองข้อมูลสำเร็จ! ชื่อไฟล์: ${newFileName}` 
    });

  } catch (error: any) {
    console.error("❌ Full System Backup Failed:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || "เกิดข้อผิดพลาดในการสำรองข้อมูลบนเซิร์ฟเวอร์" 
    }, { status: 500 });
  }
}
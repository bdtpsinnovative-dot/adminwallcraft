import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { ArrowLeft, MapPin, Calendar, Clock, Map, Image as ImageIcon, FileText, Smartphone } from 'lucide-react';
import ImageGallery from '@/components/ImageGallery';
import UserCheckInFilter from '@/components/UserCheckInFilter';

export const dynamic = 'force-dynamic';

export default async function UserCheckInHistoryPage({ 
  params, 
  searchParams 
}: { 
  params: { userId: string },
  searchParams: { start?: string; end?: string; source?: string } 
}) {
  const resolvedParams = await Promise.resolve(params);
  const userId = resolvedParams.userId;
  const resolvedSearchParams = await Promise.resolve(searchParams);

  // 1. จัดการตัวแปร Filter วันที่
  let startIso = '';
  let endIso = '';
  if (resolvedSearchParams?.start) startIso = new Date(`${resolvedSearchParams.start}T00:00:00+07:00`).toISOString();
  if (resolvedSearchParams?.end) endIso = new Date(`${resolvedSearchParams.end}T23:59:59.999+07:00`).toISOString();
  
  // 🔥 เปลี่ยนค่าเริ่มต้นของระบบหลังบ้านเป็น 'APP' แทน 'ALL'
  const filterSource = resolvedSearchParams?.source || 'APP';

  // 2. ดึงชื่อพนักงาน
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single();

  const userName = profile?.full_name || 'ไม่ระบุชื่อพนักงาน';

  // 3. สร้าง Query ดึงประวัติ
  let query = supabase
    .from('orders')
    .select(`
      id, created_at, audit_log,
      order_items (
        images,
        order_item_projects (
          project_name, area_sqm, is_deleted
        )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  // ใส่ตัวกรองวันที่
  if (startIso) query = query.gte('created_at', startIso);
  if (endIso) query = query.lte('created_at', endIso);

  const { data: historyData, error } = await query;

  if (error) {
    console.error("Fetch History Error:", error.message);
  }

  // 4. จัดกลุ่มและกรองข้อมูลด้วย JS (App vs CSV)
  const checkIns = historyData?.flatMap(order => {
    const auditLog = order.audit_log as any;
    const isCsv = !auditLog; // ถ้าไม่มี audit log แปลว่ามาจาก CSV

    // 🔥 กรองตามประเภทแหล่งที่มา (Source)
    if (filterSource === 'APP' && isCsv) return [];
    if (filterSource === 'CSV' && !isCsv) return [];
    
    return (order.order_items || []).flatMap((item: any) => {
      return (item.order_item_projects || [])
        .filter((proj: any) => proj.is_deleted !== true) // ไม่เอาโปรเจกต์ที่ถูกลบ
        .map((proj: any) => {
          
          let imagesArray: string[] = [];
          if (Array.isArray(item.images)) {
            imagesArray = item.images;
          }

          const dateUTC = new Date(order.created_at);
          const thaiTime = new Date(dateUTC.getTime() + (7 * 60 * 60 * 1000));
          const dateStr = thaiTime.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
          const timeStr = thaiTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

          return {
            id: proj.project_name + order.id,
            projectName: proj.project_name || 'ไม่ระบุชื่อโปรเจกต์',
            area: proj.area_sqm,
            date: dateStr,
            time: timeStr,
            timestamp: thaiTime.getTime(),
            images: imagesArray,
            isCsv: isCsv,
            lat: auditLog?.location?.lat,
            lng: auditLog?.location?.lng,
            accuracy: auditLog?.location?.accuracy,
            device: auditLog?.device?.brand ? `${auditLog.device.brand} ${auditLog.device.model}` : 'ไม่ระบุอุปกรณ์',
          };
        });
    });
  }) || [];

  // เรียงลำดับจากใหม่ไปเก่า
  checkIns.sort((a, b) => b.timestamp - a.timestamp);

  // แยกนับจำนวนเพื่อให้เห็นภาพรวม
  const appCount = checkIns.filter(ci => !ci.isCsv).length;
  const csvCount = checkIns.filter(ci => ci.isCsv).length;

  return (
    <main className="p-4 md:p-8 bg-slate-50 min-h-screen text-slate-800 font-sans">
      {/* Header & Back Button */}
      <div className="mb-6 max-w-6xl mx-auto">
        <Link 
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-4"
        >
          <ArrowLeft size={16} /> กลับไปหน้าภาพรวม
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-2xl shadow-md">
              {userName.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800">ประวัติลงพื้นที่ (Check-ins)</h1>
              <p className="text-slate-500 text-sm mt-1">พนักงาน: <span className="font-semibold text-indigo-600">{userName}</span></p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
            <div className="flex flex-col items-center px-4 border-r border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400">รายการที่เลือก</span>
              <span className="text-lg font-black text-slate-700">{checkIns.length}</span>
            </div>
            <div className="flex flex-col items-center px-4 border-r border-slate-200">
              <span className="text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-1"><Smartphone size={10}/> App</span>
              <span className="text-lg font-black text-indigo-600">{appCount}</span>
            </div>
            <div className="flex flex-col items-center px-4">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1"><FileText size={10}/> CSV</span>
              <span className="text-lg font-black text-slate-500">{csvCount}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        {/* แถบตัวกรองที่เรียกใช้ */}
        <UserCheckInFilter />

        {/* Timeline List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6 md:p-8">
          {checkIns.length === 0 ? (
            <div className="text-center py-16 text-slate-400 flex flex-col items-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <MapPin size={40} className="text-slate-300" />
              </div>
              <p className="text-lg font-medium text-slate-500">ไม่พบข้อมูลในเงื่อนไขที่เลือก</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-100 ml-4 md:ml-6 space-y-10 py-4">
              {checkIns.map((ci, index) => (
                <div key={index} className="relative pl-8 md:pl-10">
                  
                  {/* Timeline Dot เปลี่ยนสีตาม CSV หรือ App */}
                  <div className={`absolute -left-[17px] top-0 w-8 h-8 rounded-full border-4 border-white shadow-md flex items-center justify-center text-white text-[11px] font-extrabold z-10 ${ci.isCsv ? 'bg-slate-400' : 'bg-indigo-600'}`}>
                    {index + 1}
                  </div>
                  
                  {/* แบ่ง 3 คอลัมน์: ข้อมูลโปรเจกต์ | แผนที่ | รูปภาพ */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50 hover:bg-slate-50/80 p-5 rounded-2xl border border-slate-100 shadow-sm transition-all">
                    
                    {/* 1. รายละเอียดโปรเจกต์ และ พิกัด (ซ้ายสุด) */}
                    <div className="col-span-1 lg:col-span-4 flex flex-col justify-start">
                      <div className="flex items-center flex-wrap gap-2 mb-2">
                        <h3 className="text-lg font-bold text-slate-800">{ci.projectName}</h3>
                        {/* ป้ายกำกับ (Badge) บอกที่มาข้อมูล */}
                        {ci.isCsv ? (
                          <span className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1"><FileText size={12}/> นำเข้าผ่าน CSV</span>
                        ) : (
                          <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1"><Smartphone size={12}/> ลงพื้นที่แอป</span>
                        )}
                      </div>
                      
                      {/* พิกัดอยู่ใต้ชื่อโปรเจกต์ */}
                      {ci.lat && ci.lng ? (
                        <div className="flex items-center gap-1.5 text-rose-600 text-sm font-semibold mb-4 bg-rose-50 w-fit px-2.5 py-1 rounded-md border border-rose-100">
                          <MapPin size={14} /> {ci.lat.toFixed(5)}, {ci.lng.toFixed(5)}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-400 text-sm font-medium mb-4">
                          <MapPin size={14} /> ไม่พบข้อมูลพิกัด
                        </div>
                      )}
                      
                      <div className="flex flex-col gap-2 text-sm mb-4">
                        <div className="flex items-center gap-2 text-slate-600 font-medium">
                          <Calendar size={16} className={ci.isCsv ? 'text-slate-400' : 'text-indigo-500'} /> วันที่: {ci.date}
                        </div>
                        <div className="flex items-center gap-2 text-slate-600 font-medium">
                          <Clock size={16} className={ci.isCsv ? 'text-slate-400' : 'text-amber-500'} /> เวลา: {ci.time} น.
                        </div>
                        <div className="flex items-center gap-2 text-slate-600 font-medium">
                          <Map size={16} className={ci.isCsv ? 'text-slate-400' : 'text-emerald-500'} /> พื้นที่: {Number(ci.area).toLocaleString()} ตร.ม.
                        </div>
                      </div>

                      <div className="mt-auto">
                        <span className="inline-block bg-white text-slate-500 text-[10px] uppercase font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                          DEVICE: {ci.device}
                        </span>
                      </div>
                    </div>

                    {/* 2. แผนที่ Mini-map หรือ สัญลักษณ์ CSV (ตรงกลาง) */}
                    <div className="col-span-1 lg:col-span-4 flex flex-col">
                      <div className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1.5">
                        <Map size={14} /> ตำแหน่งที่ตั้ง
                      </div>
                      {ci.isCsv ? (
                        <div className="w-full h-48 lg:h-full min-h-[160px] rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-500 relative">
                          <FileText size={32} className="mb-2 text-slate-400" />
                          <span className="text-sm font-bold">ข้อมูลนำเข้าจากไฟล์</span>
                          <span className="text-xs">ไม่มีพิกัดตำแหน่งภูมิศาสตร์</span>
                        </div>
                      ) : ci.lat && ci.lng ? (
                        <div className="w-full h-48 lg:h-full min-h-[160px] rounded-xl overflow-hidden shrink-0 border border-slate-200 shadow-inner bg-slate-100 relative">
                          <iframe
                            width="100%"
                            height="100%"
                            frameBorder="0"
                            style={{ border: 0 }}
                            src={`https://maps.google.com/maps?q=${ci.lat},${ci.lng}&hl=th&z=15&output=embed`}
                            allowFullScreen={false}
                            aria-hidden="false"
                            tabIndex={0}
                            className="absolute inset-0"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-48 lg:h-full min-h-[160px] rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400">
                          <MapPin size={24} className="mb-2 opacity-50" />
                          <span className="text-xs font-medium">ไม่มีแผนที่</span>
                        </div>
                      )}
                    </div>

                    {/* 3. รูปภาพหน้างาน (ขวาสุด) */}
                    <div className="col-span-1 lg:col-span-4 flex flex-col overflow-hidden">
                      <div className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1.5">
                        <ImageIcon size={14} /> รูปภาพหน้างาน ({ci.images.length})
                      </div>
                      <ImageGallery images={ci.images} />
                    </div>

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
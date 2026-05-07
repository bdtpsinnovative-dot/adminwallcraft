import { supabase } from '@/lib/supabase';
import Link from 'next/link';
// 🌟 เพิ่มไอคอน Users เข้ามาใช้กับส่วนผู้เกี่ยวข้อง
import { ArrowLeft, MapPin, Calendar, Clock, Map, Image as ImageIcon, FileText, Smartphone, Users } from 'lucide-react';
import ImageGallery from '@/components/ImageGallery';
import UserCheckInFilter from '@/components/UserCheckInFilter';
import ExpandableNote from '@/components/ExpandableNote';

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

  let startIso = '';
  let endIso = '';
  if (resolvedSearchParams?.start) startIso = new Date(`${resolvedSearchParams.start}T00:00:00+07:00`).toISOString();
  if (resolvedSearchParams?.end) endIso = new Date(`${resolvedSearchParams.end}T23:59:59.999+07:00`).toISOString();
  
  const filterSource = resolvedSearchParams?.source || 'APP';

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single();

  const userName = profile?.full_name || 'ไม่ระบุชื่อพนักงาน';

  // 🌟 จุดที่ 1: เพิ่มการดึงฟิลด์ account_* ออกมาจาก Database
  let query = supabase
    .from('orders')
    .select(`
      id, created_at, audit_log,
      order_items (
        images, 
        note,
        order_item_projects (
          project_name, area_sqm, is_deleted,
          account_developer, account_architecture, account_interior, account_contractor
        )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (startIso) query = query.gte('created_at', startIso);
  if (endIso) query = query.lte('created_at', endIso);

  const { data: historyData, error } = await query;

  if (error) {
    console.error("Fetch History Error:", error.message);
  }

  const checkIns = historyData?.flatMap(order => {
    const auditLog = order.audit_log as any;
    const isCsv = !auditLog;

    if (filterSource === 'APP' && isCsv) return [];
    if (filterSource === 'CSV' && !isCsv) return [];
    
    return (order.order_items || []).flatMap((item: any) => {
      return (item.order_item_projects || [])
        .filter((proj: any) => proj.is_deleted !== true)
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
            note: item.note || '-',
            // 🌟 จุดที่ 2: แมปค่าเข้าตัวแปรเพื่อเอาไปใช้ใน UI
            developer: proj.account_developer,
            architect: proj.account_architecture,
            interior: proj.account_interior,
            contractor: proj.account_contractor,
          };
        });
    });
  }) || [];

  checkIns.sort((a, b) => b.timestamp - a.timestamp);

  const appCount = checkIns.filter(ci => !ci.isCsv).length;
  const csvCount = checkIns.filter(ci => ci.isCsv).length;

  return (
    <main className="p-4 md:p-8 bg-slate-50 min-h-screen text-slate-800 font-sans">
      
      <div className="mb-6 max-w-[1600px] w-[96%] mx-auto">
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

      <div className="max-w-[1600px] w-[96%] mx-auto">
        <UserCheckInFilter />

        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden p-6 md:p-10">
          {checkIns.length === 0 ? (
            <div className="text-center py-20 text-slate-400 flex flex-col items-center">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-5">
                <MapPin size={48} className="text-slate-300" />
              </div>
              <p className="text-xl font-medium text-slate-500">ไม่พบข้อมูลในเงื่อนไขที่เลือก</p>
            </div>
          ) : (
            <div className="relative border-l-[3px] border-slate-100 ml-4 md:ml-6 space-y-12 py-4">
              {checkIns.map((ci, index) => {
                
                // 🌟 ตรวจสอบว่ามีผู้เกี่ยวข้องอย่างน้อย 1 คนหรือไม่
                const hasStakeholders = ci.developer || ci.architect || ci.interior || ci.contractor;

                return (
                  <div key={index} className="relative pl-10 md:pl-14">
                    <div className={`absolute -left-[19px] top-4 w-9 h-9 rounded-full border-[4px] border-white shadow-md flex items-center justify-center text-white text-[12px] font-black z-10 ${ci.isCsv ? 'bg-slate-400' : 'bg-indigo-600'}`}>
                      {index + 1}
                    </div>
                    
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 bg-slate-50/60 hover:bg-slate-50 p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm transition-all duration-300">
                      
                      {/* 1. ข้อมูลฝั่งซ้าย (xl:col-span-4) */}
                      <div className="col-span-1 xl:col-span-4 flex flex-col justify-start">
                        <div className="flex items-center flex-wrap gap-2 mb-3">
                          <h3 className="text-xl font-bold text-slate-800 leading-tight">{ci.projectName}</h3>
                          {ci.isCsv ? (
                            <span className="bg-slate-200 text-slate-600 text-[10px] px-2 py-1 rounded-md font-bold flex items-center gap-1"><FileText size={12}/> CSV</span>
                          ) : (
                            <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-1 rounded-md font-bold flex items-center gap-1"><Smartphone size={12}/> APP</span>
                          )}
                        </div>
                        
                       
                        
                        <div className="flex flex-col gap-3 text-[15px] mb-6">
                          <div className="flex items-center gap-2.5 text-slate-700 font-medium">
                            <div className="bg-white p-1.5 rounded-md shadow-sm border border-slate-100"><Calendar size={18} className={ci.isCsv ? 'text-slate-400' : 'text-indigo-500'} /></div> 
                            วันที่: {ci.date}
                          </div>
                          <div className="flex items-center gap-2.5 text-slate-700 font-medium">
                            <div className="bg-white p-1.5 rounded-md shadow-sm border border-slate-100"><Clock size={18} className={ci.isCsv ? 'text-slate-400' : 'text-amber-500'} /></div> 
                            เวลา: {ci.time} น.
                          </div>
                          <div className="flex items-center gap-2.5 text-slate-700 font-medium">
                            <div className="bg-white p-1.5 rounded-md shadow-sm border border-slate-100"><Map size={18} className={ci.isCsv ? 'text-slate-400' : 'text-emerald-500'} /></div> 
                            พื้นที่: <span className="font-bold">{Number(ci.area).toLocaleString()}</span> ตร.ม.
                          </div>
                        </div>

                        {/* 🌟 จุดที่ 3: แทรกผู้เกี่ยวข้องโครงการตรงนี้ (ถ้ามี) */}
                        {hasStakeholders && (
                          <div className="mb-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="text-[11px] font-bold text-slate-500 uppercase mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                              <Users size={14} className="text-slate-400" /> ข้อมูลผู้เกี่ยวข้อง
                            </div>
                            <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                              {ci.developer && (
                                <div className="flex flex-col">
                                  <span className="text-[20px] text-slate-400 font-bold uppercase">Developer</span>
                                  <span className="text-sm text-slate-700 font-semibold truncate" title={ci.developer}>บริษัท: {ci.developer}</span>
                                </div>
                              )}
                              {ci.architect && (
                                <div className="flex flex-col">
                                  <span className="text-[20px] text-slate-400 font-bold uppercase">Architect</span>
                                  <span className="text-sm text-slate-700 font-semibold truncate" title={ci.architect}>บริษัท:{ci.architect}</span>
                                </div>
                              )}
                              {ci.interior && (
                                <div className="flex flex-col">
                                  <span className="text-[20px] text-slate-400 font-bold uppercase">Interior</span>
                                  <span className="text-sm text-slate-700 font-semibold truncate" title={ci.interior}>บริษัท:{ci.interior}</span>
                                </div>
                              )}
                              {ci.contractor && (
                                <div className="flex flex-col">
                                  <span className="text-[20px] text-slate-400 font-bold uppercase">Contractor</span>
                                  <span className="text-sm text-slate-700 font-semibold truncate" title={ci.contractor}>บริษัท:{ci.contractor}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {ci.note && ci.note !== '-' && (
                          <ExpandableNote note={ci.note} />
                        )}

                        <div className="mt-auto pt-4">
                          <span className="inline-block bg-white text-slate-500 text-[10px] uppercase font-bold px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                            DEVICE: {ci.device}
                          </span>
                        </div>
                      </div>

                      {/* 2. แผนที่ (xl:col-span-5) */}
                      <div className="col-span-1 xl:col-span-5 flex flex-col">
                        <div className="text-sm font-bold text-slate-500 uppercase mb-3 flex items-center gap-1.5">
                          <Map size={16} /> ตำแหน่งที่ตั้ง
                        </div>
                        {ci.isCsv ? (
                          <div className="w-full h-48 xl:h-full min-h-[250px] rounded-2xl bg-white border-[3px] border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 shadow-sm">
                            <FileText size={40} className="mb-3 text-slate-300" />
                            <span className="text-base font-bold text-slate-500">ข้อมูลนำเข้าจากไฟล์</span>
                            <span className="text-sm mt-1">ไม่มีพิกัดตำแหน่งภูมิศาสตร์</span>
                          </div>
                        ) : ci.lat && ci.lng ? (
                          <div className="w-full h-48 xl:h-full min-h-[250px] rounded-2xl overflow-hidden shrink-0 border border-slate-200 shadow-sm bg-slate-100 relative">
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
                          <div className="w-full h-48 xl:h-full min-h-[250px] rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col items-center justify-center text-slate-400">
                            <MapPin size={32} className="mb-3 opacity-40" />
                            <span className="text-sm font-medium">ไม่มีแผนที่</span>
                          </div>
                        )}
                      </div>

                      {/* 3. รูปภาพหน้างาน (xl:col-span-3) */}
                      <div className="col-span-1 xl:col-span-3 flex flex-col overflow-hidden">
                        <div className="text-sm font-bold text-slate-500 uppercase mb-3 flex items-center gap-1.5">
                          <ImageIcon size={16} /> รูปภาพหน้างาน ({ci.images.length})
                        </div>
                        <div className="flex-1 min-h-[250px] bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                          <ImageGallery images={ci.images} />
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
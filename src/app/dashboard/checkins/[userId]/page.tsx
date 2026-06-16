import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { ArrowLeft, MapPin, Calendar, Clock, Map, Image as ImageIcon, FileText, Smartphone, Users, User, Tag, ShoppingBag, Building2 } from 'lucide-react';
import ImageGallery from '@/components/ImageGallery';
import UserCheckInFilter from '@/components/UserCheckInFilter';
import ExpandableNote from '@/components/ExpandableNote';
import EditCheckInModal from '@/components/EditCheckInModal';

export const dynamic = 'force-dynamic';

export default async function UserCheckInHistoryPage({ 
  params, 
  searchParams 
}: { 
  params: { userId: string },
  searchParams: { start?: string; end?: string; source?: string; minArea?: string; maxArea?: string; role?: string; company?: string; } 
}) {
  const resolvedParams = await Promise.resolve(params);
  const userId = resolvedParams.userId;
  const resolvedSearchParams = await Promise.resolve(searchParams);

  let startIso = '';
  let endIso = '';
  if (resolvedSearchParams?.start) startIso = new Date(`${resolvedSearchParams.start}T00:00:00+07:00`).toISOString();
  if (resolvedSearchParams?.end) endIso = new Date(`${resolvedSearchParams.end}T23:59:59.999+07:00`).toISOString();
  
  // 🌟 เปลี่ยนจาก 'APP' เป็น 'ALL' เพื่อให้มันดึงข้อมูลงานที่มาจาก CSV ด้วยแต่แรก
  const filterSource = resolvedSearchParams?.source || 'ALL'; 
  const minAreaFilter = resolvedSearchParams?.minArea ? Number(resolvedSearchParams.minArea) : null;
  const maxAreaFilter = resolvedSearchParams?.maxArea ? Number(resolvedSearchParams.maxArea) : null;
  const roleFilter = resolvedSearchParams?.role || 'ALL';
  
  // 🌟 Next.js ถอดรหัส URL มาให้แล้ว รับค่าตรงๆ ได้เลยป้องกัน Error 
  const filterCompany = resolvedSearchParams?.company ? resolvedSearchParams.company.trim() : '';

  // ฟังก์ชันละลายช่องว่าง เอาไว้จับเทียบชื่อบริษัทให้แม่นยำ 100%
  const normalizeText = (text: string) => text ? text.replace(/\s+/g, '').toLowerCase() : '';
  const targetCompanyStr = normalizeText(filterCompany);

  // 1. ดึงข้อมูลพนักงาน
  let userName = 'ทีมเซลส์ทั้งหมด (All Sales)';
  if (userId !== 'all') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();
    if (profile) userName = profile.full_name;
  }

  // 2. ดึงข้อมูล Category เตรียมให้ Modal
  const { data: categoriesData } = await supabase
    .from('product_categories')
    .select('id, name')
    .order('name');
  const categories = categoriesData || [];

  // 3. ดึงข้อมูล Order และความสัมพันธ์ 
  let query = supabase
    .from('orders')
    .select(`
      id, created_at, audit_log, phone, customer_name, source, user_id,
      companies (name),
      profiles (full_name),
      order_items (
        id, 
        product_category_id, 
        images, 
        note,
        order_item_projects (
          id, 
          project_name, area_sqm, is_deleted, project_note,
          account_developer, contact_developer,
          account_architecture, contact_architecture,
          account_interior, contact_interior,
          account_contractor, contact_contractor,
          project_types (name)
        )
      )
    `)
    .order('created_at', { ascending: false });

  if (userId !== 'all') {
    query = query.eq('user_id', userId);
  }

  if (startIso) query = query.gte('created_at', startIso);
  if (endIso) query = query.lte('created_at', endIso);

  const { data: historyData, error } = await query;

  if (error) {
    console.error("Fetch History Error:", error.message);
  }

  // 4. Transform จัดกลุ่มแยกข้อมูลเป็นกล่องออเดอร์
  const ordersList: any[] = [];
  let totalAppCount = 0;
  let totalCsvCount = 0;
  let totalProjectsCount = 0;

  historyData?.forEach(order => {
    // 🌟 ดึงชื่อบริษัทออกมาให้ปลอดภัยจาก Type Error รองรับทั้งแบบ Array และ Object
    let dbCompanyName = '';
    if (Array.isArray(order.companies)) {
      dbCompanyName = order.companies[0]?.name || '';
    } else if (order.companies) {
      dbCompanyName = (order.companies as any).name || '';
    }

    // 🌟 ดึงชื่อเซลส์ออกมาให้ปลอดภัยจาก Type Error รองรับทั้งแบบ Array และ Object
    let dbSalesName = '';
    if (Array.isArray(order.profiles)) {
      dbSalesName = order.profiles[0]?.full_name || '';
    } else if (order.profiles) {
      dbSalesName = (order.profiles as any).full_name || '';
    }

    // 🌟 กรองบริษัทโดยใช้ฟังก์ชันละลายช่องว่าง (ลบช่องว่างทิ้งก่อนเทียบ)
    if (targetCompanyStr && normalizeText(dbCompanyName) !== targetCompanyStr) {
      return; // ถ้าจับเทียบแบบไม่มีช่องว่างแล้วยังไม่ตรงกัน ค่อยเตะทิ้ง!
    }

    const auditLog = order.audit_log as any;
    const isCsv = !auditLog;

    // ระบบกรองช่องทาง APP / CSV / ALL
    if (filterSource === 'APP' && isCsv) return;
    if (filterSource === 'CSV' && !isCsv) return;
    
    const validProjects: any[] = [];
    
    (order.order_items || []).forEach((item: any) => {
      (item.order_item_projects || [])
        .filter((proj: any) => proj.is_deleted !== true)
        .forEach((proj: any) => {
          const projArea = Number(proj.area_sqm) || 0;
          if (minAreaFilter !== null && projArea < minAreaFilter) return;
          if (maxAreaFilter !== null && projArea > maxAreaFilter) return;

          if (roleFilter !== 'ALL') {
            const hasDev = !!proj.account_developer || !!proj.contact_developer;
            const hasArch = !!proj.account_architecture || !!proj.contact_architecture;
            const hasInt = !!proj.account_interior || !!proj.contact_interior;
            const hasCont = !!proj.account_contractor || !!proj.contact_contractor;

            if (roleFilter === 'developer' && !hasDev) return;
            if (roleFilter === 'architect' && !hasArch) return;
            if (roleFilter === 'interior' && !hasInt) return;
            if (roleFilter === 'contractor' && !hasCont) return;
          }

          let imagesArray: string[] = [];
          if (Array.isArray(item.images)) {
            imagesArray = item.images;
          }

          const matchedCategory = categories.find(c => c.id === item.product_category_id);
          const categoryName = matchedCategory ? matchedCategory.name : 'ไม่ระบุหมวดหมู่';

          validProjects.push({
            id: proj.id || `${proj.project_name}-${order.id}`,
            orderItemId: item.id,
            projectId: proj.id,
            categoryId: item.product_category_id,
            categoryName: categoryName,
            projectName: proj.project_name || 'ไม่ระบุชื่อโปรเจกต์',
            projectType: proj.project_types?.name || '-',
            area: proj.area_sqm,
            images: imagesArray,
            lat: auditLog?.location?.lat,
            lng: auditLog?.location?.lng,
            note: item.note || proj.project_note || '',
            device: auditLog?.device?.brand ? `${auditLog.device.brand} ${auditLog.device.model}` : 'ไม่ระบุอุปกรณ์',
            stakeholders: {
              devAcc: proj.account_developer,
              devCont: proj.contact_developer,
              archAcc: proj.account_architecture,
              archCont: proj.contact_architecture,
              intAcc: proj.account_interior,
              intCont: proj.contact_interior,
              contAcc: proj.account_contractor,
              contCont: proj.contact_contractor
            }
          });
        });
    });

    if (validProjects.length > 0) {
      if (isCsv) totalCsvCount += validProjects.length;
      else totalAppCount += validProjects.length;
      totalProjectsCount += validProjects.length;

      const dateUTC = new Date(order.created_at);
      const dateStr = dateUTC.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = dateUTC.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }) + ' น.';

      ordersList.push({
        orderId: order.id,
        salesName: dbSalesName || 'ไม่ระบุเซลส์', // ✨ ใช้ตัวแปรที่ดึงมาอย่างปลอดภัย
        customerName: order.customer_name || 'ไม่ระบุชื่อลูกค้า',
        companyName: dbCompanyName || 'ลูกค้าทั่วไป (B2C)', // ✨ ใช้ตัวแปรที่ดึงมาอย่างปลอดภัย
        phone: order.phone || '-',
        isCsv: isCsv,
        date: dateStr,
        time: timeStr,
        timestamp: dateUTC.getTime(),
        projects: validProjects
      });
    }
  });

  ordersList.sort((a, b) => b.timestamp - a.timestamp);

  return (
    <main className="p-4 md:p-8 bg-slate-50 min-h-screen text-slate-800 font-sans">
      
      {/* ส่วนหัวกระดาษและสรุป */}
      <div className="mb-6 max-w-[1600px] w-[96%] mx-auto">
        <Link 
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-4"
        >
          <ArrowLeft size={16} /> กลับไปหน้าภาพรวมหลัก
        </Link>

        {filterCompany && (
          <div className="mb-4 bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between shadow-sm gap-3">
            <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
              <Building2 size={20} className="text-indigo-600" />
              <span>กางลายแทงการเข้าพบของบริษัท: <span className="text-indigo-600 bg-white border border-indigo-100 px-3 py-1.5 rounded-lg ml-1 font-black shadow-sm text-base">{filterCompany}</span></span>
            </div>
            <Link 
              href={`/dashboard/checkins/${userId}`}
              className="text-xs font-bold bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-rose-200 transition-all shadow-sm w-fit"
            >
              ✕ ล้างตัวกรอง (ดูทั้งหมด)
            </Link>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-2xl shadow-md shrink-0">
              {userId === 'all' ? <Users size={24} /> : userName.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
                ประวัติลงพื้นที่
              </h1>
              <p className="text-slate-500 text-sm mt-1">พนักงาน: <span className="font-semibold text-indigo-600">{userName}</span></p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100 overflow-x-auto shrink-0">
            <div className="flex flex-col items-center px-4 border-r border-slate-200 min-w-[80px]">
              <span className="text-[10px] uppercase font-bold text-slate-400">ออเดอร์</span>
              <span className="text-lg font-black text-slate-700">{ordersList.length}</span>
            </div>
            <div className="flex flex-col items-center px-4 border-r border-slate-200 min-w-[80px]">
              <span className="text-[10px] uppercase font-bold text-slate-400">โปรเจกต์</span>
              <span className="text-lg font-black text-slate-700">{totalProjectsCount}</span>
            </div>
            <div className="flex flex-col items-center px-4 border-r border-slate-200 min-w-[80px]">
              <span className="text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-1"><Smartphone size={10}/> App</span>
              <span className="text-lg font-black text-indigo-600">{totalAppCount}</span>
            </div>
            <div className="flex flex-col items-center px-4 min-w-[80px]">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1"><FileText size={10}/> CSV</span>
              <span className="text-lg font-black text-slate-500">{totalCsvCount}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] w-[96%] mx-auto">
        <UserCheckInFilter />

        <div className="space-y-6 mt-6">
          {ordersList.length === 0 ? (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-20 text-center flex flex-col items-center">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-5">
                <MapPin size={48} className="text-slate-300" />
              </div>
              <p className="text-xl font-medium text-slate-500">ไม่พบข้อมูลประวัติของบริษัทนี้</p>
            </div>
          ) : (
            ordersList.map((order, orderIdx) => (
              <div key={order.orderId} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition-all relative">
                
                <div className="px-6 py-5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] text-white font-black px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1 ${order.isCsv ? 'bg-slate-400' : 'bg-indigo-600'}`}>
                        {order.isCsv ? <FileText size={12}/> : <Smartphone size={12}/>}
                        ORDER #{order.orderId.substring(0, 8).toUpperCase()}
                      </span>
                      <span className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">
                        🏢 บริษัท: <span className="text-indigo-700 font-black">{order.companyName}</span>
                      </span>
                      {userId === 'all' && (
                        <span className="text-sm font-bold text-slate-600 border border-slate-200 bg-white px-3 py-1 rounded-lg flex items-center gap-1.5 shadow-sm">
                          <User size={14} className="text-indigo-400"/> เซลส์: <span className="text-indigo-600">{order.salesName}</span>
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 font-medium flex flex-wrap items-center gap-4">
                      <span className="flex items-center gap-1"><User size={14} className="text-slate-400"/> ผู้ติดต่อหน้างาน: {order.customerName}</span>
                      <span className="flex items-center gap-1">📞 เบอร์โทร: {order.phone}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-start sm:items-end text-xs font-bold text-slate-400 gap-1 shrink-0">
                    <span className="flex items-center gap-1.5"><Calendar size={14} className="text-indigo-400"/> {order.date}</span>
                    <span className="flex items-center gap-1.5"><Clock size={14} className="text-amber-400"/> {order.time}</span>
                  </div>
                </div>

                <div className="p-6 md:p-8 space-y-10">
                  {order.projects.map((proj: any, pIdx: number) => {
                    const hasStakeholders = proj.stakeholders.devAcc || proj.stakeholders.devCont || 
                                            proj.stakeholders.archAcc || proj.stakeholders.archCont || 
                                            proj.stakeholders.intAcc || proj.stakeholders.intCont || 
                                            proj.stakeholders.contAcc || proj.stakeholders.contCont;

                    return (
                      <div key={proj.id} className={`grid grid-cols-1 xl:grid-cols-12 gap-8 ${pIdx > 0 ? 'pt-8 border-t border-slate-100' : ''}`}>
                        
                        {/* ฝั่งซ้าย */}
                        <div className="col-span-1 xl:col-span-4 flex flex-col justify-start">
                          <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
                            <div className="flex items-start gap-2.5">
                              <span className="w-5 h-5 bg-slate-100 border border-slate-200 rounded-md font-black text-xs text-slate-600 flex items-center justify-center mt-1 shrink-0">
                                {pIdx + 1}
                              </span>
                              <div>
                                <h3 className="text-lg font-bold text-slate-800 leading-tight">{proj.projectName}</h3>
                                <div className="text-xs font-bold text-slate-400 mt-1 space-x-3">
                                  <span>🏷️ <span className="text-sky-600">{proj.categoryName}</span></span>
                                  <span>📐 {proj.projectType}</span>
                                </div>
                              </div>
                            </div>
                            
                            {!order.isCsv && userId !== 'all' && (
                              <EditCheckInModal 
                                orderItemId={proj.orderItemId}
                                projectId={proj.projectId}
                                currentCategoryId={proj.categoryId}
                                currentArea={proj.area}
                                userId={userId}
                                categories={categories}
                              />
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2.5 text-slate-700 font-medium text-[15px] mb-5">
                            <div className="bg-emerald-50 p-1.5 rounded-md border border-emerald-100 text-emerald-600"><Map size={16} /></div> 
                            พื้นที่: <span className="font-black text-emerald-600 text-base">{Number(proj.area).toLocaleString()}</span> ตร.ม.
                          </div>

                          {hasStakeholders && (
                            <div className="mb-5 bg-slate-50/50 p-3.5 rounded-2xl border border-slate-100">
                              <div className="text-[11px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1.5">
                                <Users size={14} className="text-indigo-400" /> ผู้เกี่ยวข้อง
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {(proj.stakeholders.devAcc || proj.stakeholders.devCont) && (
                                  <div className="flex flex-col bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase">Developer</span>
                                    {proj.stakeholders.devCont && <span className="text-xs text-slate-700 font-bold truncate" title={proj.stakeholders.devCont}>{proj.stakeholders.devCont}</span>}
                                    {proj.stakeholders.devAcc && <span className="text-[10px] text-slate-500 truncate">{proj.stakeholders.devAcc}</span>}
                                  </div>
                                )}
                                {(proj.stakeholders.archAcc || proj.stakeholders.archCont) && (
                                  <div className="flex flex-col bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase">Architect</span>
                                    {proj.stakeholders.archCont && <span className="text-xs text-slate-700 font-bold truncate" title={proj.stakeholders.archCont}>{proj.stakeholders.archCont}</span>}
                                    {proj.stakeholders.archAcc && <span className="text-[10px] text-slate-500 truncate">{proj.stakeholders.archAcc}</span>}
                                  </div>
                                )}
                                {(proj.stakeholders.intAcc || proj.stakeholders.intCont) && (
                                  <div className="flex flex-col bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase">Interior</span>
                                    {proj.stakeholders.intCont && <span className="text-xs text-slate-700 font-bold truncate" title={proj.stakeholders.intCont}>{proj.stakeholders.intCont}</span>}
                                    {proj.stakeholders.intAcc && <span className="text-[10px] text-slate-500 truncate">{proj.stakeholders.intAcc}</span>}
                                  </div>
                                )}
                                {(proj.stakeholders.contAcc || proj.stakeholders.contCont) && (
                                  <div className="flex flex-col bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase">Contractor</span>
                                    {proj.stakeholders.contCont && <span className="text-xs text-slate-700 font-bold truncate" title={proj.stakeholders.contCont}>{proj.stakeholders.contCont}</span>}
                                    {proj.stakeholders.contAcc && <span className="text-[10px] text-slate-500 truncate">{proj.stakeholders.contAcc}</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {proj.note && proj.note !== '-' && (
                            <ExpandableNote note={proj.note} />
                          )}

                          <div className="mt-auto pt-3 flex flex-col gap-2">
                            {proj.lat && proj.lng ? (
                              <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-100 w-fit flex items-center gap-1">
                                <MapPin size={12}/> พิกัด: {proj.lat.toFixed(5)}, {proj.lng.toFixed(5)}
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium text-slate-400">ไม่มีพิกัดตำแหน่ง</span>
                            )}
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Device: {proj.device}</span>
                          </div>
                        </div>

                        {/* กลาง: แผนที่ */}
                        <div className="col-span-1 xl:col-span-5">
                          <div className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                            <Map size={14} /> ตำแหน่งที่ตั้ง
                          </div>
                          {order.isCsv ? (
                            <div className="w-full h-48 xl:h-full min-h-[220px] rounded-2xl bg-slate-50 border-[2px] border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                              <FileText size={32} className="mb-2 text-slate-300" />
                              <span className="text-sm font-bold text-slate-500">ข้อมูลนำเข้าจากไฟล์</span>
                            </div>
                          ) : proj.lat && proj.lng ? (
                            <div className="w-full h-48 xl:h-full min-h-[220px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative">
                              <iframe
                                width="100%" height="100%" frameBorder="0" style={{ border: 0 }}
                                src={`https://maps.google.com/maps?q=${proj.lat},${proj.lng}&hl=th&z=15&output=embed`}
                                className="absolute inset-0"
                              />
                            </div>
                          ) : (
                            <div className="w-full h-48 xl:h-full min-h-[220px] rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col items-center justify-center text-slate-400">
                              <MapPin size={32} className="mb-2 opacity-40" />
                              <span className="text-xs font-medium">ไม่มีแผนที่</span>
                            </div>
                          )}
                        </div>

                        {/* ขวา: รูปภาพ */}
                        <div className="col-span-1 xl:col-span-3 flex flex-col overflow-hidden">
                          <div className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                            <ImageIcon size={14} /> รูปภาพหน้างาน ({proj.images.length})
                          </div>
                          <div className="flex-1 min-h-[220px] bg-slate-50 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <ImageGallery images={proj.images} />
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
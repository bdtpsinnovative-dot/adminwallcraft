import { supabase } from '@/lib/supabase';
import { 
  LayoutDashboard, ShoppingCart, Clock, TrendingUp, 
  Calendar, Users, Map, Activity, AlertCircle, Star, Target, Crown, Database
} from 'lucide-react';

import DashboardCharts from '@/components/DashboardCharts';
import DashboardDateFilter from '@/components/DashboardDateFilter';
import AiChatAssistant from '@/components/AiChatAssistant';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { 
    start?: string; end?: string; range?: string;
    sales?: string; projectType?: string; productCategory?: string;
    minArea?: string; maxArea?: string; source?: string;
  };
}) {
  const params = await Promise.resolve(searchParams);

  // --- 1. ดึง Master Data มารอไว้ทั้งหมด ---
  const [
    { data: profiles },
    { data: projectTypes },
    { data: productCategories }
  ] = await Promise.all([
    supabase.from('profiles').select('id, full_name'),
    supabase.from('project_types').select('id, name'),
    supabase.from('product_categories').select('id, name')
  ]);

  const profileMap: Record<string, string> = {};
  profiles?.forEach(p => { profileMap[p.id] = p.full_name; });

  // --- 2. จัดการตัวแปร Filter ---
  let startIso = '';
  let endIso = '';
  if (params?.start) startIso = new Date(`${params.start}T00:00:00+07:00`).toISOString();
  if (params?.end) endIso = new Date(`${params.end}T23:59:59.999+07:00`).toISOString();

  const filterSales = params?.sales || 'ALL';
  const filterProjectType = params?.projectType || 'ALL';
  const filterProductCategory = params?.productCategory || 'ALL';
  const filterSource = params?.source || 'ALL'; 
  const minArea = params?.minArea || '';
  const maxArea = params?.maxArea || '';

  // --- 3. ดึงข้อมูลโปรเจกต์ ---
  let allActiveProjects: any[] = [];
  let isFetching = true;
  let startRow = 0;
  const step = 1000;

  while (isFetching) {
    let query = supabase
      .from('order_item_projects')
      .select(`
        id, project_name, area_sqm, created_at, is_important, project_type_id,
        account_developer, account_architecture, account_interior, account_contractor,
        order_items (
          id, interest_level, images, product_category_id,
          orders (
            id, customer_name, phone, user_id, is_synced, audit_log, source
          )
        )
      `)
      .or('is_deleted.eq.false,is_deleted.is.null')
      .order('created_at', { ascending: false })
      .range(startRow, startRow + step - 1);

    if (startIso) query = query.gte('created_at', startIso);
    if (endIso) query = query.lte('created_at', endIso);
    if (minArea) query = query.gte('area_sqm', minArea);
    if (maxArea) query = query.lte('area_sqm', maxArea);
    if (filterProjectType !== 'ALL') query = query.eq('project_type_id', filterProjectType);

    const { data, error } = await query;

    if (error) {
      console.error("🔥 Dashboard Fetch Error:", error.message);
      break;
    }
    if (data && data.length > 0) {
      allActiveProjects = [...allActiveProjects, ...data];
      startRow += step;
    }
    if (!data || data.length < step) {
      isFetching = false;
    }
  }

  // 🔥 กรองข้อมูล
  const filteredProjects = allActiveProjects.filter(proj => {
    const item = Array.isArray(proj.order_items) ? proj.order_items[0] : proj.order_items;
    const order = item?.orders;
    
    if (filterSales !== 'ALL' && order?.user_id !== filterSales) return false;
    if (filterProductCategory !== 'ALL' && item?.product_category_id !== filterProductCategory) return false;
    
    const isImported = order?.audit_log === null || order?.audit_log === undefined;
    const data_source = isImported ? "IMPORT" : "APP";
    if (filterSource !== 'ALL' && data_source !== filterSource) return false;
    
    return true;
  });

  // --- 4. ประมวลผล Data ---
  const activeProjectsCount = filteredProjects.length;
  const totalAreaSqm = filteredProjects.reduce((sum, proj) => sum + (Number(proj.area_sqm) || 0), 0);

  const nowUTC = new Date();
  const thaiTime = new Date(nowUTC.getTime() + (7 * 60 * 60 * 1000));
  const currentMonth = thaiTime.getUTCMonth();
  const currentYear = thaiTime.getUTCFullYear();
  const currentDate = thaiTime.getUTCDate();

  let monthOrders = 0;
  let todayOrders = 0;
  let importantProjectsCount = 0;
  const pendingSyncOrderIds = new Set();
  
  const salesPerformanceData: Record<string, { count: number, area: number, syncedCount: number, pendingCount: number }> = {};
  const dailyCountMap: Record<string, { date: string, count: number, timestamp: number }> = {};
  
  let sourceMobile = 0, sourceWeb = 0, sourceCSV = 0;
  
  let intVeryHigh = 0, intHigh = 0, intMedium = 0, intFollow = 0, intLow = 0, intNull = 0; 
  let devCount = 0, archCount = 0, intCount = 0, contCount = 0;

  filteredProjects.forEach(proj => {
    const orderItem = Array.isArray(proj.order_items) ? proj.order_items[0] : proj.order_items;
    const order = orderItem?.orders;
    
    const userId = order?.user_id || 'unknown';
    const area = Number(proj.area_sqm) || 0;
    const isSynced = order?.is_synced ?? true;
    
    if (proj.is_important) importantProjectsCount++;

    const auditLog = order?.audit_log;
    const orderSource = order?.source;
    if (orderSource === 'web') sourceWeb += 1;
    else if (!auditLog) sourceCSV += 1;
    else sourceMobile += 1;

    const interest = orderItem?.interest_level || '';
    if (interest.includes('สนใจมาก (มีโครงการ')) intVeryHigh++;
    else if (interest.includes('สนใจมาก')) intHigh++;
    else if (interest.includes('สนใจปานกลาง')) intMedium++;
    else if (interest.includes('ติดตามงาน')) intFollow++;
    else if (interest.includes('สนใจน้อย')) intLow++;
    else intNull++; 

    if (proj.account_developer) devCount++;
    if (proj.account_architecture) archCount++;
    if (proj.account_interior) intCount++;
    if (proj.account_contractor) contCount++;

    if (order && isSynced === false && order.id) pendingSyncOrderIds.add(order.id);

    if (!salesPerformanceData[userId]) {
      salesPerformanceData[userId] = { count: 0, area: 0, syncedCount: 0, pendingCount: 0 };
    }
    salesPerformanceData[userId].count += 1;
    salesPerformanceData[userId].area += area;
    if (isSynced) salesPerformanceData[userId].syncedCount += 1;
    else salesPerformanceData[userId].pendingCount += 1;

    if (proj.created_at) {
      const projDateUTC = new Date(proj.created_at);
      const projThai = new Date(projDateUTC.getTime() + (7 * 60 * 60 * 1000));
      
      if (projThai.getUTCFullYear() === currentYear && projThai.getUTCMonth() === currentMonth) {
        monthOrders++;
        if (projThai.getUTCDate() === currentDate) todayOrders++;
      }

      const day = projThai.getUTCDate().toString().padStart(2, '0');
      const month = (projThai.getUTCMonth() + 1).toString().padStart(2, '0');
      const dateKey = `${day}/${month}`;
      const sortTimestamp = new Date(projThai.getUTCFullYear(), projThai.getUTCMonth(), projThai.getUTCDate()).getTime();

      if (!dailyCountMap[dateKey]) dailyCountMap[dateKey] = { date: dateKey, count: 0, timestamp: sortTimestamp };
      dailyCountMap[dateKey].count++;
    }
  });

  const pendingSync = pendingSyncOrderIds.size;

  const lineChartData = Object.values(dailyCountMap).sort((a, b) => a.timestamp - b.timestamp).slice(-14).map(i => ({ date: i.date, count: i.count }));
  
  // 🔥 คำนวณเปอร์เซ็นต์สำหรับ Source Data
  const totalSource = sourceMobile + sourceCSV + sourceWeb;
  const sourceChartData = [
    { name: `Mobile App (${totalSource > 0 ? Math.round((sourceMobile / totalSource) * 100) : 0}%)`, value: sourceMobile },
    { name: `CSV Upload (${totalSource > 0 ? Math.round((sourceCSV / totalSource) * 100) : 0}%)`, value: sourceCSV },
    { name: `Web Portal (${totalSource > 0 ? Math.round((sourceWeb / totalSource) * 100) : 0}%)`, value: sourceWeb }
  ].filter(d => d.value > 0);
  
  const interestData = [
    { name: 'สนใจมาก (มีโครงการ)', value: intVeryHigh },
    { name: 'สนใจมาก (ยังไม่มี)', value: intHigh },
    { name: 'สนใจปานกลาง', value: intMedium },
    { name: 'ติดตามงาน', value: intFollow },
    { name: 'สนใจน้อย', value: intLow },
    { name: 'ไม่ระบุ / NULL', value: intNull }
  ];

  // 🔥 คำนวณเปอร์เซ็นต์และยอดรวมสำหรับ Stakeholders
  const totalStakeholders = devCount + archCount + intCount + contCount;
  const projDivider = activeProjectsCount > 0 ? activeProjectsCount : 1; // กันส่วนหารเป็น 0
  const stakeholderData = [
    { name: `Developer (${Math.round((devCount / projDivider) * 100)}%)`, count: devCount },
    { name: `Architect (${Math.round((archCount / projDivider) * 100)}%)`, count: archCount },
    { name: `Interior (${Math.round((intCount / projDivider) * 100)}%)`, count: intCount },
    { name: `Contractor (${Math.round((contCount / projDivider) * 100)}%)`, count: contCount }
  ];

  const individualStats = Object.entries(salesPerformanceData)
    .map(([id, stats]) => ({
      id, name: profileMap[id] || (id === 'unknown' ? 'ไม่ระบุ/ไม่มีเซลส์' : 'พนักงานที่ถูกลบ'),
      projects: stats.count, area: stats.area, syncedCount: stats.syncedCount, pendingCount: stats.pendingCount,
      syncRate: stats.count > 0 ? (stats.syncedCount / stats.count) * 100 : 0
    }))
    .sort((a, b) => b.projects - a.projects);

  const pieChartData = individualStats.map(stat => ({ name: stat.name, value: stat.projects }));
  const barChartData = individualStats.slice(0, 10);

  const vipProjects = filteredProjects.filter(p => p.is_important).slice(0, 5);

  const dashboardSummary = {
    totalProjects: activeProjectsCount,
    totalArea: totalAreaSqm,
    vipCount: importantProjectsCount,
    pendingSyncCount: pendingSync,
    topSales: individualStats.slice(0, 3).map(s => ({ name: s.name, projects: s.projects, area: s.area })),
    vipList: vipProjects.map(v => v.project_name),
    sourceStats: { mobile: sourceMobile, web: sourceWeb, csv: sourceCSV },
    interestStats: { hot: intVeryHigh + intHigh, warm: intMedium, cold: intLow + intFollow },
    totalStakeholders: totalStakeholders // ส่งข้อมูลให้ AI รับรู้ยอดรวมด้วย
  };

  return (
    <main className="p-4 md:p-8 bg-slate-50 min-h-screen text-slate-800 font-sans relative">
      
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4 w-full">
        <div className="flex-none">
          <div className="flex items-center gap-2 text-indigo-700 mb-1">
            <LayoutDashboard size={28} className="stroke-[2.5]" />
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Enterprise Overview <span className="text-sm bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-2.5 py-0.5 rounded-full ml-2 shadow-sm align-middle">God Mode</span></h1>
          </div>
          <p className="text-slate-500 text-sm flex items-center gap-1.5">
            <Activity size={14} /> วิเคราะห์ข้อมูลทุกมิติ ทะลวงฐานข้อมูลแบบเรียลไทม์
          </p>
        </div>
        
        {/* แถบตัวกรอง (Filter) */}
        <div className="w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0">
          <DashboardDateFilter 
            salesList={profiles || []}
            projectTypes={projectTypes || []}
            productCategories={productCategories || []}
          />
        </div>
      </div>

      {/* --- KPI Cards --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
                {(params?.start || params?.end || params?.sales || params?.projectType || params?.source) ? 'โปรเจกต์ (ตามเงื่อนไข)' : 'โปรเจกต์ทั้งหมด'}
              </p>
              <h2 className="text-3xl font-extrabold text-slate-800">{activeProjectsCount.toLocaleString()}</h2>
            </div>
            <div className="bg-blue-100 p-2.5 rounded-lg text-blue-600"><ShoppingCart size={22} /></div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <TrendingUp size={14} /> 
            <span>
              {params?.start || params?.end ? 'ตามตัวกรองที่เลือก' : `+${todayOrders} โปรเจกต์ใหม่วันนี้`}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">โปรเจกต์สำคัญ (VIP)</p>
              <h2 className="text-3xl font-extrabold text-rose-600">{importantProjectsCount.toLocaleString()}</h2>
            </div>
            <div className="bg-rose-100 p-2.5 rounded-lg text-rose-600"><Star size={22} className="fill-rose-600" /></div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">พื้นที่ดำเนินการ (ตร.ม.)</p>
              <h2 className="text-3xl font-extrabold text-slate-800">{totalAreaSqm.toLocaleString()}</h2>
            </div>
            <div className="bg-purple-100 p-2.5 rounded-lg text-purple-600"><Map size={22} /></div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">รออัปเดต / ขาดเชื่อมต่อ</p>
              <h2 className="text-3xl font-extrabold text-orange-600">{pendingSync.toLocaleString()}</h2>
            </div>
            <div className="bg-orange-100 p-2.5 rounded-lg text-orange-600"><AlertCircle size={22} /></div>
          </div>
        </div>
      </div>

      {/* ✨ กล่องป้ายสรุปยอดรวมที่นายต้องการครับ */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="bg-blue-50 border border-blue-100 text-blue-700 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition hover:bg-blue-100">
          <Database size={16} />
          รวมข้อมูลที่มีแหล่งที่มา: <span className="text-lg bg-white px-2 rounded-md shadow-sm ml-1 text-blue-800">{totalSource.toLocaleString()}</span> รายการ
        </div>
        <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition hover:bg-indigo-100">
          <Users size={16} />
          ยอดรวมทีมผู้เกี่ยวข้อง (Stakeholders) ทั้งหมด: <span className="text-lg bg-white px-2 rounded-md shadow-sm ml-1 text-indigo-800">{totalStakeholders.toLocaleString()}</span> บทบาท
        </div>
      </div>

      <DashboardCharts 
        lineData={lineChartData} pieData={pieChartData} barData={barChartData}
        sourceData={sourceChartData} interestData={interestData} stakeholderData={stakeholderData}
      />

      {/* --- ตาราง VIP Projects และ Matrix เซลส์ --- */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-rose-50/30">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Crown size={18} className="text-rose-500" /> โปรเจกต์สำคัญที่ต้องติดตาม (VIP Pipeline)
            </h3>
          </div>
          <div className="overflow-x-auto p-0">
            <table className="w-full text-left whitespace-nowrap text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-3 border-b border-slate-200">ชื่อโปรเจกต์</th>
                  <th className="px-5 py-3 border-b border-slate-200">ลูกค้า</th>
                  <th className="px-5 py-3 border-b border-slate-200 text-right">พื้นที่ (ตร.ม.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vipProjects.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-6 text-slate-500">ไม่มีโปรเจกต์ VIP ในช่วงเวลานี้</td></tr>
                ) : (
                  vipProjects.map((proj, idx) => {
                    const orderItem = Array.isArray(proj.order_items) ? proj.order_items[0] : proj.order_items;
                    const order = orderItem?.orders;
                    return (
                      <tr key={proj.id || idx} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-semibold text-slate-800 flex items-center gap-2">
                          <Star size={14} className="text-rose-500 fill-rose-500" /> {proj.project_name || 'ไม่ระบุชื่อ'}
                        </td>
                        <td className="px-5 py-3 text-slate-600">{order?.customer_name || '-'}</td>
                        <td className="px-5 py-3 text-right font-bold text-emerald-600">{Number(proj.area_sqm).toLocaleString()}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-indigo-50/30">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Target size={18} className="text-indigo-600" /> ผลงานทีมปฏิบัติการขาย (Top 5)
            </h3>
          </div>
          <div className="overflow-x-auto p-0">
            <table className="w-full text-left whitespace-nowrap text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-3 border-b border-slate-200">รายชื่อเซลส์</th>
                  <th className="px-5 py-3 border-b border-slate-200 text-center">งาน</th>
                  <th className="px-5 py-3 border-b border-slate-200 text-right">ผลงาน (ตร.ม.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {individualStats.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-6 text-slate-500">ไม่มีข้อมูลการขายในช่วงเวลานี้</td></tr>
                ) : (
                  individualStats.slice(0, 5).map((stat, idx) => (
                    <tr key={stat.id || idx} className="hover:bg-slate-50">
                      <td className="px-5 py-3 flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'}`}>
                          {idx + 1}
                        </div>
                        <span className="font-semibold text-slate-800">{stat.name}</span>
                      </td>
                      <td className="px-5 py-3 text-center text-slate-600">{stat.projects}</td>
                      <td className="px-5 py-3 text-right font-bold text-slate-700">{stat.area.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <AiChatAssistant dashboardData={dashboardSummary} />
    </main>
  );
}
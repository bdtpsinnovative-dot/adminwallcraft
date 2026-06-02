import { supabase } from '@/lib/supabase';
import { 
  LayoutDashboard, ShoppingCart, Clock, TrendingUp, 
  Calendar, Users, Map, Activity, AlertCircle, Star, Target, Database, MapPin
} from 'lucide-react';
import VipPipelineTable from '@/components/VipPipelineTable';
import DashboardCharts from '@/components/DashboardCharts';
import DashboardDateFilter from '@/components/DashboardDateFilter';
import AiChatAssistant from '@/components/AiChatAssistant';
import Link from 'next/link';
import { ChevronRight, Smartphone, FileText } from 'lucide-react';
import { cookies } from 'next/headers'; // 🌟 เพิ่มบรรทัดนี้

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: {
    start?: string; end?: string; range?: string;
    sales?: string; projectType?: string; productCategory?: string;
    minArea?: string; maxArea?: string; source?: string; team?: string;
  };
}) {
  const params = await Promise.resolve(searchParams);

// 🌟 1. ดึงข้อมูลผู้ใช้ปัจจุบัน (Current User) แบบ Server Component
  const cookieStore = await cookies(); // 🌟 เติม await ตรงนี้ครับ
  const token = cookieStore.get('admin_token')?.value;
  let user = null;
  if (token) {
    const { data } = await supabase.auth.getUser(token);
    user = data?.user;
  }

  let currentUserRole = 'user';
  let currentUserTeamId = null;

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, team_id')
      .eq('id', user.id)
      .single();
      
    if (profile) {
      currentUserRole = profile.role;
      currentUserTeamId = profile.team_id;
    }
  }

  // --- 2. ดึง Master Data ---
  const [
    { data: profiles },
    { data: projectTypes },
    { data: productCategories },
    { data: teams },
    { data: customerTypes }
  ] = await Promise.all([
    supabase.from('profiles').select('id, full_name, team_id'), // ดึง team_id มาด้วย
    supabase.from('project_types').select('id, name'),
    supabase.from('product_categories').select('id, name'),
    supabase.from('teams').select('id, team_name').order('team_name'),
    supabase.from('customer_types').select('id, name')
  ]);

  const profileMap: Record<string, string> = {};
  profiles?.forEach(p => { profileMap[p.id] = p.full_name; });

  const projectTypeMap: Record<string, string> = {};
  projectTypes?.forEach(pt => { projectTypeMap[pt.id] = pt.name; });

  // --- 3. จัดการตัวแปร Filter ---
  let startIso = '';
  let endIso = '';
  if (params?.start) startIso = new Date(`${params.start}T00:00:00+07:00`).toISOString();
  if (params?.end) endIso = new Date(`${params.end}T23:59:59.999+07:00`).toISOString();

  // 🌟 บังคับสิทธิ์ตรงนี้: ถ้าไม่ใช่ Admin บังคับ filterTeam เป็นทีมตัวเองทันที
  const filterTeam = currentUserRole === 'admin' ? (params?.team || 'ALL') : currentUserTeamId;
  
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
        id, project_name, area_sqm, created_at, is_important, project_type_id, project_note,
        account_developer, account_architecture, account_interior, account_contractor,
        project_types (name), 
        order_items (
          id, interest_level, images, product_category_id,
          product_categories (name), 
          orders (
            id, customer_name, phone, user_id, team_id, is_synced, audit_log, source
          )
        )
      `)
      .or('is_deleted.eq.false,is_deleted.is.null')
      .order('created_at', { ascending: false })
      .range(startRow, startRow + step - 1);

    if (startIso || endIso) {
        let dateFilter = '';
        if (startIso && endIso) {
            dateFilter = `and(created_at.gte.${startIso},created_at.lte.${endIso})`;
        } else if (startIso) {
            dateFilter = `created_at.gte.${startIso}`;
        } else if (endIso) {
            dateFilter = `created_at.lte.${endIso}`;
        }
        query = query.or(`${dateFilter},is_important.eq.true`); 
    }

    if (minArea) query = query.gte('area_sqm', minArea);
    if (maxArea) query = query.lte('area_sqm', maxArea);
    if (filterProjectType !== 'ALL') query = query.eq('project_type_id', filterProjectType);

    const { data, error } = await query;

    if (error) {
      console.error("Dashboard Fetch Error:", error.message);
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

  // --- กรองข้อมูล ---
  const filteredProjects = allActiveProjects.filter(proj => {
    const item = Array.isArray(proj.order_items) ? proj.order_items[0] : proj.order_items;
    const order = item?.orders;
    
    if (filterSales !== 'ALL' && order?.user_id !== filterSales) return false;
    if (filterTeam !== 'ALL' && order?.team_id !== filterTeam) return false;
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
  const projectTypeCountMap: Record<string, number> = {};

  let intVeryHigh = 0, intHigh = 0, intMedium = 0, intFollow = 0, intLow = 0, intNull = 0; 
  let devCount = 0, archCount = 0, intCount = 0, contCount = 0;

  filteredProjects.forEach(proj => {
    const orderItem = Array.isArray(proj.order_items) ? proj.order_items[0] : proj.order_items;
    const order = orderItem?.orders;
    
    const userId = order?.user_id || 'unknown';
    const area = Number(proj.area_sqm) || 0;
    const isSynced = order?.is_synced ?? true;
    
    if (proj.is_important) importantProjectsCount++;

    const pTypeId = proj.project_type_id;
    const typeName = pTypeId && projectTypeMap[pTypeId] ? projectTypeMap[pTypeId] : 'ไม่ระบุประเภท';
    if (!projectTypeCountMap[typeName]) projectTypeCountMap[typeName] = 0;
    projectTypeCountMap[typeName]++;

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
  
  const projDivider = activeProjectsCount > 0 ? activeProjectsCount : 1;
  const projectTypeChartData = Object.entries(projectTypeCountMap)
    .map(([name, count]) => ({
      name: `${name} (${Math.round((count / projDivider) * 100)}%)`,
      value: count
    }))
    .sort((a, b) => b.value - a.value);

  const interestData = [
    { name: 'สนใจมาก (มีโครงการ)', value: intVeryHigh },
    { name: 'สนใจมาก (ยังไม่มี)', value: intHigh },
    { name: 'สนใจปานกลาง', value: intMedium },
    { name: 'ติดตามงาน', value: intFollow },
    { name: 'สนใจน้อย', value: intLow },
    { name: 'ไม่ระบุ / NULL', value: intNull }
  ];

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
  const barChartData = individualStats; 

  const vipProjects = filteredProjects.filter(p => p.is_important);

  const dashboardSummary = {
    totalProjects: activeProjectsCount,
    totalArea: totalAreaSqm,
    vipCount: importantProjectsCount,
    pendingSyncCount: pendingSync,
    topSales: individualStats.slice(0, 3).map(s => ({ name: s.name, projects: s.projects, area: s.area })),
    vipList: vipProjects.map(v => v.project_name),
    interestStats: { hot: intVeryHigh + intHigh, warm: intMedium, cold: intLow + intFollow },
    totalStakeholders: devCount + archCount + intCount + contCount
  };

  const checkInStats: Record<string, { appCount: number, csvCount: number, totalArea: number, locations: string[] }> = {};

  filteredProjects.forEach(proj => {
    const orderItem = Array.isArray(proj.order_items) ? proj.order_items[0] : proj.order_items;
    const order = orderItem?.orders;
    const userId = order?.user_id || 'unknown';
    const auditLog = order?.audit_log;
    const area = Number(proj.area_sqm) || 0;

    if (!checkInStats[userId]) {
      checkInStats[userId] = { appCount: 0, csvCount: 0, totalArea: 0, locations: [] };
    }

    checkInStats[userId].totalArea += area;

    if (auditLog) {
      checkInStats[userId].appCount += 1;
      if (proj.project_name) checkInStats[userId].locations.push(proj.project_name);
    } else {
      checkInStats[userId].csvCount += 1;
    }
  });

  const checkInList = Object.entries(checkInStats).map(([uId, stats]) => {
    return {
      userId: uId,
      name: profileMap[uId] || (uId === 'unknown' ? 'ไม่ระบุ/ไม่มีเซลส์' : 'พนักงานที่ถูกลบ'),
      appCount: stats.appCount,
      csvCount: stats.csvCount,
      totalArea: stats.totalArea, 
      total: stats.appCount + stats.csvCount,
      sampleLocation: stats.locations.length > 0 ? stats.locations[0] : '-',
    };
  }).sort((a, b) => b.appCount - a.appCount);

  // 🌟 กรองรายชื่อพนักงานและทีมใน Dropdown ให้เห็นตามสิทธิ์
  const visibleTeams = currentUserRole === 'admin' 
    ? (teams || []) 
    : (teams || []).filter(t => t.id === currentUserTeamId);
    
  const visibleSales = currentUserRole === 'admin'
    ? (profiles || [])
    : (profiles || []).filter(p => p.team_id === currentUserTeamId);

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
        
        <div className="w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0">
          <DashboardDateFilter
            salesList={visibleSales}
            projectTypes={projectTypes || []}
            productCategories={productCategories || []}
            teams={visibleTeams}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">PROJETCS ทั้งหมด</p>
              <h2 className="text-3xl font-extrabold text-slate-800">{activeProjectsCount.toLocaleString()}</h2>
            </div>
            <div className="bg-blue-100 p-2.5 rounded-lg text-blue-600"><ShoppingCart size={22} /></div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <TrendingUp size={14} /> 
            <span>+{todayOrders} โปรเจกต์ใหม่วันนี้</span>
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

      <DashboardCharts 
        lineData={lineChartData} 
        pieData={pieChartData} 
        barData={barChartData}
        projectTypeData={projectTypeChartData} 
        interestData={interestData} 
        stakeholderData={stakeholderData}
      />

      <div className="grid grid-cols-1 mb-8">
        <VipPipelineTable 
          projects={filteredProjects} 
          profilesMap={profileMap} 
          salesStats={individualStats} 
          customerTypes={customerTypes || []}
          projectTypes={projectTypes || []} 
          productCategories={productCategories || []} 
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col mb-8">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <MapPin size={18} className="text-slate-600" /> สถิติการลงพื้นที่สร้างโปรเจกต์ (Check-ins & Data Import)
          </h3>
        </div>
       <div className="overflow-x-auto p-0">
          <table className="w-full text-left whitespace-nowrap text-sm">
            <thead className="bg-slate-100 text-slate-500 text-xs uppercase font-bold tracking-wider">
              <tr>
                <th className="px-5 py-3 border-b border-slate-200">รายชื่อพนักงานขาย</th>
                <th className="px-5 py-3 border-b border-slate-200 text-center">ลงพื้นที่ (App)</th>
                <th className="px-5 py-3 border-b border-slate-200 text-center">อัปโหลดไฟล์ (CSV)</th>
                <th className="px-5 py-3 border-b border-slate-200">ตัวอย่างสถานที่ล่าสุด</th>
                <th className="px-5 py-3 border-b border-slate-200 text-right">พื้นที่รวม (ตร.ม.)</th>
                <th className="px-5 py-3 border-b border-slate-200 text-center">ดูข้อมูล</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {checkInList.map((ci, idx) => (
                <tr key={ci.userId || idx} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-semibold text-slate-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shadow-sm">
                      {ci.name !== 'ไม่ระบุ/ไม่มีเซลส์' && ci.name !== 'พนักงานที่ถูกลบ' ? ci.name.charAt(0) : '?'}
                    </div>
                    {ci.name}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className="inline-flex items-center gap-1.5 font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                      <Smartphone size={14} /> {ci.appCount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className="inline-flex items-center gap-1.5 font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                      <FileText size={14} /> {ci.csvCount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    <span className="truncate max-w-[250px] inline-block align-bottom" title={ci.sampleLocation}>
                      {ci.sampleLocation}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-black text-base text-slate-700">
                    {ci.totalArea.toLocaleString()} <span className="text-xs font-bold text-slate-400 ml-0.5">ตร.ม.</span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <Link 
                      href={`/dashboard/checkins/${ci.userId}`} 
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors border border-indigo-100 shadow-sm"
                    >
                      ดูประวัติ <ChevronRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <AiChatAssistant dashboardData={dashboardSummary} />
    </main>
  );
}
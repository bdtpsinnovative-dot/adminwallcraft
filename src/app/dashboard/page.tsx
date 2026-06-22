// src/app/dashboard/page.tsx
import { supabase } from '@/lib/supabase';
import { 
  LayoutDashboard, ShoppingCart, Clock, TrendingUp, 
  Calendar, Users, Map, Activity, AlertCircle, Star, Target, Database, MapPin, Building2, Scaling
} from 'lucide-react';
import VipPipelineTable from '@/components/VipPipelineTable';
import DashboardCharts from '@/components/DashboardCharts';
import DashboardDateFilter from '@/components/DashboardDateFilter';
import AiChatAssistant from '@/components/AiChatAssistant';
import Link from 'next/link';
import { ChevronRight, Smartphone, FileText } from 'lucide-react';
import { cookies } from 'next/headers';
import CompanyCandlestickChart from '@/components/CompanyCandlestickChart';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: {
    start?: string; end?: string; range?: string;
    sales?: string; projectType?: string; productCategory?: string;
    customerType?: string; 
    minArea?: string; maxArea?: string; source?: string; team?: string;
  };
}) {
  const params = await Promise.resolve(searchParams);

  const masterDataPromise = Promise.all([
    supabase.from('profiles').select('id, full_name, team_id'),
    supabase.from('project_types').select('id, name'),
    supabase.from('product_categories').select('id, name'),
    supabase.from('teams').select('id, team_name').order('team_name'),
    supabase.from('customer_types').select('id, name')
  ]);

  const cookieStore = await cookies();
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

  const [
    { data: profiles },
    { data: projectTypes },
    { data: productCategories },
    { data: teams },
    { data: customerTypes }
  ] = await masterDataPromise;

  const profileMap: Record<string, string> = {};
  profiles?.forEach(p => { profileMap[p.id] = p.full_name; });

  const projectTypeMap: Record<string, string> = {};
  projectTypes?.forEach(pt => { projectTypeMap[pt.id] = pt.name; });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  thirtyDaysAgo.setHours(0, 0, 0, 0); 

  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  let startIso = params?.start 
    ? new Date(`${params.start}T00:00:00+07:00`).toISOString() 
    : thirtyDaysAgo.toISOString();
    
  let endIso = params?.end 
    ? new Date(`${params.end}T23:59:59.999+07:00`).toISOString() 
    : endOfToday.toISOString();

  const filterTeam = currentUserRole === 'admin' ? (params?.team || 'ALL') : currentUserTeamId;
  const filterSales = params?.sales || 'ALL';
  const filterProjectType = params?.projectType || 'ALL';
  const filterProductCategory = params?.productCategory || 'ALL';
  const filterSource = params?.source || 'ALL';
  const filterCustomerType = params?.customerType || 'ALL'; 
  const minArea = params?.minArea || '';
  const maxArea = params?.maxArea || '';

  const buildBaseQueryWithoutArea = () => {
    let q = supabase
      .from('order_item_projects')
      .select(`
        id, project_name, area_sqm, created_at, is_important, project_type_id, project_note,
        account_developer, account_architecture, account_interior, account_contractor,
        queue_level, project_year, 
        project_types (name), 
        order_items!inner (
          id, note, interest_level, images, product_category_id,
          product_categories (name), 
          orders!inner (
            id, customer_name, phone, user_id, team_id, is_synced, audit_log, source, customer_type_id,
            companies (id, name) 
          )
        )
      `, { count: 'exact' }) 
      .or('is_deleted.eq.false,is_deleted.is.null')
      .gte('created_at', startIso)
      .lte('created_at', endIso);
    
    if (filterProjectType !== 'ALL') q = q.eq('project_type_id', filterProjectType);
    if (filterProductCategory !== 'ALL') q = q.eq('order_items.product_category_id', filterProductCategory);
    if (filterSales !== 'ALL') q = q.eq('order_items.orders.user_id', filterSales);
    if (filterTeam !== 'ALL') q = q.eq('order_items.orders.team_id', filterTeam);
    if (filterCustomerType !== 'ALL') q = q.eq('order_items.orders.customer_type_id', filterCustomerType);

    if (filterSource === 'APP') {
      q = q.not('order_items.orders.audit_log', 'is', null);
    } else if (filterSource === 'IMPORT') {
      q = q.is('order_items.orders.audit_log', null);
    }
    
    return q;
  };

  const { count: rawTotalCount, error: rawCountError } = await buildBaseQueryWithoutArea().range(0, 0);
  let allRawProjects: any[] = [];
  
  if (rawTotalCount && rawTotalCount > 0) {
    const PAGE_SIZE = 1000;
    const promises = [];
    for (let offset = 0; offset < rawTotalCount; offset += PAGE_SIZE) {
      promises.push(buildBaseQueryWithoutArea().order('created_at', { ascending: false }).range(offset, offset + PAGE_SIZE - 1));
    }
    const results = await Promise.all(promises);
    results.forEach(({ data }) => {
      if (data) allRawProjects = [...allRawProjects, ...data];
    });
  }

  const areaCounts = { ZERO: 0, XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
  allRawProjects.forEach(p => {
    const a = Number(p.area_sqm) || 0;
    if (a === 0) areaCounts.ZERO++;
    else if (a <= 30) areaCounts.XS++;
    else if (a <= 100) areaCounts.S++;
    else if (a <= 300) areaCounts.M++;
    else if (a <= 500) areaCounts.L++;
    else if (a <= 1000) areaCounts.XL++;
    else areaCounts.XXL++;
  });

  const allActiveProjects = allRawProjects.filter(p => {
    const a = Number(p.area_sqm) || 0;
    if (minArea && a < Number(minArea)) return false;
    if (maxArea && a > Number(maxArea)) return false;
    return true;
  });

  const companyStats: Record<string, { id: string, name: string, count: number, salesBreakdown: Record<string, number> }> = {};
  const uniqueSalesNamesForChart = new Set<string>();

  allActiveProjects.forEach(proj => {
    const orderItem = Array.isArray(proj.order_items) ? proj.order_items[0] : proj.order_items;
    const order = orderItem?.orders;
    const company = order?.companies;
    
    if (!order?.audit_log) return;

    const userId = order?.user_id || 'unknown';
    const salesName = profileMap[userId] || (userId === 'unknown' ? 'ไม่ระบุ/ไม่มีเซลส์' : 'พนักงานที่ถูกลบ');

    if (company && company.name && company.id) {
      const cName = company.name;
      if (!companyStats[cName]) companyStats[cName] = { id: company.id, name: cName, count: 0, salesBreakdown: {} };
      companyStats[cName].count += 1; 
      if (!companyStats[cName].salesBreakdown[salesName]) companyStats[cName].salesBreakdown[salesName] = 0;
      companyStats[cName].salesBreakdown[salesName] += 1;
      uniqueSalesNamesForChart.add(salesName);
    }
  });

  const candlestickData = Object.values(companyStats)
    .map(comp => ({ id: comp.id, name: comp.name, count: comp.count, ...comp.salesBreakdown }))
    .sort((a, b) => b.count - a.count);

  const chartSalesKeys = Array.from(uniqueSalesNamesForChart);
  const activeProjectsCount = allActiveProjects.length; 
  const totalAreaSqm = allActiveProjects.reduce((sum, proj) => sum + (Number(proj.area_sqm) || 0), 0);
  
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

  allActiveProjects.forEach(proj => {
    const orderItem = Array.isArray(proj.order_items) ? proj.order_items[0] : proj.order_items;
    const order = orderItem?.orders;
    
    const userId = order?.user_id || 'unknown';
    const area = Number(proj.area_sqm) || 0;
    const isSynced = order?.is_synced ?? true;
    
    if (proj.is_important) importantProjectsCount++;

    const pTypeId = proj.project_type_id;
    const typeName = pTypeId && projectTypeMap[pTypeId] ? projectTypeMap[pTypeId] : 'ไม่ระบุประเภท';
    
    if (typeName !== 'ไม่ระบุประเภท' && typeName !== 'ไม่ระบุ' && typeName !== 'Unspecified' && typeName !== 'Unknown' && typeName !== '') {
        if (!projectTypeCountMap[typeName]) projectTypeCountMap[typeName] = 0;
        projectTypeCountMap[typeName]++;
    }

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
  
  const totalSpecifiedProjectsCount = Object.values(projectTypeCountMap).reduce((sum, count) => sum + count, 0);
  const projDividerForTypes = totalSpecifiedProjectsCount > 0 ? totalSpecifiedProjectsCount : 1;

  const projectTypeChartData = Object.entries(projectTypeCountMap)
    .map(([name, count]) => ({
      name: `${name} (${Math.round((count / projDividerForTypes) * 100)}%)`,
      value: count
    }))
    .sort((a, b) => b.value - a.value);

  const projDivider = activeProjectsCount > 0 ? activeProjectsCount : 1;
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

  const vipProjects = allActiveProjects.filter(p => p.is_important);

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

  allActiveProjects.forEach(proj => {
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

  const visibleTeams = currentUserRole === 'admin' 
    ? (teams || []) 
    : (teams || []).filter(t => t.id === currentUserTeamId);
    
  const visibleSales = currentUserRole === 'admin'
    ? (profiles || [])
    : (profiles || []).filter(p => p.team_id === currentUserTeamId);

  return (
    <main className="p-4 md:p-8 bg-slate-50 min-h-screen text-slate-800 font-sans relative">
      
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4 w-full">
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
            customerTypes={customerTypes || []}
            areaCounts={areaCounts}
          />
        </div>
      </div>

      {/* 🌟 ชุดปุ่ม SIZE ทั้ง 7 ปรับโฉมใหม่: ตัวเลขตรงกลาง และชื่อไซส์อยู่ล่างนำหน้าช่วง ตร.ม. 🌟 */}
      <div className="mb-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Scaling size={20} className="stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-800 tracking-tight">ขนาดโปรเจ็ก SQM</h3>
        
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3.5">
          {[
            { id: 'ZERO', label: '0 sqm.', min: '0', max: '0', subtitle: 'ไม่มีพื้นที่' },
            { id: 'XS', label: 'XS', min: '1', max: '30', subtitle: 'ต่ำกว่า 30 sqm' },
            { id: 'S', label: 'S', min: '31', max: '100', subtitle: '31 - 100 sqm.' },
            { id: 'M', label: 'M', min: '101', max: '300', subtitle: '101 - 300 sqm.' },
            { id: 'L', label: 'L', min: '301', max: '500', subtitle: '301 - 500 sqm.' },
            { id: 'XL', label: 'XL', min: '501', max: '1000', subtitle: '501 - 1,000 sqm.' },
            { id: 'XXL', label: 'XXL', min: '1001', max: '', subtitle: 'มากกว่า 1,000 sqm.' },
          ].map((btn) => {
            const isActive = minArea === btn.min && maxArea === btn.max;
            const projectCount = areaCounts[btn.id as keyof typeof areaCounts] || 0;
            
            const q = new URLSearchParams();
            if (params) {
              Object.entries(params).forEach(([k, v]) => {
                if (v && typeof v === 'string') q.set(k, v);
              });
            }
            if (isActive) {
              q.delete('minArea');
              q.delete('maxArea');
            } else {
              if (btn.min) q.set('minArea', btn.min); else q.delete('minArea');
              if (btn.max) q.set('maxArea', btn.max); else q.delete('maxArea');
            }
            const href = `?${q.toString()}`;

            return (
              <Link
                key={btn.id}
                href={href}
                className={`flex flex-col items-center justify-center py-4 px-3 rounded-xl border transition-all duration-200 group relative overflow-hidden min-h-[105px] ${
                  isActive 
                    ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 border-indigo-600 text-white shadow-md shadow-indigo-200 ring-2 ring-indigo-600 ring-offset-2 ring-offset-white scale-[1.03] z-10' 
                    : 'bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-white hover:border-indigo-500 hover:shadow-md hover:shadow-slate-100'
                }`}
              >
                {!isActive && (
                  <span className="absolute inset-x-0 bottom-0 h-1 bg-indigo-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200" />
                )}

                {/* 🟢 ตรงกลาง: แสดงจำนวนโปรเจกต์รวมเป็นตัวเลขตัวใหญ่พรีเมียม */}
                <span className={`font-black text-3xl md:text-4xl tracking-tight mb-1.5 ${
                  isActive ? 'text-white' : 'text-slate-800 group-hover:text-indigo-600 transition-colors'
                }`}>
                  {projectCount}
                </span>

                {/* 🟢 ด้านล่าง: เอาอักษรย่อไซส์มาตั้งนำหน้าช่วงพื้นที่ ตร.ม. */}
                <span className={`text-[11px] font-bold text-center leading-normal ${
                  isActive ? 'text-indigo-100' : 'text-slate-400 group-hover:text-slate-500 transition-colors'
                }`}>
                  {btn.id === 'ZERO' ? btn.label : `${btn.label} (${btn.subtitle})`}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* กล่องตัวเลข 4 กล่อง (ของเดิม) */}
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

      <CompanyCandlestickChart data={candlestickData} salesKeys={chartSalesKeys} />

      <div className="grid grid-cols-1 mb-8">
        <VipPipelineTable 
          projects={allActiveProjects} 
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
                      target="_blank" 
                      rel="noopener noreferrer" 
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
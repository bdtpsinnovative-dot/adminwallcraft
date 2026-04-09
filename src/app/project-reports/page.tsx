'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Trophy, BarChart2, Activity, Sigma, PieChart, Users, ChevronDown, FilterX
} from 'lucide-react';
// ✅ Import Recharts สำหรับทำกราฟ
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, PieChart as RePie, Pie, Cell 
} from 'recharts';

// --- Types ---
type ProjectData = { id: string; is_deleted: boolean | null; };
type ItemData = { id: string; order_item_projects: ProjectData[]; };
type OrderData = { id: string; user_id: string | null; company_id: string | null; customer_type_id: string | null; order_items: ItemData[]; };
type ProfileData = { id: string; full_name: string; };

const COLORS = ['#4f46e5', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#f59e0b', '#f97316'];

export default function UltimateCategoryDashboard() {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>(null);

  // ✅ State สำหรับตัวกรองรายคน
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('ALL');

  // ดึงรายชื่อ Profiles
  useEffect(() => {
     const fetchProfiles = async () => {
        const { data } = await supabase.from('profiles').select('id, full_name').order('full_name');
        if (data) setProfiles(data);
     };
     fetchProfiles();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 🚀 1. ฟังก์ชันตัวตึง: ดึงข้อมูลแบบทะลวงลิมิต 1000 บรรทัด
        const fetchAllRecords = async (table: string, selectQuery: string) => {
          let allData: any[] = [];
          let from = 0;
          const step = 1000;
          while (true) {
            const { data, error } = await supabase.from(table).select(selectQuery).range(from, from + step - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            allData = allData.concat(data);
            if (data.length < step) break; 
            from += step;
          }
          return allData;
        };

        // 🚀 2. ดึงข้อมูล 3 ตารางแยกกัน (🔥 เพิ่ม user_id ใน orders เพื่อให้กรองได้)
        const allCats = await fetchAllRecords('customer_types', 'id, name');
        const allComps = await fetchAllRecords('companies', 'id, name, customer_type_id');
        const allOrders = await fetchAllRecords('orders', 'id, company_id, customer_type_id, user_id, order_items(id, order_item_projects(id, is_deleted))');

        // 🚀 3. เตรียมกระบะ (Map)
        const catMap: Record<string, any> = {};
        allCats.forEach(c => {
          catMap[c.id] = { id: c.id, name: c.name, companies: {} };
        });
        catMap['uncategorized'] = { id: 'uncategorized', name: 'ไม่มีหมวดหมู่ (Uncategorized)', companies: {} };

        // 🚀 4. เอาบริษัทมาใส่กระบะหมวดหมู่
        allComps.forEach(comp => {
          const catId = comp.customer_type_id || 'uncategorized';
          if (!catMap[catId]) catMap[catId] = { id: catId, name: 'หมวดหมู่อื่นๆ', companies: {} };
          catMap[catId].companies[comp.id] = { ...comp, projectCount: 0 };
        });

        // 🚀 5. เอาออเดอร์มานับโปรเจกต์ (แบบของนายเป๊ะๆ)
        allOrders.forEach((order: any) => {
          
          // 🔥 ฟิลเตอร์ตัวตึง! ถ้าเลือกคนอยู่ แล้วไม่ใช่ของคนนั้น ให้ข้ามทันที
          if (selectedUserId !== 'ALL' && order.user_id !== selectedUserId) return;

          let pCount = 0;
          if (order.order_items) {
            order.order_items.forEach((item: any) => {
              if (item.order_item_projects) {
                item.order_item_projects.forEach((p: any) => {
                  if (p.is_deleted !== true) pCount++;
                });
              }
            });
          }

          if (pCount === 0) return;

          let targetCatId = 'uncategorized';
          const targetCompId = order.company_id;

          if (targetCompId) {
            const comp = allComps.find(c => c.id === targetCompId);
            if (comp) targetCatId = comp.customer_type_id || 'uncategorized';
          } else {
            targetCatId = order.customer_type_id || 'uncategorized';
          }

          if (!catMap[targetCatId]) catMap[targetCatId] = { id: targetCatId, name: 'หมวดหมู่อื่นๆ', companies: {} };

          if (targetCompId && catMap[targetCatId].companies[targetCompId]) {
            catMap[targetCatId].companies[targetCompId].projectCount += pCount;
          } else {
            const mockId = 'mock-' + targetCatId;
            if (!catMap[targetCatId].companies[mockId]) {
              catMap[targetCatId].companies[mockId] = {
                id: mockId, name: 'ลูกค้าทั่วไป (ไม่ระบุบริษัท)', projectCount: 0, isMock: true
              };
            }
            catMap[targetCatId].companies[mockId].projectCount += pCount;
          }
        });

        // 🚀 6. คำนวณสถิติเพื่อเอาไปโชว์
        const processed = Object.values(catMap).map((cat: any) => {
          const compArray = Object.values(cat.companies) as any[];
          const actualComps = compArray.filter(c => !c.isMock || c.projectCount > 0);

          const totalCount = actualComps.length;
          const activeCount = actualComps.filter(c => c.projectCount > 0).length;
          const inactiveCount = totalCount - activeCount;
          const totalProjects = actualComps.reduce((sum, c) => sum + c.projectCount, 0);

          return {
            id: cat.id,
            name: cat.name,
            total: totalCount,
            active: activeCount,
            inactive: inactiveCount,
            projectCount: totalProjects,
            activeRate: totalCount > 0 ? parseFloat(((activeCount / totalCount) * 100).toFixed(1)) : 0,
            inactiveRate: totalCount > 0 ? parseFloat(((inactiveCount / totalCount) * 100).toFixed(1)) : 0
          };
        }).filter(cat => cat.total > 0 || cat.projectCount > 0)
          .sort((a, b) => b.projectCount - a.projectCount);

        const grandTotal = processed.reduce((acc, curr) => ({
          total: acc.total + curr.total,
          active: acc.active + curr.active,
          inactive: acc.inactive + curr.inactive,
          projectCount: acc.projectCount + curr.projectCount
        }), { total: 0, active: 0, inactive: 0, projectCount: 0 });

        const grandActiveRate = grandTotal.total > 0 ? parseFloat(((grandTotal.active / grandTotal.total) * 100).toFixed(1)) : 0;
        const grandInactiveRate = grandTotal.total > 0 ? parseFloat(((grandTotal.inactive / grandTotal.total) * 100).toFixed(1)) : 0;

        setDashboardData(processed);
        setTotals({ ...grandTotal, activeRate: grandActiveRate, inactiveRate: grandInactiveRate });

      } catch (err) {
        console.error("Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedUserId]); // 🔥 โหลดใหม่ทุกครั้งที่เปลี่ยนคน

  if (loading && dashboardData.length === 0) return (
    <div className="p-20 text-center flex flex-col items-center justify-center min-h-screen bg-white">
      <div className="relative w-20 h-20">
        <div className="absolute top-0 left-0 w-full h-full border-8 border-slate-100 rounded-full"></div>
        <div className="absolute top-0 left-0 w-full h-full border-8 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
      </div>
      <p className="mt-6 text-slate-400 font-bold animate-pulse tracking-widest">LOADING 1800+ RECORDS...</p>
    </div>
  );

  return (
    <div className="p-4 md:p-10 bg-[#FCFDFF] min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* --- ส่วนหัว และ ตัวกรองรายคน --- */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
              <div className="flex items-center gap-2 text-indigo-500 font-black text-[10px] uppercase tracking-[0.3em] mb-3">
                <Activity size={14} /> Intelligence System
              </div>
              <h1 className="text-5xl font-black text-slate-900 tracking-tight">
                Business <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">Summary</span>
              </h1>
            </div>

            {/* ✅ กล่อง Filter */}
            <div className="bg-white p-3 rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                    <Users size={18} />
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Filter By Sales / User</span>
                    <div className="relative">
                        <select 
                            className="appearance-none bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold rounded-lg pl-3 pr-10 py-1.5 outline-none cursor-pointer hover:border-indigo-400 transition-colors w-[220px]"
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            disabled={loading}
                        >
                            <option value="ALL">🌟 ดูยอดรวมทุกคน (All Users)</option>
                            {profiles.map(p => (
                                <option key={p.id} value={p.id}>{p.full_name || 'ไม่ระบุชื่อ'}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
                    </div>
                </div>
                {selectedUserId !== 'ALL' && (
                    <button 
                        onClick={() => setSelectedUserId('ALL')}
                        className="p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-colors ml-1"
                        title="เคลียร์ตัวกรอง"
                    >
                        <FilterX size={18} />
                    </button>
                )}
            </div>
        </div>

        {/* --- ส่วนตาราง --- */}
        <div className={`bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden transition-opacity duration-300 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          <div className="p-8 border-b border-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-slate-900 rounded-2xl text-white shadow-xl">
                <BarChart2 size={24} />
              </div>
              <div>
                <h2 className="font-black text-2xl text-slate-800">Leaderboard</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                   {selectedUserId === 'ALL' ? 'Overall Network Performance' : 'Individual Sales Performance'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="bg-slate-50/30 text-slate-400 uppercase text-[10px] font-black tracking-widest border-b border-slate-50">
                  <th className="px-8 py-6 text-center">Rank</th>
                  <th className="px-6 py-6">Category</th>
                  <th className="px-6 py-6 text-center">Total Co.</th>
                  <th className="px-6 py-6 text-center text-emerald-600">Active</th>
                  <th className="px-6 py-6 text-center text-rose-500">Inactive</th>
                  <th className="px-8 py-6 text-center">Active %</th>
                  <th className="px-8 py-6 text-center">Inactive %</th>
                  <th className="px-8 py-6 text-right text-indigo-600">Projects</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {dashboardData.map((cat, index) => (
                  <tr key={cat.id} className="hover:bg-slate-50/50 transition-all duration-300">
                    <td className="px-8 py-8 text-center">
                      {index === 0 ? <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center shadow-md mx-auto text-white"><Trophy size={20} /></div> : 
                       index === 1 ? <div className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center mx-auto text-slate-500"><Trophy size={18} /></div> :
                       index === 2 ? <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center mx-auto text-orange-600"><Trophy size={18} /></div> :
                       <span className="text-slate-300 font-black text-lg">{index + 1}</span>}
                    </td>
                    <td className="px-6 py-8"><span className="font-black text-slate-700 text-lg">{cat.name}</span></td>
                    <td className="px-6 py-8 text-center font-bold text-slate-400">{cat.total}</td>
                    <td className="px-6 py-8 text-center font-black text-emerald-500">{cat.active}</td>
                    <td className="px-6 py-8 text-center font-black text-rose-400">{cat.inactive}</td>
                    
                    <td className="px-8 py-8 border-l border-slate-50">
                      <div className="flex flex-col items-center gap-2">
                        <span className="font-black text-emerald-600 text-lg">{cat.activeRate ?? 0}%</span>
                        <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                          <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${cat.activeRate ?? 0}%` }}></div>
                        </div>
                      </div>
                    </td>

                    <td className="px-8 py-8">
                      <div className="flex flex-col items-center gap-2">
                        <span className={`font-black text-lg ${(cat.inactiveRate ?? 0) > 50 ? 'text-rose-600' : 'text-slate-400'}`}>{cat.inactiveRate ?? 0}%</span>
                        <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                          <div className="h-full bg-rose-400 rounded-full transition-all duration-1000" style={{ width: `${cat.inactiveRate ?? 0}%` }}></div>
                        </div>
                      </div>
                    </td>

                    <td className="px-8 py-8 text-right font-black text-indigo-600 text-2xl">{cat.projectCount ?? 0}</td>
                  </tr>
                ))}

                {/* ✅ Grand Total (ยอดรวมทั้งหมด) */}
                {totals && (
                  <tr className="bg-white border-t-4 border-indigo-600 relative z-10 shadow-[0_-15px_30px_rgba(99,102,241,0.08)]">
                    <td className="px-8 py-10 text-center">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto border-2 border-indigo-100 shadow-inner"><Sigma size={24} /></div>
                    </td>
                    <td className="px-6 py-10">
                      <div className="flex flex-col">
                        <span className="text-2xl font-black tracking-tighter text-slate-900 uppercase">Grand Total</span>
                        <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Network Performance</span>
                      </div>
                    </td>
                    <td className="px-6 py-10 text-center text-2xl font-black text-slate-400">{totals.total}</td>
                    <td className="px-6 py-10 text-center"><div className="text-emerald-600 font-black text-2xl underline decoration-emerald-200 underline-offset-4">{totals.active}</div></td>
                    <td className="px-6 py-10 text-center"><div className="text-rose-500 font-black text-2xl underline decoration-rose-100 underline-offset-4">{totals.inactive}</div></td>
                    
                    <td className="px-8 py-10 text-center bg-indigo-50/30">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-3xl font-black text-indigo-600">{totals.activeRate ?? 0}%</span>
                        <div className="w-24 h-2.5 bg-indigo-200/50 rounded-full overflow-hidden shadow-inner">
                          <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${totals.activeRate ?? 0}%` }}></div>
                        </div>
                      </div>
                    </td>

                    <td className="px-8 py-10 text-center bg-rose-50/30">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-3xl font-black text-rose-500">{totals.inactiveRate ?? 0}%</span>
                        <div className="w-24 h-2.5 bg-rose-200/50 rounded-full overflow-hidden shadow-inner">
                          <div className="h-full bg-rose-500 rounded-full transition-all duration-1000" style={{ width: `${totals.inactiveRate ?? 0}%` }}></div>
                        </div>
                      </div>
                    </td>

                    <td className="px-8 py-10 text-right bg-indigo-600">
                      <div className="flex flex-col items-end">
                        <span className="text-5xl font-black text-white tracking-tighter">{totals.projectCount ?? 0}</span>
                        <span className="text-[11px] text-indigo-200 font-bold uppercase tracking-widest mt-1">Total Projects</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ✅ ส่วนกราฟ (Visualizations) */}
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 transition-opacity duration-300 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100">
             <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><PieChart size={20} /></div>
                <h3 className="font-black text-xl text-slate-800 tracking-tight">Project Distribution</h3>
             </div>
             <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RePie>
                    <Pie data={dashboardData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="projectCount">
                      {dashboardData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} itemStyle={{ fontWeight: 'bold' }} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}/>
                  </RePie>
                </ResponsiveContainer>
             </div>
          </div>
          
          <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100">
             <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><BarChart2 size={20} /></div>
                <h3 className="font-black text-xl text-slate-800 tracking-tight">Company Engagement</h3>
             </div>
             <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8' }} />
                    <YAxis fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8' }} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }} />
                    <Bar dataKey="active" name="Active Co." fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="inactive" name="Inactive Co." fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
             </div>
          </div>
        </div>

        <div className="mt-8 text-center pb-10">
           <span className="px-6 py-3 bg-white border border-slate-100 rounded-full text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] shadow-sm">
             Verified Data Analysis Engine - Filter Supported
           </span>
        </div>

      </div>
    </div>
  );
}
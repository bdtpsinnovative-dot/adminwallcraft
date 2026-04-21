'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { ShoppingCart, Search, Calendar, User, Building2, Activity } from 'lucide-react';
import Link from 'next/link';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      let all: any[] = [];
      let from = 0;
      const step = 1000;

      const [{ data: profiles }, { data: companies }, { data: productCats }] = await Promise.all([
        supabase.from('profiles').select('id, full_name'),
        supabase.from('companies').select('id, name'),
        supabase.from('product_categories').select('id, name'),
      ]);

      const profileMap: Record<string, string> = {};
      profiles?.forEach((p: any) => { profileMap[p.id] = p.full_name; });
      const companyMap: Record<string, string> = {};
      companies?.forEach((c: any) => { companyMap[c.id] = c.name; });
      const catMap: Record<string, string> = {};
      productCats?.forEach((c: any) => { catMap[c.id] = c.name; });

      while (true) {
        const { data, error } = await supabase
          .from('orders')
          .select('id, customer_name, phone, source, created_at, user_id, company_id, order_items(id, product_category_id, order_item_projects(id, is_deleted))')
          .order('created_at', { ascending: false })
          .range(from, from + step - 1);
        if (error || !data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < step) break;
        from += step;
      }

      const enriched = all.map((o: any) => {
        const allProjects = (o.order_items || []).flatMap((i: any) => i.order_item_projects || []);
        const activeProjects = allProjects.filter((p: any) => !p.is_deleted);
        const cats = [...new Set((o.order_items || []).map((i: any) => catMap[i.product_category_id]).filter(Boolean))];
        return {
          ...o,
          user_name: o.user_id ? (profileMap[o.user_id] || 'ไม่พบชื่อ') : null,
          company_name: o.company_id ? (companyMap[o.company_id] || null) : null,
          total_projects: activeProjects.length,
          categories: cats,
        };
      });

      setOrders(enriched);
      setLoading(false);
    };
    fetchOrders();
  }, []);

  const filtered = useMemo(() => {
    return orders.filter(o => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.company_name || '').toLowerCase().includes(q) ||
        (o.user_name || '').toLowerCase().includes(q) ||
        (o.source || '').toLowerCase().includes(q);
      const d = (o.created_at || '').slice(0, 10);
      const matchStart = !startDate || d >= startDate;
      const matchEnd = !endDate || d <= endDate;
      return matchSearch && matchStart && matchEnd;
    });
  }, [orders, search, startDate, endDate]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-8 border-slate-100 rounded-full" />
        <div className="absolute inset-0 border-8 border-indigo-600 rounded-full border-t-transparent animate-spin" />
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-10 bg-[#FCFDFF] min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-indigo-500 font-black text-[10px] uppercase tracking-[0.3em] mb-3">
            <Activity size={14} /> Orders Management
          </div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tight">
            All <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">Orders</span>
          </h1>
          <p className="text-slate-400 font-bold mt-1 text-sm">{orders.length.toLocaleString()} orders ทั้งหมด</p>
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาลูกค้า / บริษัท / sale / source..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-2.5 text-sm font-medium border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-indigo-400 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-slate-400" />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="px-3 py-2.5 text-sm font-medium border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-indigo-400" />
            <span className="text-slate-300 font-black">—</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="px-3 py-2.5 text-sm font-medium border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-indigo-400" />
          </div>
          {(search || startDate || endDate) && (
            <button onClick={() => { setSearch(''); setStartDate(''); setEndDate(''); }}
              className="px-3 py-2 text-xs font-black text-slate-400 hover:text-slate-600 bg-slate-100 rounded-xl transition-colors">
              ล้าง
            </button>
          )}
          <span className="ml-auto text-xs font-black text-slate-400">{filtered.length.toLocaleString()} รายการ</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="bg-slate-50/30 text-slate-400 uppercase text-[10px] font-black tracking-widest border-b border-slate-100">
                  <th className="px-6 py-5 text-center w-10">#</th>
                  <th className="px-6 py-5">ลูกค้า</th>
                  <th className="px-6 py-5">บริษัท</th>
                  <th className="px-6 py-5">Sale</th>
                  <th className="px-6 py-5 text-center">โปรเจกต์</th>
                  <th className="px-6 py-5">สินค้า</th>
                  <th className="px-6 py-5">Source</th>
                  <th className="px-6 py-5 text-right">วันที่</th>
                  <th className="px-6 py-5 text-center">รายละเอียด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.slice(0, 200).map((o, idx) => (
                  <tr key={o.id} className="hover:bg-slate-50/50 transition-all duration-200">
                    <td className="px-6 py-4 text-center text-slate-300 font-black text-sm">{idx + 1}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[11px] font-black flex-shrink-0">
                          {(o.customer_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-700 text-sm">{o.customer_name || <span className="text-slate-300 italic">ไม่ระบุ</span>}</div>
                          {o.phone && <div className="text-xs text-slate-400">{o.phone}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-semibold ${o.company_name ? 'text-slate-700' : 'text-slate-300 italic'}`}>
                        {o.company_name || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {o.user_name ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-black flex-shrink-0">
                            {o.user_name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-semibold text-slate-600">{o.user_name}</span>
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 bg-rose-50 text-rose-400 rounded-lg text-[10px] font-black">ไม่มี</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {o.total_projects > 0
                        ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-black">{o.total_projects}</span>
                        : <span className="text-slate-200 font-black">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {o.categories.map((c: string) => (
                          <span key={c} className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[10px] font-black">{c}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {o.source
                        ? <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-black">{o.source}</span>
                        : <span className="text-slate-200 text-sm">—</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-xs font-bold text-slate-400">
                        {o.created_at ? new Date(o.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Link
                        href={`/orders/${o.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-xl text-[11px] font-black transition-all duration-200"
                      >
                        ดูรายละเอียด
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-8 py-20 text-center text-slate-300 font-black uppercase tracking-widest text-sm">
                      ไม่พบข้อมูล Order
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 200 && (
            <div className="p-4 text-center text-xs font-black text-slate-400 border-t border-slate-50">
              แสดง 200 รายการแรก จาก {filtered.length.toLocaleString()} รายการ · กรุณาใช้ filter เพื่อค้นหา
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

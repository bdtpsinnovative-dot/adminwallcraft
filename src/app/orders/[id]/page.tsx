'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, MapPin, Shield, Star, ChevronUp, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

function DeviceText({ device }: { device: any }) {
  if (!device) return <span className="text-[#888]">–</span>;
  if (typeof device === 'string') return <span className="text-white font-semibold">{device}</span>;
  const parts = [device.brand, device.model, device.os, device.version].filter(Boolean).join(' ');
  return <span className="text-white font-semibold">{parts || '–'}</span>;
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-baseline py-2 border-b border-white/5 last:border-0">
      <span className="text-[#888] text-sm w-28 flex-shrink-0">{label}</span>
      <span className={`text-sm flex-1 ${value ? 'text-white font-semibold' : 'text-[#555]'}`}>{value || '–'}</span>
    </div>
  );
}

function ProjectCard({ p, productCatMap, typeMap }: { p: any; productCatMap: Record<string,string>; typeMap: Record<string,string> }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`rounded-2xl border overflow-hidden mb-4 ${p.is_deleted ? 'opacity-40 border-red-900/40' : 'border-white/10'}`}
      style={{ background: 'rgba(255,255,255,0.05)' }}>
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {p.is_important && <Star size={13} className="text-amber-400 fill-amber-400 flex-shrink-0" />}
            <span className={`font-bold text-base leading-tight ${p.project_name ? 'text-white' : 'text-[#555] italic'}`}>
              {p.project_name || '— ไม่ระบุชื่อโปรเจกต์ —'}
            </span>
          </div>
          <button onClick={() => setOpen(o => !o)} className="ml-2 flex-shrink-0 text-[#666] hover:text-white transition-colors">
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {p._item.product_category_id && productCatMap[p._item.product_category_id] && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black text-amber-300 bg-amber-500/20">{productCatMap[p._item.product_category_id]}</span>
          )}
          {p.project_type_id && typeMap[p.project_type_id] && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black text-violet-300 bg-violet-500/20">{typeMap[p.project_type_id]}</span>
          )}
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black text-slate-300 bg-white/10">
            {p.area_sqm > 0 ? `${Number(p.area_sqm).toLocaleString()} ตร.ม.` : '0 ตร.ม.'}
          </span>
          {p._item.interest_level && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black text-blue-300 bg-blue-500/20">{p._item.interest_level}</span>
          )}
          {p.is_deleted && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black text-red-400 bg-red-500/20">Deleted</span>
          )}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 space-y-0 border-t border-white/5 pt-3">
          {[
            { label: 'Developer',    account: p.account_developer,    contact: p.contact_developer },
            { label: 'Architecture', account: p.account_architecture, contact: p.contact_architecture },
            { label: 'Interior',     account: p.account_interior,     contact: p.contact_interior },
            { label: 'Contractor',   account: p.account_contractor,   contact: p.contact_contractor },
          ].map(({ label, account, contact }) => (
            <div key={label} className="flex items-baseline py-1.5 border-b border-white/5 last:border-0">
              <span className="text-[#888] text-sm w-28 flex-shrink-0">{label}</span>
              <div>
                <span className={`text-sm ${account ? 'text-white font-semibold' : 'text-[#555]'}`}>{account || '–'}</span>
                {contact && <div className="text-xs text-[#777] mt-0.5">{contact}</div>}
              </div>
            </div>
          ))}
          {p.created_at && (
            <div className="flex items-center py-1.5">
              <span className="text-[#888] text-sm w-28 flex-shrink-0">วันที่สร้าง</span>
              <span className="text-sm text-[#aaa]">{new Date(p.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
          )}
        </div>
      )}

      {Array.isArray(p._item.images) && p._item.images.length > 0 && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3">
          <div className="text-[10px] font-black uppercase tracking-wider text-[#666] mb-2">รูปภาพแนบ</div>
          <div className="flex flex-wrap gap-2">
            {p._item.images.map((img: any, i: number) => {
              const url = typeof img === 'string' ? img : img?.url || img?.src;
              return url ? (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt={`img-${i}`} className="w-16 h-16 object-cover rounded-xl border border-white/10 hover:scale-105 transition-transform" />
                </a>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params?.id as string;
  
  const [activePhones, setActivePhones] = useState<number[]>([1]);
  const [activeProjects, setActiveProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [companyMap, setCompanyMap] = useState<Record<string, string>>({});
  const [productCatMap, setProductCatMap] = useState<Record<string, string>>({});
  const [typeMap, setTypeMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!orderId) return;
    const fetchAll = async () => {
      setLoading(true);

      const fetchAllRecords = async (table: string, q: string) => {
        let all: any[] = [];
        let from = 0;
        const step = 1000;
        while (true) {
          const { data, error } = await supabase.from(table).select(q).range(from, from + step - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          all = all.concat(data);
          if (data.length < step) break;
          from += step;
        }
        return all;
      };

      try {
        const [profiles, companies, pCats, pTypes] = await Promise.all([
          fetchAllRecords('profiles', 'id, full_name'),
          fetchAllRecords('companies', 'id, name'),
          fetchAllRecords('product_categories', 'id, name'),
          fetchAllRecords('project_types', 'id, name'),
        ]);
        
        const pm: Record<string, string> = {}; profiles.forEach((p: any) => { pm[p.id] = p.full_name; }); setProfileMap(pm);
        const cm: Record<string, string> = {}; companies.forEach((c: any) => { cm[c.id] = c.name; }); setCompanyMap(cm);
        const pcm: Record<string, string> = {}; pCats.forEach((c: any) => { pcm[c.id] = c.name; }); setProductCatMap(pcm);
        const tm: Record<string, string> = {}; pTypes.forEach((t: any) => { tm[t.id] = t.name; }); setTypeMap(tm);

        // 👵 1. เช็คหาชื่อโปรเจกต์ (Project Name) จากออเดอร์นี้ก่อนเลย
        const { data: initialOrder } = await supabase
          .from('orders')
          .select(`
            company_id,
            order_items (
              order_item_projects ( project_name )
            )
          `)
          .eq('id', orderId)
          .single();

        // 👵 แกะหาชื่อโปรเจกต์ทั้งหมดที่มีในออเดอร์นี้
        const projectNames: string[] = [];
        if (initialOrder?.order_items) {
          initialOrder.order_items.forEach((item: any) => {
            if (item.order_item_projects) {
              item.order_item_projects.forEach((p: any) => {
                if (p.project_name && p.project_name.trim() !== '' && !projectNames.includes(p.project_name)) {
                  projectNames.push(p.project_name);
                }
              });
            }
          });
        }

        let query = supabase
          .from('order_item_projects')
          .select(`
            *,
            order_items!inner (
              id, product_category_id, note, interest_level, images,
              orders!inner (
                id, customer_name, phone, source, created_at, user_id, company_id, audit_log
              )
            )
          `)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false });

        let groupingType = '';
        let groupName = '';

        // 👵 2. เปลี่ยนเงื่อนไขมาดึงตามชื่อโปรเจกต์!
        if (projectNames.length > 0) {
          query = query.in('project_name', projectNames);
          groupingType = 'project';
          groupName = projectNames.join(', ');
        } else if (initialOrder?.company_id) {
          // ถ้าไม่มีชื่อโปรเจกต์จริงๆ ค่อยถอยไปดึงตาม Company
          query = query.eq('order_items.orders.company_id', initialOrder.company_id);
          groupingType = 'company';
          groupName = cm[initialOrder.company_id] || 'ไม่ระบุ';
        } else {
          query = query.eq('order_items.order_id', orderId);
          groupingType = 'single';
        }

        const { data } = await query;

        const formatted = (data || []).map((p: any) => ({
          ...p,
          _item: p.order_items || {},
          _order: (p.order_items || {}).orders || {},
          _groupingType: groupingType,
          _groupName: groupName
        }));

        setActiveProjects(formatted);
        setActivePhones([1]); 
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [orderId]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: '#0a0a0a' }}>
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 border-4 border-white/10 rounded-full" />
        <div className="absolute inset-0 border-4 border-violet-500 rounded-full border-t-transparent animate-spin" />
      </div>
    </div>
  );

  if (activeProjects.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4" style={{ background: '#0a0a0a' }}>
      <div className="text-6xl font-black text-white/10">404</div>
      <p className="text-white/30 font-bold">ไม่พบข้อมูลโปรเจกต์</p>
      <Link href="/orders" className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-black">← กลับหน้า Orders</Link>
    </div>
  );

  const totalPhones = Math.max(1, activeProjects.length);
  const phoneButtons = Array.from({ length: totalPhones }, (_, i) => i + 1);

  const togglePhone = (num: number) => {
    setActivePhones(prev => 
      prev.includes(num) 
        ? prev.filter(n => n !== num) 
        : [...prev, num].sort((a, b) => a - b)
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)' }}>
      
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 bg-black/40 backdrop-blur-xl border-b border-white/10 z-20">
        
        <Link href="/orders" className="flex items-center gap-2 text-white/80 hover:text-white transition-colors text-sm font-bold bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl">
          <ArrowLeft size={16} /> กลับหน้า Orders
        </Link>

        {/* แผงปุ่มติ๊กเลือก */}
        <div className="flex items-center gap-3">
          <span className="text-white/70 text-sm font-bold px-2 hidden md:inline-block">เปิดดูโปรเจกต์ที่:</span>
          {phoneButtons.map(num => {
            const isActive = activePhones.includes(num);
            return (
              <button
                key={num}
                onClick={() => togglePhone(num)}
                className={`w-10 h-10 rounded-xl font-black transition-all flex items-center justify-center ${
                  isActive
                    ? 'bg-violet-600 text-white shadow-[0_0_15px_rgba(139,92,246,0.5)] scale-110'
                    : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                }`}
              >
                {num}
              </button>
            );
          })}
        </div>

        {/* 👵 มุมขวาบน จะบอกให้ชัดเจนเลยว่า ดึงข้อมูลกลุ่มไหนมาโชว์อยู่ */}
        <div className="text-[11px] text-white/30 font-mono hidden lg:flex lg:flex-col items-end w-48 text-right">
          <span>พบทั้งหมด {activeProjects.length} โปรเจกต์</span>
          <span className="text-white/50 font-bold truncate w-full">
            {activeProjects[0]?._groupingType === 'project' 
              ? `โปรเจกต์: ${activeProjects[0]._groupName}` 
              : activeProjects[0]?._groupingType === 'company'
              ? `บ. ${activeProjects[0]._groupName}`
              : 'ออเดอร์เดี่ยว'}
          </span>
        </div>
      </div> 

      <div className="flex-1 overflow-auto p-6 md:p-10">
        <div className="flex flex-nowrap min-w-max gap-10 items-start">
          {activePhones.sort((a,b) => a - b).map((phoneId) => {
            
            const project = activeProjects[phoneId - 1];
            if (!project) return null;

            const order = project._order;
            const userName = order.user_id ? (profileMap[order.user_id] || 'ไม่พบชื่อ') : null;
            const companyName = order.company_id ? (companyMap[order.company_id] || null) : null;
            const auditLog = order.audit_log || {};
            const firstNote = project._item.note;

            return (
              <div key={phoneId} className="flex flex-col items-center">
                
                <div className="text-white/50 text-xs font-black mb-5 tracking-widest uppercase bg-white/5 px-4 py-2 rounded-full border border-white/10 shadow-sm">
                  📱 โปรเจกต์ที่ {phoneId}
                </div>

                <div
                  className="relative flex-shrink-0"
                  style={{
                    width: 393,
                    background: '#1c1c1e',
                    borderRadius: 54,
                    padding: '14px 5px',
                    boxShadow: `0 0 0 1.5px #3a3a3c, 0 0 0 3px #2a2a2c, 0 40px 120px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(255,255,255,0.05)`,
                  }}
                >
                  <div className="absolute" style={{ left: -3, top: 120, width: 3, height: 36, background: '#3a3a3c', borderRadius: '3px 0 0 3px' }} />
                  <div className="absolute" style={{ left: -3, top: 170, width: 3, height: 64, background: '#3a3a3c', borderRadius: '3px 0 0 3px' }} />
                  <div className="absolute" style={{ left: -3, top: 248, width: 3, height: 64, background: '#3a3a3c', borderRadius: '3px 0 0 3px' }} />
                  <div className="absolute" style={{ right: -3, top: 180, width: 3, height: 80, background: '#3a3a3c', borderRadius: '0 3px 3px 0' }} />

                  <div
                    style={{
                      borderRadius: 44,
                      overflow: 'hidden',
                      background: '#111',
                      height: 780,
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div className="flex justify-center pt-3 pb-1 flex-shrink-0" style={{ background: '#111' }}>
                      <div style={{ width: 120, height: 34, background: '#000', borderRadius: 20 }} />
                    </div>

                    <div className="flex items-center px-5 py-3 flex-shrink-0" style={{ background: '#111' }}>
                      <div className="w-8 h-8 flex items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <ArrowLeft size={16} className="text-white/70" />
                      </div>
                      <div className="flex-1 text-center">
                        <span className="text-white font-bold text-base">รายละเอียด Order</span>
                      </div>
                      <div className="w-8" />
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-4" style={{ scrollbarWidth: 'none' }}>

                      {/* ข้อมูลลูกค้า */}
                      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="flex items-center justify-between mb-3 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: 'rgba(139,92,246,0.25)' }}>🗒️</div>
                            <span className="text-white font-black text-base">ข้อมูลลูกค้า</span>
                          </div>
                        </div>

                        <InfoRow label="Customer"   value={order.customer_name} />
                        <InfoRow label="Company"    value={companyName} />
                        <InfoRow label="Phone / Line" value={order.phone} />
                        <InfoRow label="Sale Name"  value={userName} />
                        <InfoRow label="Date"       value={order.created_at ? new Date(order.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null} />
                        <InfoRow label="Source"     value={order.source} />

                        {firstNote && (
                          <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}>
                            <p className="text-sm text-white/80 leading-relaxed">{firstNote}</p>
                          </div>
                        )}
                      </div>

                      {/* Audit Log */}
                      {(auditLog?.device || auditLog?.location) && (
                        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                            <Shield size={13} className="text-violet-400" />
                            <span className="text-violet-400 font-black text-xs uppercase tracking-wider">ความปลอดภัย (Audit Log)</span>
                          </div>
                          {auditLog.device && (
                            <div className="flex items-baseline py-1.5">
                              <span className="text-[#888] text-sm w-20 flex-shrink-0">Device</span>
                              <DeviceText device={auditLog.device} />
                            </div>
                          )}
                          {auditLog.location && (
                            <a
                              href={`https://maps.google.com/?q=${auditLog.location.lat},${auditLog.location.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 mt-2 p-3 rounded-xl transition-colors"
                              style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.2)' }}
                            >
                              <MapPin size={15} className="text-violet-400 flex-shrink-0" />
                              <div>
                                <div className="text-xs font-black text-violet-300">ดูพิกัดบนแผนที่:</div>
                                <div className="text-xs text-[#888] mt-0.5">{auditLog.location.lat}, {auditLog.location.lng}</div>
                              </div>
                            </a>
                          )}
                        </div>
                      )}

                      {/* ข้อมูลโครงการ */}
                      <div className="pt-2">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-white font-black text-base">ข้อมูลโครงการ</span>
                        </div>
                        <ProjectCard key={project.id} p={project} productCatMap={productCatMap} typeMap={typeMap} />
                      </div>

                    </div>
                  </div>
                </div>

                <div className="mt-5 text-center">
                  <div className="text-[10px] text-white/20 font-mono">Order: {order.id?.slice(0, 16)}...</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
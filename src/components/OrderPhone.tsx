'use client';

import { useState } from 'react';
import { Shield, Star, ChevronUp, ChevronDown, MapPin, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

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

function ProjectCard({ p, productCatMap, typeMap }: { p: any; productCatMap: Record<string, string>; typeMap: Record<string, string> }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`rounded-2xl border overflow-hidden mb-3 ${p.is_deleted ? 'opacity-40 border-red-900/40' : 'border-white/10'}`}
      style={{ background: 'rgba(255,255,255,0.05)' }}>
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {p.is_important && <Star size={13} className="text-amber-400 fill-amber-400 flex-shrink-0" />}
            <span className={`font-bold text-sm leading-tight ${p.project_name ? 'text-white' : 'text-[#555] italic'}`}>
              {p.project_name || '— ไม่ระบุชื่อ —'}
            </span>
          </div>
          <button onClick={() => setOpen(o => !o)} className="ml-2 flex-shrink-0 text-[#666] hover:text-white transition-colors">
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {p._item.product_category_id && productCatMap[p._item.product_category_id] && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black text-amber-300 bg-amber-500/20">{productCatMap[p._item.product_category_id]}</span>
          )}
          {p.project_type_id && typeMap[p.project_type_id] && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black text-violet-300 bg-violet-500/20">{typeMap[p.project_type_id]}</span>
          )}
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black text-slate-300 bg-white/10">
            {p.area_sqm > 0 ? `${Number(p.area_sqm).toLocaleString()} ตร.ม.` : '0 ตร.ม.'}
          </span>
          {p.is_deleted && <span className="px-2 py-0.5 rounded-full text-[10px] font-black text-red-400 bg-red-500/20">Deleted</span>}
        </div>
      </div>
      {open && (
        <div className="px-4 pb-3 border-t border-white/5 pt-3 space-y-0">
          {[
            { label: 'Developer',    account: p.account_developer,    contact: p.contact_developer },
            { label: 'Architecture', account: p.account_architecture, contact: p.contact_architecture },
            { label: 'Interior',     account: p.account_interior,     contact: p.contact_interior },
            { label: 'Contractor',   account: p.account_contractor,   contact: p.contact_contractor },
          ].map(({ label, account, contact }) => (
            <div key={label} className="flex items-baseline py-1.5 border-b border-white/5 last:border-0">
              <span className="text-[#888] text-[11px] w-24 flex-shrink-0">{label}</span>
              <div>
                <span className={`text-[11px] ${account ? 'text-white font-semibold' : 'text-[#555]'}`}>{account || '–'}</span>
                {contact && <div className="text-[10px] text-[#777] mt-0.5">{contact}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      {Array.isArray(p._item.images) && p._item.images.length > 0 && open && (
        <div className="px-4 pb-3 border-t border-white/5 pt-3">
          <div className="flex flex-wrap gap-1.5">
            {p._item.images.map((img: any, i: number) => {
              const url = typeof img === 'string' ? img : img?.url || img?.src;
              return url ? (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt="" className="w-14 h-14 object-cover rounded-xl border border-white/10 hover:scale-105 transition-transform" />
                </a>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  order: any;
  profileMap: Record<string, string>;
  companyMap: Record<string, string>;
  productCatMap: Record<string, string>;
  typeMap: Record<string, string>;
  backHref?: string;
}

export default function OrderPhone({ order, profileMap, companyMap, productCatMap, typeMap, backHref = '/orders' }: Props) {
  const userName = order.user_id ? (profileMap[order.user_id] || 'ไม่พบชื่อ') : null;
  const companyName = order.company_id ? (companyMap[order.company_id] || null) : null;
  const auditLog = order.audit_log || {};
  const allItems = order.order_items || [];
  const allProjects = allItems.flatMap((i: any) => (i.order_item_projects || []).map((p: any) => ({ ...p, _item: i })));
  const activeProjects = allProjects.filter((p: any) => !p.is_deleted);
  const firstNote = allItems[0]?.note;

  return (
    <div
      style={{
        width: 360,
        flexShrink: 0,
        background: '#1c1c1e',
        borderRadius: 50,
        padding: '12px 4px',
        boxShadow: '0 0 0 1.5px #3a3a3c, 0 0 0 3px #2a2a2c, 0 40px 120px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,255,255,0.05)',
        position: 'relative',
      }}
    >
      {/* Side buttons */}
      <div className="absolute" style={{ left: -3, top: 110, width: 3, height: 32, background: '#3a3a3c', borderRadius: '3px 0 0 3px' }} />
      <div className="absolute" style={{ left: -3, top: 156, width: 3, height: 58, background: '#3a3a3c', borderRadius: '3px 0 0 3px' }} />
      <div className="absolute" style={{ left: -3, top: 228, width: 3, height: 58, background: '#3a3a3c', borderRadius: '3px 0 0 3px' }} />
      <div className="absolute" style={{ right: -3, top: 168, width: 3, height: 72, background: '#3a3a3c', borderRadius: '0 3px 3px 0' }} />

      {/* Screen */}
      <div style={{ borderRadius: 40, overflow: 'hidden', background: '#111', height: 720, display: 'flex', flexDirection: 'column' }}>
        {/* Dynamic Island */}
        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0" style={{ background: '#111' }}>
          <div style={{ width: 108, height: 30, background: '#000', borderRadius: 18 }} />
        </div>
        {/* Top bar */}
        <div className="flex items-center px-4 py-2.5 flex-shrink-0" style={{ background: '#111' }}>
          <Link href={backHref} className="w-7 h-7 flex items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <ArrowLeft size={14} className="text-white/70" />
          </Link>
          <div className="flex-1 text-center">
            <span className="text-white font-bold text-sm">รายละเอียด Order</span>
          </div>
          <div className="w-7" />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-3" style={{ scrollbarWidth: 'none' }}>

          {/* Order Info */}
          <div className="rounded-2xl p-3.5" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between mb-3 pb-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base" style={{ background: 'rgba(139,92,246,0.25)' }}>🗒️</div>
                <span className="text-white font-black text-sm">ข้อมูลโครงการ</span>
              </div>
              <div className="flex items-center gap-1 text-[#888] text-sm">≡ ✏️</div>
            </div>
            <InfoRow label="Customer"     value={order.customer_name} />
            <InfoRow label="Company"      value={companyName} />
            <InfoRow label="Phone / Line" value={order.phone} />
            <InfoRow label="Sale Name"    value={userName} />
            <InfoRow label="Date"         value={order.created_at ? new Date(order.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null} />
            <InfoRow label="Source"       value={order.source} />
            {firstNote && (
              <div className="mt-2.5 p-2.5 rounded-xl" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}>
                <p className="text-xs text-white/80 leading-relaxed">{firstNote}</p>
              </div>
            )}
          </div>

          {/* Audit Log */}
          {(auditLog?.device || auditLog?.location) && (
            <div className="rounded-2xl p-3.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2 mb-2.5 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <Shield size={12} className="text-violet-400" />
                <span className="text-violet-400 font-black text-[10px] uppercase tracking-wider">ความปลอดภัย (Audit Log)</span>
              </div>
              {auditLog.device && (
                <div className="flex items-baseline py-1">
                  <span className="text-[#888] text-sm w-20 flex-shrink-0">Device</span>
                  <DeviceText device={auditLog.device} />
                </div>
              )}
              {auditLog.location && (
                <a href={`https://maps.google.com/?q=${auditLog.location.lat},${auditLog.location.lng}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 mt-2 p-2.5 rounded-xl transition-colors"
                  style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <MapPin size={13} className="text-violet-400 flex-shrink-0" />
                  <div>
                    <div className="text-[10px] font-black text-violet-300">ดูพิกัดบนแผนที่:</div>
                    <div className="text-[10px] text-[#888] mt-0.5">{auditLog.location.lat}, {auditLog.location.lng}</div>
                  </div>
                </a>
              )}
            </div>
          )}

          {/* Projects */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-white font-black text-sm">รายการโครงการ</span>
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ background: '#3a3a3c' }}>
                {activeProjects.length}
              </span>
            </div>
            {allProjects.map((p: any) => (
              <ProjectCard key={p.id} p={p} productCatMap={productCatMap} typeMap={typeMap} />
            ))}
            {allProjects.length === 0 && (
              <div className="py-10 text-center text-[#444] font-black text-xs uppercase tracking-widest">ไม่มีโปรเจกต์</div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

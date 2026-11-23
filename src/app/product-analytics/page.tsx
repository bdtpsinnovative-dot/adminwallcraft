'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Eye,
  Clock,
  Users,
  Globe,
  Smartphone,
  AlertTriangle,
  Download,
  RefreshCw,
  Search,
  Filter,
  BarChart3,
  TrendingUp,
  UserCheck,
  Flame,
  Layers,
  Calendar,
  Trash2,
} from 'lucide-react';

interface SummaryData {
  totalViews: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
  salesViews: number;
  customerViews: number;
  idleCount: number;
  activeSalesReps: number;
}

interface ProductStat {
  productId: number | string;
  productName: string;
  collection: string;
  views: number;
  salesViews: number;
  customerViews: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
  idleCount: number;
}

interface SalesRepStat {
  userId: string;
  userName: string;
  userEmail: string;
  views: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
  idleCount: number;
  topProduct: string;
  lastActive: string;
}

interface ActivityLog {
  id: string;
  productId: number | string;
  productName: string;
  collection: string;
  variantPattern?: string;
  viewerType: 'sales' | 'customer';
  userId?: string;
  userEmail?: string;
  userName?: string;
  durationSeconds: number;
  isIdle: boolean;
  device?: string;
  timestamp: string;
}

export default function ProductAnalyticsPage() {
  const [range, setRange] = useState<'today' | '7d' | '30d' | 'all'>('7d');
  const [viewerType, setViewerType] = useState<'all' | 'sales' | 'customer'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'products' | 'sales' | 'logs'>('products');

  const [isLoading, setIsLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [summary, setSummary] = useState<SummaryData>({
    totalViews: 0,
    totalDurationSeconds: 0,
    avgDurationSeconds: 0,
    salesViews: 0,
    customerViews: 0,
    idleCount: 0,
    activeSalesReps: 0,
  });
  const [topProducts, setTopProducts] = useState<ProductStat[]>([]);
  const [salesLeaderboard, setSalesLeaderboard] = useState<SalesRepStat[]>([]);
  const [recentLogs, setRecentLogs] = useState<ActivityLog[]>([]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        range,
        viewerType,
        q: searchQuery,
      });
      const res = await fetch(`/api/product-analytics?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSummary(data.summary);
          setTopProducts(data.topProducts || []);
          setSalesLeaderboard(data.salesLeaderboard || []);
          setRecentLogs(data.recentLogs || []);
        }
      }
    } catch (err) {
      console.error('Fetch analytics error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAnalytics();
    }, 250);
    return () => clearTimeout(timer);
  }, [range, viewerType, searchQuery]);

  // Real-time polling ทุก 10 วินาที เพื่อให้อัปเดตสดอัตโนมัติเมื่อเซลล์หรือลูกค้ากดดู
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAnalytics();
    }, 10000);
    return () => clearInterval(interval);
  }, [range, viewerType, searchQuery]);

  const handleResetData = async () => {
    if (!window.confirm('⚠️ คุณแน่ใจหรือไม่ว่าต้องการล้างข้อมูลสถิติการเปิดดูทั้งหมดในระบบ? (ไม่สามารถกู้คืนได้)')) {
      return;
    }
    setIsResetting(true);
    try {
      const res = await fetch('/api/product-analytics', { method: 'DELETE' });
      if (res.ok) {
        alert('ล้างข้อมูลสถิติเรียบร้อยแล้ว');
        fetchAnalytics();
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการล้างข้อมูล');
    } finally {
      setIsResetting(false);
    }
  };

  const handleExportCSV = () => {
    if (recentLogs.length === 0) {
      alert('ไม่มีข้อมูลให้ส่งออก');
      return;
    }

    const headers = [
      'Event ID',
      'วันเวลา (Timestamp)',
      'ประเภทผู้ดู',
      'ชื่อพนักงาน/ผู้ดู',
      'อีเมล',
      'รหัสสินค้า',
      'ชื่อสินค้า',
      'คอลเลกชัน',
      'ระยะเวลาดู (วินาที)',
      'สถานะเปิดทิ้งไว้ (Idle)',
      'อุปกรณ์ (Device)',
    ];

    const rows = recentLogs.map((log) => [
      log.id,
      new Date(log.timestamp).toLocaleString('th-TH'),
      log.viewerType === 'sales' ? 'เซลล์ (Sales App)' : 'ลูกค้า (Web)',
      log.userName || '-',
      log.userEmail || '-',
      log.productId,
      `"${(log.productName || '').replace(/"/g, '""')}"`,
      `"${(log.collection || '').replace(/"/g, '""')}"`,
      log.durationSeconds,
      log.isIdle ? 'เปิดทิ้งไว้ (> 3 นาที)' : 'ดูจริง',
      log.device || '-',
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `wallcraft_product_engagement_${range}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDuration = (sec: number) => {
    if (sec < 60) return `${sec} วิ`;
    const min = Math.floor(sec / 60);
    const remainingSec = sec % 60;
    return remainingSec > 0 ? `${min} นาที ${remainingSec} วิ` : `${min} นาที`;
  };

  const maxProductViews = useMemo(() => {
    if (topProducts.length === 0) return 1;
    return Math.max(...topProducts.map((p) => p.views));
  }, [topProducts]);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 font-['Sarabun']">
      {/* 🌟 Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2.5 text-blue-600 font-bold text-xs uppercase tracking-wider mb-1">
            <BarChart3 size={16} />
            <span>Product Intelligence & Analytics</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
            วิเคราะห์พฤติกรรมการดูสินค้า
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            เจาะลึกสถิติการเปิดดูของเซลล์ในแอปและลูกค้าบนเว็บ | เวลาที่ใช้ดูจริง (วินาที) | ระบบตรวจจับการเปิดทิ้งไว้
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={fetchAnalytics}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition shadow-sm active:scale-95"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin text-blue-600' : ''} />
            <span>รีเฟรช</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow-sm shadow-blue-200 active:scale-95"
          >
            <Download size={15} />
            <span>ส่งออก CSV</span>
          </button>

          <button
            onClick={handleResetData}
            disabled={isResetting}
            title="ล้างข้อมูลสถิติเพื่อเริ่มนับใหม่"
            className="p-2.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition active:scale-95"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* 🌟 Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Date Range Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl">
          {(
            [
              { key: 'today', label: 'วันนี้' },
              { key: '7d', label: '7 วันล่าสุด' },
              { key: '30d', label: '30 วันล่าสุด' },
              { key: 'all', label: 'ทั้งหมด' },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              onClick={() => setRange(item.key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                range === item.key
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Viewer Type Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl">
          {(
            [
              { key: 'all', label: 'ผู้ดูทั้งหมด', icon: Users },
              { key: 'sales', label: 'เฉพาะเซลล์ (App)', icon: Smartphone },
              { key: 'customer', label: 'เฉพาะลูกค้า (Web)', icon: Globe },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setViewerType(item.key)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewerType === item.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon size={13} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative md:w-64">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อสินค้า / เซลล์..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>

      {/* 🌟 5 Key KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. Total Views */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-200 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">ยอดเปิดดูทั้งหมด</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Eye size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {summary.totalViews.toLocaleString()} <span className="text-xs font-normal text-slate-500">ครั้ง</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">ทั้งจากเซลล์และลูกค้าเว็บ</div>
        </div>

        {/* 2. Avg Dwell Time */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-amber-200 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">เวลาดูเฉลี่ย / ครั้ง</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {formatDuration(summary.avgDurationSeconds)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">เวลามองหน้าสินค้าจริง</div>
        </div>

        {/* 3. Sales Activity */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-200 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">เซลล์เปิดในแอป</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Smartphone size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {summary.salesViews.toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-500">
              ({summary.totalViews > 0 ? Math.round((summary.salesViews / summary.totalViews) * 100) : 0}%)
            </span>
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">
            {summary.activeSalesReps} เซลล์ที่มีการใช้งาน
          </div>
        </div>

        {/* 4. Customer Activity */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-200 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">ลูกค้าเข้าดูบนเว็บ</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Globe size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {summary.customerViews.toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-500">
              ({summary.totalViews > 0 ? Math.round((summary.customerViews / summary.totalViews) * 100) : 0}%)
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">ผู้เข้าชมจากหน้าเว็บหลัก</div>
        </div>

        {/* 5. Idle Sessions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-red-200 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">เปิดทิ้งไว้ (&gt;3 นาที)</span>
            <div className="p-2 bg-red-50 text-red-600 rounded-xl">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-red-600">
            {summary.idleCount.toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-500">
              ({summary.totalViews > 0 ? Math.round((summary.idleCount / summary.totalViews) * 100) : 0}%)
            </span>
          </div>
          <div className="text-[11px] text-red-400 mt-1">ตัดเวลาสูงสุดที่ 180 วิ</div>
        </div>
      </div>

      {/* 🌟 Tabs Control */}
      <div className="border-b border-slate-200 flex gap-6">
        <button
          onClick={() => setActiveTab('products')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'products'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Flame size={16} />
          <span>สินค้ายอดนิยม ({topProducts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('sales')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'sales'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck size={16} />
          <span>เจาะลึกทีมเซลล์ ({salesLeaderboard.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'logs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock size={16} />
          <span>ประวัติการเปิดดูแบบละเอียด ({recentLogs.length})</span>
        </button>
      </div>

      {/* 🌟 Tab Content */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center">
          <RefreshCw size={28} className="animate-spin text-blue-500 mb-3" />
          <p className="text-sm">กำลังรวบรวมและวิเคราะห์ข้อมูล...</p>
        </div>
      ) : activeTab === 'products' ? (
        /* ============================================================== */
        /* TAB 1: Top Products Ranking Table                              */
        /* ============================================================== */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800">
                อันดับสินค้าที่ถูกเปิดดูมากที่สุด
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                เรียงตามจำนวนครั้งที่ถูกเปิดดู และระยะเวลาเฉลี่ยที่คนใช้ดูสินค้านั้น
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">
              {topProducts.length} สินค้า
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">ชื่อสินค้า</th>
                  <th className="py-3 px-4">คอลเลกชัน</th>
                  <th className="py-3 px-4 w-48">ความนิยม (ยอดดูรวม)</th>
                  <th className="py-3 px-4 text-center">สัดส่วน (เซลล์ / ลูกค้า)</th>
                  <th className="py-3 px-4 text-center">เวลาดูเฉลี่ย</th>
                  <th className="py-3 px-4 text-center">เปิดทิ้งไว้</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {topProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      ไม่พบข้อมูลสินค้าในช่วงเวลานี้
                    </td>
                  </tr>
                ) : (
                  topProducts.map((p, idx) => {
                    const pct = Math.round((p.views / maxProductViews) * 100);
                    return (
                      <tr key={p.productId} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {p.productName}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-medium text-[11px]">
                            {p.collection}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 w-10">
                              {p.views.toLocaleString()}
                            </span>
                            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="text-emerald-600 font-bold">{p.salesViews}</span>
                          <span className="text-slate-300 mx-1">/</span>
                          <span className="text-indigo-600 font-bold">{p.customerViews}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-semibold text-amber-700">
                          {formatDuration(p.avgDurationSeconds)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {p.idleCount > 0 ? (
                            <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded-md font-semibold text-[11px]">
                              {p.idleCount} ครั้ง
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'sales' ? (
        /* ============================================================== */
        /* TAB 2: Sales Team Leaderboard                                   */
        /* ============================================================== */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800">
                พฤติกรรมการเปิดดูสินค้าของพนักงานขาย (Sales Reps)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                ติดตามว่าเซลล์คนไหนเปิดดูสินค้าบ่อยที่สุด ดูกี่วิ และชอบเปิดดูรุ่นไหนเป็นพิเศษ
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg">
              {salesLeaderboard.length} คน
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">ชื่อพนักงานขาย</th>
                  <th className="py-3 px-4">อีเมล</th>
                  <th className="py-3 px-4 text-center">จำนวนเปิดดู</th>
                  <th className="py-3 px-4 text-center">เวลารวมที่ดู</th>
                  <th className="py-3 px-4 text-center">เวลาดูเฉลี่ย / สินค้า</th>
                  <th className="py-3 px-4">สินค้าที่เปิดดูบ่อยสุด</th>
                  <th className="py-3 px-4 text-center">ใช้งานล่าสุด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {salesLeaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      ยังไม่มีสถิติการเปิดดูจากพนักงานขายในช่วงเวลานี้
                    </td>
                  </tr>
                ) : (
                  salesLeaderboard.map((s, idx) => (
                    <tr key={s.userId || s.userEmail} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <div className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xs">
                          {s.userName.slice(0, 1).toUpperCase()}
                        </div>
                        <span>{s.userName}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {s.userEmail || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-extrabold text-blue-600 text-sm">
                        {s.views.toLocaleString()} ครั้ง
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-700">
                        {formatDuration(s.totalDurationSeconds)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-amber-700">
                        {formatDuration(s.avgDurationSeconds)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 bg-amber-50 text-amber-800 rounded-lg font-semibold text-[11px]">
                          ⭐ {s.topProduct}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-400 text-[11px]">
                        {new Date(s.lastActive).toLocaleString('th-TH', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ============================================================== */
        /* TAB 3: Raw Detailed Activity Logs                               */
        /* ============================================================== */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800">
                บันทึกกิจกรรมรายครั้งแบบละเอียด (Raw Activity Logs)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                ประวัติการเปิดดูจริง แสดงเวลา ผู้ดู สินค้า ระยะเวลาที่เปิดดู และสถานะเปิดทิ้งไว้
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">
              {recentLogs.length} รายการล่าสุด
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">วัน-เวลา</th>
                  <th className="py-3 px-4">ผู้เปิดดู</th>
                  <th className="py-3 px-4">สินค้า</th>
                  <th className="py-3 px-4">คอลเลกชัน</th>
                  <th className="py-3 px-4 text-center">ระยะเวลาที่ดู</th>
                  <th className="py-3 px-4 text-center">สถานะ</th>
                  <th className="py-3 px-4 text-center">อุปกรณ์</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-mono text-[11px]">
                {recentLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                      ยังไม่มีประวัติกิจกรรมในช่วงเวลานี้
                    </td>
                  </tr>
                ) : (
                  recentLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('th-TH', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 font-sans font-medium text-slate-900 whitespace-nowrap">
                        {log.viewerType === 'sales' ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="font-bold text-emerald-800">{log.userName}</span>
                            <span className="text-[10px] text-slate-400">({log.userEmail})</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-500" />
                            <span className="text-slate-600">ลูกค้าบนเว็บ</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-sans font-bold text-slate-900">
                        {log.productName}
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-600">
                        {log.collection}
                      </td>
                      <td className="py-3 px-4 text-center font-bold font-sans">
                        <span
                          className={
                            log.durationSeconds > 60
                              ? 'text-amber-600'
                              : 'text-slate-700'
                          }
                        >
                          {formatDuration(log.durationSeconds)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-sans">
                        {log.isIdle ? (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-md font-bold text-[10px]">
                            ⚠️ เปิดทิ้งไว้ (&gt;3 นาที)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-semibold text-[10px]">
                            ✓ ดูจริง
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-sans text-slate-400 text-[10px]">
                        {log.device || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

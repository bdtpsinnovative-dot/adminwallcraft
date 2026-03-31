"use client";

import React from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as LineTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip as PieTooltip, Legend,
  BarChart, Bar
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b'];
const SOURCE_COLORS = ['#6366f1', '#14b8a6', '#f43f5e']; 
// 🔥 อัปเดตสีระดับความสนใจ: แดงเข้ม (สนใจมากสุด) -> ส้ม -> เหลือง -> ฟ้า (ติดตามงาน) -> เทา (สนใจน้อย) -> เทาอ่อน (ไม่ระบุ)
const INTEREST_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#94a3b8', '#cbd5e1']; 

interface DashboardChartsProps {
  lineData: { date: string; count: number }[];
  pieData: { name: string; value: number }[];
  barData: { name: string; projects: number; area: number }[];
  sourceData: { name: string; value: number }[];
  interestData: { name: string; value: number }[];
  stakeholderData: { name: string; count: number }[];
}

export default function DashboardCharts({ 
  lineData, pieData, barData, sourceData, interestData, stakeholderData 
}: DashboardChartsProps) {
  return (
    <div className="flex flex-col gap-6 mb-8">
      
      {/* --- แถวที่ 1: กราฟเทรนด์ และ แหล่งที่มาข้อมูล --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-1">เทรนด์การสร้างโปรเจกต์รายวัน (Daily Activity)</h3>
          <p className="text-xs text-slate-500 mb-4">วิเคราะห์ความหนาแน่นของงานใน 14 วันล่าสุด</p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <LineTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="count" name="จำนวนโปรเจกต์" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-1">ช่องทางการนำเข้าข้อมูล</h3>
          <p className="text-xs text-slate-500 mb-4">Mobile vs Web vs CSV</p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sourceData} cx="50%" cy="45%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                  {sourceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={SOURCE_COLORS[index % SOURCE_COLORS.length]} />
                  ))}
                </Pie>
                <PieTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* --- แถวที่ 2: เจาะลึกความสนใจ และ ผู้เกี่ยวข้อง --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-1">ระดับความสนใจของลูกค้า (Interest Level)</h3>
          <p className="text-xs text-slate-500 mb-4">ประเมินโอกาสปิดการขายจากออเดอร์ทั้งหมด</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={interestData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                {/* ขยายความกว้าง YAxis ให้ข้อความภาษาไทยไม่โดนตัด */}
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} width={140} />
                <LineTooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="value" name="จำนวนโปรเจกต์" radius={[0, 4, 4, 0]} barSize={24}>
                  {interestData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={INTEREST_COLORS[index % INTEREST_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-1">เครือข่ายผู้เกี่ยวข้อง (Project Stakeholders)</h3>
          <p className="text-xs text-slate-500 mb-4">สัดส่วนการมีส่วนร่วมของฝ่ายต่างๆ ในโปรเจกต์</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stakeholderData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <LineTooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="count" name="จำนวนที่พบในระบบ" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* --- แถวที่ 3: กราฟแท่งวิเคราะห์ผลงานรายบุคคล --- */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-1">วิเคราะห์ประสิทธิภาพรายบุคคล (Individual Performance)</h3>
        <p className="text-xs text-slate-500 mb-4">เปรียบเทียบปริมาณโปรเจกต์ และ พื้นที่รวม (ตารางเมตร)</p>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" stroke="#10b981" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <LineTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar yAxisId="left" dataKey="projects" name="จำนวนโปรเจกต์ (งาน)" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar yAxisId="right" dataKey="area" name="พื้นที่รวม (ตร.ม.)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
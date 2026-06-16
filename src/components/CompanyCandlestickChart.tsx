'use client';

import React, { useRef } from 'react'; // เอา useState ออกได้เลยครับ
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Users2, AlertCircle } from 'lucide-react';

interface Props {
  data: any[];
}

export default function CompanyCandlestickChart({ data }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 🌟 1. เปลี่ยนมาใช้ useRef เพื่อไม่ให้กราฟรีเรนเดอร์จนค้างเวลากวาดเมาส์
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    isDragging: false,
  });

  const chartData = data
    ?.map(d => {
      if (!d) return null;
      return {
        name: d.name, 
        value: d.count, 
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.value - a.value);

  if (!chartData || chartData.length === 0) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200 flex flex-col items-center justify-center w-full mb-8 h-[200px]">
        <AlertCircle className="text-slate-300 mb-2" size={32} />
        <h3 className="font-bold text-slate-500">ยังไม่มีข้อมูลสถิติการพบซ้ำ</h3>
      </div>
    );
  }

  // 🌟 2. อัปเดตฟังก์ชันเมาส์ให้ใช้ค่าจาก dragState
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    dragState.current.isDown = true;
    dragState.current.isDragging = false; // รีเซ็ตทุกครั้งที่กดเมาส์ลง
    dragState.current.startX = e.pageX - scrollContainerRef.current.offsetLeft;
    dragState.current.scrollLeft = scrollContainerRef.current.scrollLeft;
  };

  const handleMouseLeave = () => {
    dragState.current.isDown = false;
  };

  const handleMouseUp = () => {
    dragState.current.isDown = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState.current.isDown || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - dragState.current.startX) * 1.5; 
    
    // ขยายค่าจาก 5 เป็น 10 px ป้องกันอาการมือสั่นตอนคลิก
    if (Math.abs(walk) > 10) {
      dragState.current.isDragging = true; 
    }
    scrollContainerRef.current.scrollLeft = dragState.current.scrollLeft - walk;
  };

  // 🌟 3. เช็คสถานะลากเมาส์จาก dragState
  const handleBarClick = (companyName: string) => {
    // ถ้าระบบจับได้ว่ามีการลากเมาส์ (isDragging เป็น true) ให้ยกเลิกการคลิก
    if (!companyName || dragState.current.isDragging) return; 
    
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    current.set('company', companyName);
    
    const search = current.toString();
    const query = search ? `?${search}` : '';
    
    router.push(`/dashboard/checkins/all${query}`);
  };

  /* ... โค้ดส่วนที่เหลือ (CustomTooltip และโครงสร้าง JSX) ปล่อยไว้เหมือนเดิมได้เลยครับ ... */

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const itemData = payload[0].payload;
      return (
        <div className="bg-white p-4 rounded-xl shadow-xl border border-slate-100 min-w-[200px] select-none">
          <p className="font-black text-slate-800 text-sm flex items-center gap-1.5 mb-1.5">
            <Building2 size={16} className="text-indigo-600" /> {itemData.name}
          </p>
          <div className="text-xs font-bold flex justify-between text-slate-600 border-t border-slate-100 pt-1.5">
            <span>จำนวนการเข้าพบซ้ำ:</span>
            <span className="text-indigo-600 text-sm font-extrabold">{itemData.value} ครั้ง</span>
          </div>
          <p className="text-[10px] text-emerald-600 mt-2 text-center font-black animate-pulse">👉 คลิกเพื่อดูลายแทงโปรเจกต์ทั้งหมด</p>
        </div>
      );
    }
    return null;
  };

  // 🌟 4. คำนวณความกว้างตามจำนวนบริษัท
  const dynamicWidth = Math.max(1600, 150 + (chartData.length * 65));

  const currentCompanyParam = searchParams.get('company');
  const currentSelectedCompany = currentCompanyParam ? currentCompanyParam.trim() : null;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200 flex flex-col w-full mb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
            <Users2 size={20} className="text-indigo-600" /> 
            อันดับความถี่การเข้าพบซ้ำรายบริษัท (B2B Engagement Frequency)
          </h3>
          <p className="text-slate-500 text-sm font-medium mt-0.5">💡 ใช้เมาส์คลิกค้างแล้ว "ลากซ้าย-ขวา" เพื่อสไลด์ดูกราฟได้เลยครับนาย</p>
        </div>
      </div>

      <div 
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        className="w-full h-[450px] overflow-x-auto select-none cursor-grab active:cursor-grabbing"
        style={{
          msOverflowStyle: 'none',  /* IE and Edge */
          scrollbarWidth: 'none',  /* Firefox */
          outline: 'none'
        }}
      >
        <style dangerouslySetInnerHTML={{__html: `
          div::-webkit-scrollbar { display: none !important; }
        `}} />

        <div style={{ width: `${dynamicWidth}px` }} className="h-full">
          {/* ✨ ย้าย onClick มาดักที่ BarChart ชัวร์ที่สุด! */}
          {/* ✨ 1. เอา onClick ออกจาก BarChart ครับ */}
          <BarChart 
            width={dynamicWidth} 
            height={430} 
            data={chartData} 
            margin={{ top: 25, right: 30, left: 10, bottom: 45 }}
            className="focus:outline-none"
            style={{ outline: 'none' }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            
            <XAxis 
              dataKey="name" 
              tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} 
              axisLine={{ stroke: '#cbd5e1' }} 
              tickLine={false} 
              interval={0}
              angle={-45}
              textAnchor="end"
              height={120}
            />
            
            <YAxis 
              tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} 
              axisLine={{ stroke: '#cbd5e1' }} 
              tickLine={false} 
              unit=" ครั้ง" 
            />
            
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
            
            <Bar 
              dataKey="value" 
              barSize={32} 
              radius={[6, 6, 0, 0]}
              activeBar={false}
              label={{ 
                position: 'top', 
                fill: '#4f46e5', 
                fontSize: 11, 
                fontWeight: 900,
                formatter: (value: any) => value ? `${value} ครั้ง` : ''
              }}
            >
              {chartData.map((entry, index) => {
                // ✅ 1. เติมบรรทัดนี้เข้าไปครับ เพื่อบอก TypeScript ว่าถ้าเป็น null ให้ข้ามไปเลย
                if (!entry) return null;

                // ✅ 2. โค้ดเดิมก็จะทำงานได้ปกติ โดยไม่ติดตัวแดงแล้วครับ
                const isSelected = currentSelectedCompany 
                  ? entry.name.trim() === currentSelectedCompany 
                  : index === 0;

                return (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={isSelected ? '#10b981' : '#4f46e5'} 
                    cursor="pointer"
                    className="transition-all duration-300 hover:scale-y-[1.05] hover:scale-x-[1.05] hover:brightness-110 focus:outline-none"
                    style={{ 
                      transformOrigin: 'bottom center', 
                      transformBox: 'fill-box',
                      outline: 'none'
                    }}
                    onClick={() => handleBarClick(entry.name)}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </div>
      </div>
    </div>
  );
}
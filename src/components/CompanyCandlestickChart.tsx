'use client';

import React, { useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { useRouter } from 'next/navigation'; // 🌟 เอา useSearchParams ออกเพราะไม่ได้ใช้แล้วครับ
import { Building2, Users2, AlertCircle } from 'lucide-react';

interface Props {
  data: any[];
}

export default function CompanyCandlestickChart({ data }: Props) {
  const router = useRouter();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    isDragging: false,
  });

  // 🌟 1. ดึง id ของบริษัทออกมาจาก Props ด้วย
  const chartData = data
    ?.map(d => {
      if (!d) return null;
      return {
        id: d.id,     // รับ UUID ของบริษัทมาใช้
        name: d.name, // เอาชื่อมาโชว์ที่แกน X และ Tooltip
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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    dragState.current.isDown = true;
    dragState.current.isDragging = false; 
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
    
    if (Math.abs(walk) > 10) {
      dragState.current.isDragging = true; 
    }
    scrollContainerRef.current.scrollLeft = dragState.current.scrollLeft - walk;
  };

  // 🌟 2. อัปเดตฟังก์ชันคลิก ให้รับ companyId แทนชื่อ แล้ว Push ไปโฟลเดอร์ใหม่
  const handleBarClick = (companyId: string) => {
    if (!companyId || dragState.current.isDragging) return; 
    
    // พุ่งไปหน้าจอรายงานของบริษัทนั้นโดยตรงผ่านโฟลเดอร์ใหม่
    router.push(`/dashboard/companies/${companyId}`);
  };

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
          <p className="text-[10px] text-emerald-600 mt-2 text-center font-black animate-pulse">👉 คลิกเพื่อเจาะลึกบริษัทนี้</p>
        </div>
      );
    }
    return null;
  };

  const dynamicWidth = Math.max(1600, 150 + (chartData.length * 65));

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
        className="w-full h-[450px] overflow-x-auto select-none cursor-grab active:cursor-grabbing focus:outline-none"
        style={{
          msOverflowStyle: 'none', 
          scrollbarWidth: 'none', 
          outline: 'none'
        }}
      >
        <style dangerouslySetInnerHTML={{__html: `
          div::-webkit-scrollbar { display: none !important; }
        `}} />

        <div style={{ width: `${dynamicWidth}px` }} className="h-full">
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
                if (!entry) return null;

                return (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={'#4f46e5'} 
                    cursor="pointer"
                    // 🌟 เพิ่ม hover:fill-[#10b981] เพื่อให้เปลี่ยนเป็นสีเขียวตอนเอาเมาส์ชี้
                    className="transition-all duration-300 hover:scale-y-[1.05] hover:scale-x-[1.05] hover:brightness-110 focus:outline-none hover:fill-[#10b981]"
                    style={{ 
                      transformOrigin: 'bottom center', 
                      transformBox: 'fill-box',
                      outline: 'none'
                    }}
                    // 🌟 3. ส่ง entry.id ไปให้ฟังก์ชันแทนที่จะส่ง name
                    onClick={() => handleBarClick(entry.id)}
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
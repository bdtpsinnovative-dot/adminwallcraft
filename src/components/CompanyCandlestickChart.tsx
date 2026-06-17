'use client';

import React, { useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { useRouter } from 'next/navigation';
import { Building2, Users2, AlertCircle } from 'lucide-react';

interface Props {
  data: any[];
  salesKeys?: string[]; // 🌟 รับรายชื่อเซลส์มาสร้างแท่งสีแยก
}

export default function CompanyCandlestickChart({ data, salesKeys = [] }: Props) {
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    isDragging: false,
  });

  // 🌟 ชุดสี Clean & Modern สำหรับแบ่งแยกตามเซลส์แต่ละคน
  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#ef4444', '#f97316', '#14b8a6', '#84cc16'];

  const chartData = data?.filter(Boolean); // ข้อมูลเรียงมาให้แล้วจาก Server

  if (!chartData || chartData.length === 0) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200 flex flex-col items-center justify-center w-full mb-8 h-[200px]">
        <AlertCircle className="text-slate-300 mb-2" size={32} />
        <h3 className="font-bold text-slate-500">ยังไม่มีข้อมูลสถิติการพบซ้ำ</h3>
      </div>
    );
  }

  // ... (ฟังก์ชัน handleMouse ลากซ้ายขวา คงเดิม) ...
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    dragState.current.isDown = true;
    dragState.current.isDragging = false; 
    dragState.current.startX = e.pageX - scrollContainerRef.current.offsetLeft;
    dragState.current.scrollLeft = scrollContainerRef.current.scrollLeft;
  };
  const handleMouseLeave = () => { dragState.current.isDown = false; };
  const handleMouseUp = () => { dragState.current.isDown = false; };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState.current.isDown || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - dragState.current.startX) * 1.5; 
    
    if (Math.abs(walk) > 10) { dragState.current.isDragging = true; }
    scrollContainerRef.current.scrollLeft = dragState.current.scrollLeft - walk;
  };

  const handleBarClick = (companyId: string) => {
    if (!companyId || dragState.current.isDragging) return; 
    router.push(`/dashboard/companies/${companyId}`);
  };

  // 🌟 ปรับ Tooltip ให้โชว์แยกยอดว่าใครเข้าไปกี่ครั้ง
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const itemData = payload[0].payload;
      return (
        <div className="bg-white p-4 rounded-xl shadow-xl border border-slate-100 min-w-[200px] select-none z-50 relative">
          <p className="font-black text-slate-800 text-sm flex items-center gap-1.5 mb-2">
            <Building2 size={16} className="text-indigo-600" /> {itemData.name}
          </p>
          <div className="text-xs font-bold flex justify-between text-slate-600 border-b border-slate-100 pb-2 mb-2">
            <span>รวมการเข้าพบ:</span>
            <span className="text-indigo-600 text-sm font-extrabold">{itemData.count} ครั้ง</span>
          </div>
          
          <div className="space-y-1 mb-2">
            {payload.map((entry: any, index: number) => {
              if (entry.value > 0) {
                return (
                  <div key={index} className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></span>
                      {entry.name}
                    </span>
                    <span className="font-bold text-slate-800">{entry.value} ครั้ง</span>
                  </div>
                );
              }
              return null;
            })}
          </div>

          <p className="text-[10px] text-emerald-600 mt-2 text-center font-black animate-pulse bg-emerald-50 py-1 rounded-md">👉 คลิกเพื่อเจาะลึกบริษัทนี้</p>
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
          <p className="text-slate-500 text-sm font-medium mt-0.5">💡 แท่งสีกราฟจะถูกแบ่งแยกตามเซลส์ที่เข้าพบ สามารถเอาเมาส์ชี้เพื่อดูรายละเอียดได้ครับ</p>
        </div>
      </div>

      <div 
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        className="w-full h-[450px] overflow-x-auto select-none cursor-grab active:cursor-grabbing focus:outline-none"
        style={{ msOverflowStyle: 'none', scrollbarWidth: 'none', outline: 'none' }}
      >
        <style dangerouslySetInnerHTML={{__html: `div::-webkit-scrollbar { display: none !important; }`}} />

        <div style={{ width: `${dynamicWidth}px` }} className="h-full">
          <BarChart 
            width={dynamicWidth} 
            height={430} 
            data={chartData} 
            margin={{ top: 25, right: 30, left: 10, bottom: 45 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} interval={0} angle={-45} textAnchor="end" height={120} />
            <YAxis tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} unit=" ครั้ง" />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
            
            {/* 🌟 วนลูปวาดแท่งกราฟตามรายชื่อเซลส์ โดยใช้ stackId เดียวกันเพื่อให้ซ้อนกัน */}
            {salesKeys.map((salesName, index) => (
              <Bar 
                key={salesName}
                dataKey={salesName} 
                stackId="a" 
                barSize={32}
                fill={COLORS[index % COLORS.length]} 
                cursor="pointer"
                className="transition-all duration-300 hover:brightness-110 focus:outline-none"
                onClick={(entry: any) => handleBarClick(entry.id)}
              />
            ))}
          </BarChart>
        </div>
      </div>
    </div>
  );
}
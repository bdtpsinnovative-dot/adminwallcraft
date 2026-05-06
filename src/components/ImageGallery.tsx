"use client";

import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';

export default function ImageGallery({ images }: { images: string[] }) {
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);

  // ถ้าไม่มีรูป ให้แสดงกล่องเปล่าๆ
  if (!images || images.length === 0) {
    return (
      <div className="w-full h-32 md:h-36 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400">
        <ImageIcon size={24} className="mb-2 opacity-50" />
        <span className="text-xs font-medium">ไม่มีรูปภาพ</span>
      </div>
    );
  }

  // ฟังก์ชันควบคุมการเปิดปิดและเลื่อนรูป
  const openModal = (index: number) => setCurrentIndex(index);
  const closeModal = () => setCurrentIndex(null);
  
  const nextImage = (e: React.MouseEvent) => { 
    e.stopPropagation(); 
    setCurrentIndex((prev) => (prev !== null && prev < images.length - 1 ? prev + 1 : 0)); 
  };
  
  const prevImage = (e: React.MouseEvent) => { 
    e.stopPropagation(); 
    setCurrentIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : images.length - 1)); 
  };

  return (
    <>
      {/* 1. แถบรูปภาพแนวนอน (Thumbnails) */}
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x w-full">
        {images.map((img, idx) => (
          <div 
            key={idx} 
            onClick={() => openModal(idx)}
            className="w-32 h-32 md:w-36 md:h-36 shrink-0 snap-start rounded-xl overflow-hidden border border-slate-200 shadow-sm relative group bg-slate-200 cursor-pointer"
          >
            <img src={img} alt={`Site image ${idx + 1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
            {/* เลเยอร์สีดำบางๆ ตอนเอาเมาส์ชี้ บ่งบอกว่าคลิกได้ */}
            <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition-colors" />
          </div>
        ))}
      </div>

      {/* 2. หน้าต่าง Pop-up ดูรูป (Lightbox) เด้งขึ้นมาเมื่อกดรูป */}
      {currentIndex !== null && (
        <div 
          className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/95 backdrop-blur-sm" 
          onClick={closeModal}
        >
          {/* ปุ่มปิด X */}
          <button 
            className="absolute top-4 right-4 md:top-8 md:right-8 text-white/70 hover:text-white p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-50" 
            onClick={closeModal}
          >
            <X size={28} />
          </button>

          {/* ปุ่มย้อนกลับ (ถ้ามีรูปเดียวจะไม่แสดง) */}
          {images.length > 1 && (
            <button 
              className="absolute left-2 md:left-8 text-white/70 hover:text-white p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-50" 
              onClick={prevImage}
            >
              <ChevronLeft size={32} />
            </button>
          )}

          {/* รูปภาพหลักขยายใหญ่ */}
          <div className="w-full max-w-6xl max-h-[90vh] p-4 flex items-center justify-center pointer-events-none">
            <img 
              src={images[currentIndex]} 
              alt={`Fullscreen ${currentIndex + 1}`} 
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl pointer-events-auto"
              onClick={(e) => e.stopPropagation()} // ป้องกันกดโดนรูปแล้วจอดับ
            />
          </div>

          {/* ปุ่มถัดไป */}
          {images.length > 1 && (
            <button 
              className="absolute right-2 md:right-8 text-white/70 hover:text-white p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-50" 
              onClick={nextImage}
            >
              <ChevronRight size={32} />
            </button>
          )}

          {/* ตัวเลขบอกตำแหน่งรูป เช่น 1 / 3 */}
          {images.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/80 bg-black/50 px-4 py-1.5 rounded-full text-sm font-semibold tracking-widest z-50">
              {currentIndex + 1} / {images.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}
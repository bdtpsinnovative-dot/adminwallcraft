//src/components/EbookViewer.tsx

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import HTMLFlipBook from 'react-pageflip';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const BookPage = React.forwardRef<HTMLDivElement, { pageNumber: number; width: number; height: number }>(
  ({ pageNumber, width, height }, ref) => (
    <div ref={ref} style={{ width, height, background: '#fff', overflow: 'hidden', position: 'relative' }}>
      <Page
        pageNumber={pageNumber}
        width={width}
        height={height}
        renderAnnotationLayer={false}
        renderTextLayer={false}
      />
      {/* 🌟 เพิ่มเลเยอร์ 3D (Shadow Overlay) ให้ดูมีความโค้งตรงสันหนังสือ 🌟 */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: 'none', // ป้องกันไม่ให้เงามันบล็อกการคลิกหน้ากระดาษ
        // สร้างเงาดำๆ ตรงขอบกระดาษทั้งสองฝั่ง (รอยพับสันหนังสือ)
        boxShadow: 'inset 6px 0 20px rgba(0,0,0,0.15), inset -6px 0 20px rgba(0,0,0,0.15)',
        // เพิ่มแสงสะท้อนให้ดูกระดาษโค้งๆ
        background: 'linear-gradient(to right, rgba(0,0,0,0.1) 0%, rgba(255,255,255,0.05) 8%, rgba(255,255,255,0) 50%, rgba(255,255,255,0.05) 92%, rgba(0,0,0,0.1) 100%)',
      }} />
    </div>
  )
);
BookPage.displayName = 'BookPage';

export default function EbookViewer({ pdfUrl }: { pdfUrl: string }) {
  const [numPages, setNumPages]     = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [isClient, setIsClient]     = useState(false);
  const [pageSize, setPageSize]     = useState<{ width: number; height: number } | null>(null);
  
  const [isMobile, setIsMobile]     = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const bookRef      = useRef<any>(null);

  useEffect(() => { setIsClient(true); }, []);

  const calculateSize = useCallback((ratio: number) => {
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    
    const mobileMode = screenW < 768;
    setIsMobile(mobileMode);

    let h = screenH * 0.90; 
    let w = h / ratio;

    const maxW = mobileMode ? (screenW * 0.95) : (screenW * 0.45);

    if (w > maxW) {
      w = maxW;
      h = w * ratio;
    }

    return { width: Math.round(w), height: Math.round(h) };
  }, []);

  const onDocumentLoad = useCallback(async ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    if (pageSize) return; 

    try {
      const pdf   = await pdfjs.getDocument(pdfUrl).promise;
      const page  = await pdf.getPage(1);
      const vp    = page.getViewport({ scale: 1 });
      const ratio = vp.height / vp.width; 

      setPageSize(calculateSize(ratio));
    } catch {
      const w = 420;
      setPageSize({ width: w, height: Math.round(w * 1.414) });
    }
  }, [pdfUrl, pageSize, calculateSize]);

  useEffect(() => {
    if (!pageSize) return;
    const ratio = pageSize.height / pageSize.width;
    const handleResize = () => {
      setPageSize(calculateSize(ratio));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pageSize, calculateSize]);

  const spreadLabel  = currentPage === 0
    ? 'Cover'
    : `${currentPage * 2} – ${Math.min(currentPage * 2 + 1, numPages)} / ${numPages}`;

  if (!isClient) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9999, 
        background: 'linear-gradient(160deg,#1c1c1e 0%,#2a2a2e 100%)',
        width: '100vw',  
        height: '100vh',
        overflow: 'hidden', 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0', 
        userSelect: 'none',
      }}
    >
      <Document
        file={pdfUrl}
        onLoadSuccess={onDocumentLoad}
        loading={<div style={{ color: '#aaa', fontSize: 13, letterSpacing: 4, textTransform: 'uppercase', padding: 80 }}>Loading...</div>}
        error={<div style={{ color: '#f87171', fontSize: 14, padding: 60 }}>ไม่สามารถโหลด PDF ได้ครับ</div>}
      >
        {numPages > 0 && pageSize && (
          <div style={{ 
            position: 'relative', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)', 
            transform: (!isMobile && currentPage === 0) ? `translateX(-${pageSize.width / 2}px)` : 'translateX(0px)',
          }}>

            <button onClick={() => bookRef.current?.pageFlip().flipPrev()}
              disabled={currentPage <= 0}
              style={navBtnStyle('left', currentPage <= 0, isMobile)}
            >‹</button>

            {/* @ts-ignore */}
            <HTMLFlipBook
              key={isMobile ? 'mobile-view' : 'desktop-view'} 
              ref={bookRef}
              width={pageSize.width}
              height={pageSize.height}
              size="fixed" 
              minWidth={pageSize.width}
              maxWidth={pageSize.width}
              minHeight={pageSize.height}
              maxHeight={pageSize.height}
              
              /* 🌟 อัปเกรดความสมูท และความสมจริง 🌟 */
              maxShadowOpacity={0.8} // เพิ่มความเข้มเงาตอนพลิกกระดาษให้ดูมีมิติสมจริงขึ้น (จาก 0.35 เป็น 0.8)
              flippingTime={700}     // เร่งความเร็วอนิเมชันให้ติดนิ้วและสมูทขึ้น (ค่าเริ่มต้น 1000ms เราลดเหลือ 700ms)
              swipeDistance={30}     // ตั้งค่าให้มือถือปัดนิ้วเปลี่ยนหน้าง่ายขึ้น
              
              showCover={!isMobile} 
              usePortrait={isMobile} 
              mobileScrollSupport={true}
              onFlip={(e: any) => setCurrentPage(e.data)}
              style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.65)' }}
            >
              <BookPage key={1} pageNumber={1} width={pageSize.width} height={pageSize.height} />
              {Array.from({ length: numPages - 1 }, (_, i) => (
                <BookPage
                  key={i + 2}
                  pageNumber={i + 2}
                  width={pageSize.width}
                  height={pageSize.height}
                />
              ))}
            </HTMLFlipBook>

            <button onClick={() => bookRef.current?.pageFlip().flipNext()}
              disabled={isMobile ? (currentPage >= numPages - 1) : (currentPage >= numPages - 2)}
              style={navBtnStyle('right', isMobile ? (currentPage >= numPages - 1) : (currentPage >= numPages - 2), isMobile)}
            >›</button>
          </div>
        )}
      </Document>

      {numPages > 0 && pageSize && (
        <div style={{ position: 'absolute', bottom: 20, color: 'rgba(255,255,255,0.35)', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' }}>
          {isMobile ? `Page ${currentPage + 1} / ${numPages}` : spreadLabel}
        </div>
      )}
    </div>
  );
}

function navBtnStyle(side: 'left' | 'right', disabled: boolean, isMobile: boolean): React.CSSProperties {
  return {
    position: 'absolute',
    [side]: isMobile ? -20 : -56,
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 10,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '50%',
    width: 44, height: 44,
    color: '#fff', fontSize: 22,
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: disabled ? 0.15 : 0.75,
    transition: 'opacity 0.2s',
  };
}
//src/components/EbookViewer.tsx

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import HTMLFlipBook from 'react-pageflip';

// ── Toolbar Icons ──────────────────────────────────────────────────────────────
const IconFirst   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>;
const IconPrev    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}><polyline points="15 18 9 12 15 6"/></svg>;
const IconNext    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}><polyline points="9 18 15 12 9 6"/></svg>;
const IconLast    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>;
const IconZoomIn  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>;
const IconZoomOut = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>;
const IconFull    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>;
const IconExit    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}><polyline points="8 3 3 3 3 8"/><polyline points="21 8 21 3 16 3"/><polyline points="3 16 3 21 8 21"/><polyline points="16 21 21 21 21 16"/></svg>;
const IconDown    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;

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
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: 'none',
        boxShadow: 'inset 6px 0 20px rgba(0,0,0,0.15), inset -6px 0 20px rgba(0,0,0,0.15)',
        background: 'linear-gradient(to right, rgba(0,0,0,0.1) 0%, rgba(255,255,255,0.05) 8%, rgba(255,255,255,0) 50%, rgba(255,255,255,0.05) 92%, rgba(0,0,0,0.1) 100%)',
      }} />
    </div>
  )
);
BookPage.displayName = 'BookPage';

// ── Toolbar button component ───────────────────────────────────────────────────
function TBtn({
  onClick, disabled = false, title, children,
}: {
  onClick: () => void; disabled?: boolean; title?: string; children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 32, borderRadius: 6,
        border: 'none',
        background: hover && !disabled ? 'rgba(255,255,255,0.12)' : 'transparent',
        color: disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.85)',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background 0.15s, color 0.15s',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

const Divider = () => (
  <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)', margin: '0 4px', flexShrink: 0 }} />
);

export default function EbookViewer({ pdfUrl }: { pdfUrl: string }) {
  const [numPages, setNumPages]         = useState(0);
  const [currentPage, setCurrentPage]   = useState(0);
  const [isClient, setIsClient]         = useState(false);
  const [pageSize, setPageSize]         = useState<{ width: number; height: number } | null>(null);
  const [isMobile, setIsMobile]         = useState(false);
  const [zoom, setZoom]                 = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const pageRatioRef                    = useRef<number | null>(null); // เก็บ ratio ไว้ recalc

  const containerRef = useRef<HTMLDivElement>(null);
  const bookRef      = useRef<any>(null);
  const flipSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      flipSoundRef.current = new Audio('/page-flip.mp3');
      flipSoundRef.current.volume = 0.5;
    }
  }, []);

  const playFlipSound = useCallback(() => {
    if (flipSoundRef.current) {
      flipSoundRef.current.currentTime = 0.7;
      flipSoundRef.current.play().catch(() => {});
    }
  }, []);

  const calculateSize = useCallback((ratio: number) => {
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const TOOLBAR_H = 48;
    const availH = screenH - TOOLBAR_H;
    const inFS = !!document.fullscreenElement;

    const mobileMode = screenW < 768;
    setIsMobile(mobileMode);

    // pad = ช่องว่างรอบหนังสือ (fullscreen ให้มีขอบนิดนึง)
    const pad = inFS ? 0.93 : 0.97;

    if (mobileMode) {
      // ใช้ height เป็นตัวหลัก
      let h = availH * pad;
      let w = h / ratio;
      if (w > screenW * pad) { w = screenW * pad; h = w * ratio; }
      return { width: Math.round(w), height: Math.round(h) };
    } else {
      // Double-page: ใช้ height เป็นตัวหลัก → ได้ขนาดใหญ่สุดที่ fit ใน screen
      let h = availH * pad;
      let w = h / ratio;
      // ตรวจว่า 2 หน้าเกิน screen width ไหม
      if (2 * w > screenW * pad) { w = (screenW * pad) / 2; h = w * ratio; }
      return { width: Math.round(w), height: Math.round(h) };
    }
  }, []);

  // Recalculate when entering/exiting fullscreen
  useEffect(() => {
    const handler = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      // รอให้ browser ปรับขนาดหน้าต่างก่อนค่อย recalc
      setTimeout(() => {
        if (pageRatioRef.current !== null) {
          setPageSize(calculateSize(pageRatioRef.current));
        }
      }, 120);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, [calculateSize]);

  const onDocumentLoad = useCallback(async ({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    if (pageSize) return;
    try {
      const pdf   = await pdfjs.getDocument(pdfUrl).promise;
      const page  = await pdf.getPage(1);
      const vp    = page.getViewport({ scale: 1 });
      const ratio = vp.height / vp.width;
      pageRatioRef.current = ratio;          // เก็บ ratio ไว้ใช้ตอน fullscreen toggle
      setPageSize(calculateSize(ratio));
    } catch {
      pageRatioRef.current = 1.414;
      const w = 420;
      setPageSize({ width: w, height: Math.round(w * 1.414) });
    }
  }, [pdfUrl, pageSize, calculateSize]);

  useEffect(() => {
    if (!pageSize) return;
    const ratio = pageSize.height / pageSize.width;
    const handleResize = () => {
      pageRatioRef.current = ratio;
      setPageSize(calculateSize(ratio));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pageSize, calculateSize]);

  // ── Navigation helpers ───────────────────────────────────────────────────────
  const goFirst = useCallback(() => {
    bookRef.current?.pageFlip().flip(0);
  }, []);

  const goLast = useCallback(() => {
    if (!numPages) return;
    // flip to last spread: even numPages → last left page index
    const target = isMobile ? numPages - 1 : (numPages % 2 === 0 ? numPages - 2 : numPages - 1);
    bookRef.current?.pageFlip().flip(target);
  }, [numPages, isMobile]);

  const goPrev = useCallback(() => bookRef.current?.pageFlip().flipPrev(), []);
  const goNext = useCallback(() => bookRef.current?.pageFlip().flipNext(), []);

  // ── Zoom ────────────────────────────────────────────────────────────────────
  const zoomIn  = () => setZoom(z => Math.min(z + 0.15, 2.0));
  const zoomOut = () => setZoom(z => Math.max(z - 0.15, 0.4));

  // ── Fullscreen ──────────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  // ── Download ────────────────────────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    try {
      const res  = await fetch(pdfUrl);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'catalog.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(pdfUrl, '_blank');
    }
  }, [pdfUrl]);

  // ── Page label ──────────────────────────────────────────────────────────────
  const pageLabel = isMobile
    ? `${currentPage + 1} / ${numPages}`
    : currentPage === 0
      ? `Cover / ${numPages}`
      : `${currentPage + 1}–${Math.min(currentPage + 2, numPages)} / ${numPages}`;

  const atFirst = currentPage <= 0;
  const atLast  = isMobile ? currentPage >= numPages - 1 : currentPage >= numPages - 2;

  if (!isClient) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9999,
        background: 'linear-gradient(160deg,#1c1c1e 0%,#2a2a2e 100%)',
        width: '100vw', height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        userSelect: 'none',
      }}
    >
      {/* ── TOP TOOLBAR ──────────────────────────────────────────────────────── */}
      <div style={{
        width: '100%',
        height: 48,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '0 12px',
        boxSizing: 'border-box',
      }}>
        {/* First */}
        <TBtn onClick={goFirst} disabled={atFirst} title="หน้าแรก">
          <IconFirst />
        </TBtn>
        {/* Prev */}
        <TBtn onClick={goPrev} disabled={atFirst} title="หน้าก่อนหน้า">
          <IconPrev />
        </TBtn>

        {/* Page indicator */}
        <div style={{
          display: 'flex', alignItems: 'center',
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 6,
          padding: '0 10px',
          height: 28,
          color: 'rgba(255,255,255,0.75)',
          fontSize: 12,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.03em',
          whiteSpace: 'nowrap',
          minWidth: 72,
          justifyContent: 'center',
          margin: '0 2px',
        }}>
          {numPages > 0 ? pageLabel : '—'}
        </div>

        {/* Next */}
        <TBtn onClick={goNext} disabled={atLast} title="หน้าถัดไป">
          <IconNext />
        </TBtn>
        {/* Last */}
        <TBtn onClick={goLast} disabled={atLast} title="หน้าสุดท้าย">
          <IconLast />
        </TBtn>

        <Divider />

        {/* Zoom Out */}
        <TBtn onClick={zoomOut} disabled={zoom <= 0.4} title="ย่อ">
          <IconZoomOut />
        </TBtn>

        {/* Zoom label */}
        <div style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: 11,
          minWidth: 38,
          textAlign: 'center',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {Math.round(zoom * 100)}%
        </div>

        {/* Zoom In */}
        <TBtn onClick={zoomIn} disabled={zoom >= 2.0} title="ขยาย">
          <IconZoomIn />
        </TBtn>

        <Divider />

        {/* Fullscreen */}
        <TBtn onClick={toggleFullscreen} title={isFullscreen ? 'ออกจากเต็มจอ' : 'เต็มจอ'}>
          {isFullscreen ? <IconExit /> : <IconFull />}
        </TBtn>

        {/* Download */}
        <TBtn onClick={handleDownload} title="ดาวน์โหลด PDF">
          <IconDown />
        </TBtn>
      </div>

      {/* ── BOOK AREA ─────────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        overflow: 'hidden',
      }}>
        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoad}
          loading={<div style={{ color: '#aaa', fontSize: 13, letterSpacing: 4, textTransform: 'uppercase', padding: 80 }}>Loading...</div>}
          error={<div style={{ color: '#f87171', fontSize: 14, padding: 60 }}>ไม่สามารถโหลด PDF ได้ครับ</div>}
        >
          {numPages > 0 && pageSize && (
            /* ── Outer: transform (cover-shift + zoom) + nav button anchor ── */
            <div style={{
              position: 'relative',
              transform: `
                ${(!isMobile && currentPage === 0) ? `translateX(-${pageSize.width / 2}px)` : 'translateX(0px)'}
                scale(${zoom})
              `,
              transformOrigin: 'center center',
              transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            }}>

              {/* ‹ nav button — อยู่ใน outer (ไม่ถูก clip) */}
              <button
                onClick={goPrev}
                disabled={atFirst}
                style={navBtnStyle('left', atFirst, isMobile)}
              >‹</button>

              {/* ── Clip box: กัน flip-animation overflow ออกนอก book ── */}
              <div style={{
                overflow: 'hidden',
                width:  isMobile ? pageSize.width : pageSize.width * 2,
                height: pageSize.height,
                position: 'relative',
                boxShadow: '0 30px 80px rgba(0,0,0,0.65)',
              }}>
                {/* @ts-ignore */}
                <HTMLFlipBook
                  key={`${isMobile ? 'm' : 'd'}-${pageSize.width}-${pageSize.height}`}
                  ref={bookRef}
                  width={pageSize.width}
                  height={pageSize.height}
                  size="fixed"
                  minWidth={pageSize.width}
                  maxWidth={pageSize.width}
                  minHeight={pageSize.height}
                  maxHeight={pageSize.height}
                  maxShadowOpacity={0.8}
                  flippingTime={700}
                  swipeDistance={30}
                  showCover={!isMobile}
                  usePortrait={isMobile}
                  mobileScrollSupport={true}
                  onFlip={(e: any) => {
                    setCurrentPage(e.data);
                    playFlipSound();
                  }}
                  style={{ display: 'block' }}
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
              </div>

              {/* › nav button — อยู่ใน outer (ไม่ถูก clip) */}
              <button
                onClick={goNext}
                disabled={atLast}
                style={navBtnStyle('right', atLast, isMobile)}
              >›</button>
            </div>
          )}
        </Document>
      </div>
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

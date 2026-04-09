'use client';

import { useState, useEffect, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react'; // นำเข้า Library QR Code

interface CatalogItem {
  slug:         string;
  fileName:     string;
  key:          string;
  size:         number;
  lastModified: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function EbookPage() {
  const [file, setFile]               = useState<File | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [uploadResult, setUploadResult] = useState<{ slug: string } | null>(null);
  const [catalogs, setCatalogs]       = useState<CatalogItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [copied, setCopied]           = useState<string | null>(null);
  const [replacing, setReplacing]     = useState<string | null>(null);
  const [dragOver, setDragOver]       = useState(false);
  
  // State สำหรับคุมหน้าต่าง QR Code Modal
  const [qrModal, setQrModal]         = useState<{ slug: string, fileName: string } | null>(null);

  const replaceInputRef = useRef<{ [slug: string]: HTMLInputElement | null }>({});
  const uploadInputRef  = useRef<HTMLInputElement>(null);

  const fetchCatalogs = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/catalogs');
      const data = await res.json();
      if (data.success) setCatalogs(data.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCatalogs(); }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res  = await fetch('/api/upload-ebook', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setUploadResult(data);
        setFile(null);
        fetchCatalogs();
      } else {
        alert('เกิดข้อผิดพลาด: ' + data.error);
      }
    } catch {
      alert('ระบบมีปัญหาครับ');
    } finally {
      setUploading(false);
    }
  };

  const handleReplace = async (slug: string, newFile: File) => {
    setReplacing(slug);
    try {
      const formData = new FormData();
      formData.append('file', newFile);
      formData.append('slug', slug);
      const res  = await fetch('/api/catalogs/replace', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) fetchCatalogs();
      else alert('เกิดข้อผิดพลาด: ' + data.error);
    } catch {
      alert('ระบบมีปัญหาครับ');
    } finally {
      setReplacing(null);
    }
  };

  const handleDelete = async (slug: string, fileName: string) => {
    if (!confirm(`ลบ "${fileName.replace(/-/g,' ')}" ใช่ไหมครับ?`)) return;
    try {
      const res  = await fetch('/api/catalogs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (data.success) fetchCatalogs();
      else alert('ลบไม่สำเร็จ: ' + data.error);
    } catch {
      alert('ระบบมีปัญหาครับ');
    }
  };

  const copyLink = (slug: string) => {
    const link = `${window.location.origin}/catalog/${slug}`;
    navigator.clipboard.writeText(link);
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  };

  // ฟังก์ชันดาวน์โหลด QR Code
  const downloadQR = (slug: string) => {
    const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `QR-${slug}.png`;
      link.click();
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        .cm-root {
          min-height: 100vh;
          background: #f6f7fb;
          font-family: 'Inter', sans-serif;
          padding: 48px 24px 80px;
        }

        /* ── Header ── */
        .cm-header {
          max-width: 800px;
          margin: 0 auto 36px;
        }
        .cm-header h1 {
          font-size: 26px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 6px;
          letter-spacing: -0.5px;
        }
        .cm-header p {
          font-size: 14px;
          color: #94a3b8;
          margin: 0;
        }

        /* ── Upload card ── */
        .cm-upload-card {
          max-width: 800px;
          margin: 0 auto 36px;
          background: #fff;
          border-radius: 20px;
          box-shadow: 0 2px 16px rgba(15,23,42,0.07);
          overflow: hidden;
        }
        .cm-upload-inner {
          padding: 28px 32px;
        }
        .cm-upload-label {
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 16px;
        }

        /* drop zone */
        .cm-dropzone {
          border: 2px dashed #cbd5e1;
          border-radius: 14px;
          padding: 32px 20px;
          text-align: center;
          cursor: pointer;
          transition: all .2s;
          background: #f8fafc;
          position: relative;
        }
        .cm-dropzone.drag { border-color: #6366f1; background: #eef2ff; }
        .cm-dropzone.has-file { border-color: #22c55e; background: #f0fdf4; }
        .cm-dropzone-icon {
          font-size: 36px;
          margin-bottom: 10px;
        }
        .cm-dropzone-title {
          font-size: 14px;
          font-weight: 600;
          color: #334155;
          margin-bottom: 4px;
        }
        .cm-dropzone-sub {
          font-size: 12px;
          color: #94a3b8;
        }
        .cm-dropzone input[type=file] {
          position: absolute;
          inset: 0;
          opacity: 0;
          cursor: pointer;
          width: 100%;
          height: 100%;
        }

        /* upload btn */
        .cm-upload-btn {
          margin-top: 18px;
          width: 100%;
          padding: 13px;
          border-radius: 12px;
          border: none;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all .2s;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #fff;
          letter-spacing: 0.2px;
        }
        .cm-upload-btn:disabled {
          background: #e2e8f0;
          color: #94a3b8;
          cursor: default;
        }
        .cm-upload-btn:not(:disabled):hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(99,102,241,0.35);
        }

        /* success toast */
        .cm-success-toast {
          margin-top: 14px;
          padding: 14px 18px;
          background: linear-gradient(135deg, #f0fdf4, #dcfce7);
          border: 1px solid #86efac;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: #166534;
          font-weight: 500;
        }
        .cm-success-toast a {
          margin-left: auto;
          color: #6366f1;
          font-weight: 600;
          text-decoration: none;
          white-space: nowrap;
        }
        .cm-success-toast a:hover { text-decoration: underline; }

        /* ── Section heading ── */
        .cm-section-head {
          max-width: 800px;
          margin: 0 auto 16px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .cm-section-head h2 {
          font-size: 15px;
          font-weight: 600;
          color: #0f172a;
          margin: 0;
        }
        .cm-badge {
          background: #e0e7ff;
          color: #4338ca;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 99px;
        }

        /* ── Catalog list ── */
        .cm-list {
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* ── Catalog card ── */
        .cm-card {
          background: #fff;
          border-radius: 18px;
          box-shadow: 0 2px 12px rgba(15,23,42,0.06);
          padding: 20px 24px;
          display: grid;
          grid-template-columns: 52px 1fr;
          gap: 16px;
          align-items: start;
          transition: box-shadow .2s, transform .2s;
        }
        .cm-card:hover {
          box-shadow: 0 6px 28px rgba(15,23,42,0.11);
          transform: translateY(-1px);
        }

        /* PDF icon */
        .cm-pdf-icon {
          width: 52px;
          height: 52px;
          background: linear-gradient(135deg, #fee2e2, #fecaca);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          flex-shrink: 0;
        }

        .cm-card-name {
          font-size: 15px;
          font-weight: 600;
          color: #0f172a;
          margin: 0 0 4px;
          line-height: 1.3;
        }
        .cm-card-meta {
          font-size: 12px;
          color: #94a3b8;
          margin: 0 0 8px;
        }
        .cm-card-link {
          font-size: 12px;
          color: #6366f1;
          margin: 0 0 14px;
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 520px;
        }

        /* actions row */
        .cm-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .cm-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border: none;
          border-radius: 9px;
          padding: 7px 14px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all .15s;
          white-space: nowrap;
          text-decoration: none;
          font-family: 'Inter', sans-serif;
        }
        .cm-btn:hover { filter: brightness(1.08); transform: translateY(-1px); }
        .cm-btn:active { transform: translateY(0); }
        .cm-btn.view     { background: #0f172a; color: #fff; }
        .cm-btn.copy     { background: #e0e7ff; color: #4338ca; }
        .cm-btn.copy.ok  { background: #dcfce7; color: #166534; }
        .cm-btn.qr       { background: #f8fafc; color: #0f172a; border: 1px solid #cbd5e1; }
        .cm-btn.replace  { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }
        .cm-btn.delete   { background: #fff1f2; color: #be123c; border: 1px solid #fecdd3; }
        .cm-btn:disabled { opacity: .5; cursor: default; transform: none; filter: none; }

        /* ── Modal QR Code ── */
        .cm-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15,23,42,0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
          animation: fadeIn 0.2s ease-out;
        }
        .cm-modal {
          background: #fff;
          border-radius: 24px;
          padding: 32px;
          max-width: 360px;
          width: 100%;
          text-align: center;
          box-shadow: 0 20px 40px rgba(0,0,0,0.2);
          animation: slideUp 0.3s ease-out;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        
        .cm-modal h3 { margin: 0 0 8px; font-size: 20px; color: #0f172a; font-weight: 700; }
        .cm-modal p { margin: 0 0 24px; font-size: 14px; color: #64748b; line-height: 1.4; }
        .cm-qr-box { 
          background: #f8fafc; 
          padding: 16px; 
          border-radius: 16px; 
          display: inline-block; 
          margin-bottom: 24px; 
          border: 1px solid #e2e8f0; 
        }
        .cm-modal-actions { display: flex; flex-direction: column; gap: 10px; }
        .cm-btn-dl { 
          background: #2563eb; color: #fff; padding: 12px; border-radius: 12px; border: none; 
          font-weight: 600; font-size: 14px; cursor: pointer; transition: 0.2s; 
        }
        .cm-btn-dl:hover { background: #1d4ed8; }
        .cm-btn-close { 
          background: #f1f5f9; color: #475569; padding: 12px; border-radius: 12px; border: none; 
          font-weight: 600; font-size: 14px; cursor: pointer; transition: 0.2s; 
        }
        .cm-btn-close:hover { background: #e2e8f0; }

        /* empty / loading */
        .cm-empty {
          max-width: 800px;
          margin: 0 auto;
          text-align: center;
          padding: 60px 20px;
          background: #fff;
          border-radius: 20px;
          box-shadow: 0 2px 12px rgba(15,23,42,0.06);
        }
        .cm-empty-icon { font-size: 44px; margin-bottom: 14px; }
        .cm-empty p { color: #94a3b8; font-size: 14px; }

        .cm-loading {
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .cm-skeleton {
          background: #fff;
          border-radius: 18px;
          height: 100px;
          animation: pulse 1.4s ease-in-out infinite;
        }
        @keyframes pulse {
          0%,100% { opacity: 1; }
          50%      { opacity: .45; }
        }
      `}</style>

      <div className="cm-root">

        {/* ── Header ── */}
        <div className="cm-header">
          <h1>Catalog Manager</h1>
          <p>อัปโหลด PDF แล้วแชร์ link ให้ลูกค้าเปิดดู Catalog ได้เลยครับ</p>
        </div>

        {/* ── Upload card ── */}
        <div className="cm-upload-card">
          <div className="cm-upload-inner">
            <p className="cm-upload-label">อัปโหลด Catalog ใหม่</p>
            <form onSubmit={handleUpload}>
              <div
                className={`cm-dropzone${dragOver ? ' drag' : ''}${file ? ' has-file' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f?.type === 'application/pdf') { setFile(f); setUploadResult(null); }
                }}
              >
                <div className="cm-dropzone-icon">{file ? '📄' : '☁️'}</div>
                <div className="cm-dropzone-title">
                  {file ? file.name : 'ลากไฟล์ PDF มาวางที่นี่'}
                </div>
                <div className="cm-dropzone-sub">
                  {file ? `${formatSize(file.size)}` : 'หรือคลิกเพื่อเลือกไฟล์ · รองรับ .pdf เท่านั้น'}
                </div>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={e => { setFile(e.target.files?.[0] ?? null); setUploadResult(null); }}
                />
              </div>

              <button
                type="submit"
                disabled={!file || uploading}
                className="cm-upload-btn"
              >
                {uploading ? '⏳ กำลังอัปโหลด...' : 'อัปโหลด Catalog'}
              </button>
            </form>

            {uploadResult && (
              <div className="cm-success-toast">
                <span>✅ อัปโหลดสำเร็จแล้วครับ!</span>
                <a href={`/catalog/${uploadResult.slug}`} target="_blank" rel="noreferrer">
                  เปิดดู →
                </a>
              </div>
            )}
          </div>
        </div>

        {/* ── Section heading ── */}
        <div className="cm-section-head">
          <h2>Catalog ทั้งหมด</h2>
          {!loading && <span className="cm-badge">{catalogs.length}</span>}
        </div>

        {/* ── List ── */}
        {loading ? (
          <div className="cm-loading">
            {[1,2,3].map(i => <div key={i} className="cm-skeleton" />)}
          </div>
        ) : catalogs.length === 0 ? (
          <div className="cm-empty">
            <div className="cm-empty-icon">📭</div>
            <p>ยังไม่มี Catalog ครับ<br/>อัปโหลดอันแรกได้เลย!</p>
          </div>
        ) : (
          <div className="cm-list">
            {catalogs.map(item => (
              <div key={item.slug} className="cm-card">

                {/* icon */}
                <div className="cm-pdf-icon">📕</div>

                {/* body */}
                <div className="cm-card-body">
                  <p className="cm-card-name">
                    {item.fileName.replace(/-/g, ' ')}
                  </p>
                  <p className="cm-card-meta">
                    {formatSize(item.size)} &nbsp;·&nbsp; {formatDate(item.lastModified)}
                  </p>
                  <span className="cm-card-link">
                    {origin}/catalog/{item.slug}
                  </span>

                  <div className="cm-actions">

                    {/* View */}
                    <a
                      href={`/catalog/${item.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="cm-btn view"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      ดู
                    </a>

                    {/* Copy */}
                    <button
                      className={`cm-btn copy${copied === item.slug ? ' ok' : ''}`}
                      onClick={() => copyLink(item.slug)}
                    >
                      {copied === item.slug
                        ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copied!</>
                        : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy</>
                      }
                    </button>

                    {/* QR Code Button */}
                    <button
                      className="cm-btn qr"
                      onClick={() => setQrModal({ slug: item.slug, fileName: item.fileName })}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                      QR Code
                    </button>

                    {/* Replace */}
                    <button
                      className="cm-btn replace"
                      disabled={replacing === item.slug}
                      onClick={() => replaceInputRef.current[item.slug]?.click()}
                    >
                      {replacing === item.slug
                        ? '⏳...'
                        : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg> เปลี่ยน</>
                      }
                    </button>
                    <input
                      type="file"
                      accept="application/pdf"
                      style={{ display: 'none' }}
                      ref={el => { replaceInputRef.current[item.slug] = el; }}
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handleReplace(item.slug, f);
                        e.target.value = '';
                      }}
                    />

                    {/* Delete */}
                    <button
                      className="cm-btn delete"
                      onClick={() => handleDelete(item.slug, item.fileName)}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      ลบ
                    </button>

                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal QR Code (เด้งขึ้นมาเมื่อกดปุ่ม) ── */}
      {qrModal && (
        <div className="cm-modal-overlay" onClick={() => setQrModal(null)}>
          <div className="cm-modal" onClick={e => e.stopPropagation()}>
            <h3>สแกนเพื่ออ่าน Catalog</h3>
            <p>{qrModal.fileName.replace(/-/g, ' ')}</p>
            
            <div className="cm-qr-box">
              <QRCodeCanvas 
                id="qr-canvas"
                value={`${origin}/catalog/${qrModal.slug}`} 
                size={180}
                level={"H"}
                includeMargin={true}
              />
            </div>

            <div className="cm-modal-actions">
              <button className="cm-btn-dl" onClick={() => downloadQR(qrModal.slug)}>
                📥 ดาวน์โหลดรูป QR Code
              </button>
              <button className="cm-btn-close" onClick={() => setQrModal(null)}>
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
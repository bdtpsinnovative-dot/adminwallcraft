// src/app/gallery-original/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  ImagePlus, UploadCloud, Copy, X, CheckCircle2, 
  Loader2, ArrowLeft, Image as ImageIcon, Trash2, CheckSquare, Square, RefreshCcw
} from 'lucide-react';

const PAGE_SIZE = 40; 
const TARGET_FOLDER = 'original'; 

interface GalleryImage {
  name: string;
  url: string;
  updatedAt: number;
}

export default function ImageGalleryOriginalPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'preview' | 'compressing' | 'uploading'>('idle');
  
  const [replaceFileName, setReplaceFileName] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchImages(false); 
  }, []);

  const fetchImages = async (isLoadMore = false) => {
    if (isLoadMore) setIsLoadingMore(true);
    else { setIsLoading(true); setOffset(0); }

    const currentOffset = isLoadMore ? offset : 0;

    try {
      // 🌟 แก้ไขจุดที่ 1: เติม &t=${Date.now()} เข้าไปเพื่อล้าง Cache บังคับให้ดึงรูปใหม่ล่าสุดมาโชว์อันดับแรกเสมอ
      const response = await fetch(`/api/r2?folder=${TARGET_FOLDER}&limit=${PAGE_SIZE}&offset=${currentOffset}&t=${Date.now()}`);
      if (!response.ok) throw new Error('Failed to fetch images');
      
      const data = await response.json();
      const imageList = data.images;

      if (imageList.length < PAGE_SIZE) setHasMore(false);
      else setHasMore(true);

      if (isLoadMore) setImages(prev => [...prev, ...imageList]);
      else setImages(imageList); // อัปเดต state ด้วยรูปใหม่ล่าสุด
      
      setOffset(currentOffset + imageList.length);
    } catch (error: any) {
      console.error(error);
      alert('ดึงรูปภาพไม่สำเร็จ: ' + error.message);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleDeleteImages = async (fileNames: string[]) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ที่จะลบรูปภาพ ${fileNames.length} รายการนี้?`)) return;

    setIsDeleting(true);
    try {
      const response = await fetch('/api/r2', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileNames, folder: TARGET_FOLDER })
      });

      if (!response.ok) throw new Error('Failed to delete images');

      setImages(prev => prev.filter(img => !fileNames.includes(img.name)));
      setSelectedImages([]); 
      showToast(`✅ ลบรูปภาพเรียบร้อย!`);
      setOffset(prev => Math.max(0, prev - fileNames.length));
    } catch (error: any) {
      alert('ลบรูปภาพไม่สำเร็จ: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelection = (fileName: string) => {
    setSelectedImages(prev => 
      prev.includes(fileName) ? prev.filter(name => name !== fileName) : [...prev, fileName]
    );
  };

  const handleReplaceClick = (fileName: string) => {
    setReplaceFileName(fileName);
    setIsModalOpen(true);
  };

  const onFileSelect = (file: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    setSelectedFile(file);
    setUploadStatus('preview');
  };

  // 🌟 แก้ไขจุดที่ 2: เปลี่ยนวิธีบีบอัดใหม่ ลบลูปมรณะทิ้ง ทำงานเสร็จใน 0.1 วินาที เครื่องไม่ค้าง!
  const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.src = URL.createObjectURL(file);
      
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        const MAX_SIZE = 1200; 
        
        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) { 
            height *= MAX_SIZE / width; 
            width = MAX_SIZE; 
          } else { 
            width *= MAX_SIZE / height; 
            height = MAX_SIZE; 
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error("Cannot get canvas context"));
        
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // แปลงเป็น WebP คุณภาพ 70% จะได้ขนาดเล็กและสวยงามโดยไม่ต้องวนลูปซ้ำๆ
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(img.src);
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Compression failed"));
            }
          }, 
          'image/webp', 
          0.7 
        );
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error("Failed to load image for compression"));
      };
    });
  };

  const handleUploadClick = async () => {
    if (!selectedFile) return;
    try {
      setUploadStatus('compressing');
      const compressedBlob = await compressImage(selectedFile);
      const fileName = replaceFileName || `${Date.now()}-${Math.floor(Math.random() * 1000)}.webp`;

      setUploadStatus('uploading');

      const formData = new FormData();
      formData.append('file', compressedBlob, fileName);
      formData.append('fileName', fileName);
      formData.append('folder', TARGET_FOLDER); 

      const response = await fetch('/api/r2', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      closeModal();
      showToast(replaceFileName ? '✅ แทนที่รูปภาพเรียบร้อย (URL เดิม)' : '✅ อัปโหลดรูปภาพใหม่เรียบร้อย!');
      
      // 🌟 พอกดเสร็จ จะเรียก fetchImages() ซึ่งตอนนี้มันจะไม่ติด Cache แล้ว รูปใหม่จะเด้งมาอันดับ 1 ทันที
      fetchImages(false); 

    } catch (error: any) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
      setUploadStatus('idle');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setUploadStatus('idle');
    setImageSrc(null);
    setSelectedFile(null);
    setReplaceFileName(null); 
    if (imageSrc) URL.revokeObjectURL(imageSrc); 
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => showToast('📋 คัดลอก URL เรียบร้อยแล้ว!'));
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-4 md:p-8 font-sans relative pb-24">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <ImagePlus size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">รูปต้นฉบับ (Original Aspect)</h1>
              <p className="text-sm text-slate-500 mt-0.5">ระบบจะรักษาสัดส่วนเดิมและบีบอัดเป็น WebP (เก็บในโฟลเดอร์ original)</p>
            </div>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <Link 
              href="/manage-products" 
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-emerald-600 bg-slate-50 hover:bg-emerald-50 rounded-lg transition-colors border border-slate-200"
            >
              <ArrowLeft size={16} /> กลับ
            </Link>
            <button 
              onClick={() => { setReplaceFileName(null); setIsModalOpen(true); }}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              <UploadCloud size={18} /> อัปโหลดรูปใหม่
            </button>
          </div>
        </div>

        {selectedImages.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex justify-between items-center shadow-sm animate-in fade-in slide-in-from-top-4">
            <div className="text-emerald-800 font-medium">
              เลือกแล้ว {selectedImages.length} รูป
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setSelectedImages([])}
                className="px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors"
              >
                ยกเลิก
              </button>
              <button 
                onClick={() => handleDeleteImages(selectedImages)}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
              >
                {isDeleting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                ลบที่เลือก
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
              <Loader2 className="animate-spin text-emerald-500" size={32} />
              <p>กำลังโหลดรูปภาพต้นฉบับ...</p>
            </div>
          ) : images.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <ImageIcon size={48} className="opacity-20" />
              <p>ยังไม่มีรูปภาพในคลังต้นฉบับ</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {images.map((img) => {
                  const isSelected = selectedImages.includes(img.name);
                  const imageUrlWithCacheBuster = `${img.url}?v=${img.updatedAt}`;

                  return (
                    <div 
                      key={img.name} 
                      className={`group bg-white border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col relative ${
                        isSelected ? 'border-emerald-500 shadow-md ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      <button
                        onClick={() => toggleSelection(img.name)}
                        className={`absolute top-2 left-2 z-10 p-1.5 rounded-lg transition-all ${
                          isSelected ? 'bg-emerald-500 text-white opacity-100' : 'bg-white/80 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-white hover:text-emerald-500'
                        }`}
                      >
                        {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                      </button>

                      <button
                        onClick={() => handleReplaceClick(img.name)}
                        className="absolute top-2 right-10 z-10 p-1.5 bg-white/80 text-emerald-500 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-emerald-50 hover:text-emerald-600 transition-all shadow-sm"
                        title="อัปโหลดรูปทับไฟล์นี้"
                      >
                        <RefreshCcw size={18} />
                      </button>

                      <button
                        onClick={() => handleDeleteImages([img.name])}
                        disabled={isDeleting}
                        className="absolute top-2 right-2 z-10 p-1.5 bg-white/80 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all shadow-sm"
                        title="ลบรูปนี้"
                      >
                        <Trash2 size={18} />
                      </button>

                      <div 
                        className="h-40 bg-slate-50 relative overflow-hidden flex items-center justify-center p-2 cursor-pointer"
                        onClick={() => toggleSelection(img.name)} 
                      >
                        <img 
                          src={imageUrlWithCacheBuster} 
                          alt={img.name} 
                          loading="lazy" 
                          className={`max-w-full max-h-full object-contain transition-transform duration-500 ${isSelected ? 'scale-95' : 'group-hover:scale-105'}`}
                        />
                      </div>

                      <div className="p-3 border-t border-slate-100 flex items-center justify-between gap-2 bg-white mt-auto">
                        <span className="text-xs text-slate-500 truncate" title={img.name}>{img.name}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); copyToClipboard(img.url); }}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors shrink-0"
                          title="คัดลอก URL"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {hasMore && (
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={() => fetchImages(true)}
                    disabled={isLoadingMore}
                    className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 text-slate-600 font-medium rounded-full hover:bg-slate-50 hover:text-emerald-600 transition-colors shadow-sm disabled:opacity-70"
                  >
                    {isLoadingMore ? <><Loader2 size={18} className="animate-spin" /> กำลังโหลดเพิ่ม...</> : 'โหลดรูปเพิ่ม'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal Upload & Preview */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            
            <div className="flex justify-between items-center p-5 border-b border-slate-100 shrink-0 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <UploadCloud className="text-emerald-600" size={20} />
                {replaceFileName ? 'แทนที่รูปภาพเดิม (URL เดิม)' : 'อัปโหลดรูปต้นฉบับ'}
              </h2>
              <button 
                onClick={closeModal}
                disabled={uploadStatus === 'compressing' || uploadStatus === 'uploading'}
                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {uploadStatus === 'idle' && (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                  onDrop={(e) => {
                    e.preventDefault(); setIsDragging(false);
                    if (e.dataTransfer.files?.length > 0) onFileSelect(e.dataTransfer.files[0]);
                  }}
                  className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                    isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50'
                  }`}
                >
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef} 
                    onChange={(e) => { if (e.target.files?.[0]) onFileSelect(e.target.files[0]); }}
                    className="hidden" 
                  />
                  <ImageIcon size={48} className="mx-auto text-slate-300 mb-3" />
                  <p className="font-medium text-slate-700">คลิก หรือ ลากไฟล์มาวางที่นี่</p>
                  <p className="text-xs text-slate-500 mt-1">(รูปจะรักษาสัดส่วนเดิมไว้)</p>
                </div>
              )}

              {uploadStatus === 'preview' && imageSrc && (
                <div className="flex flex-col gap-4">
                  <div className="relative w-full h-80 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center p-2 border border-slate-200">
                    <img 
                      src={imageSrc} 
                      alt="Preview" 
                      className="max-w-full max-h-full object-contain shadow-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-3 mt-2">
                    <button 
                      onClick={() => { setUploadStatus('idle'); setImageSrc(null); setSelectedFile(null); }}
                      className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      ยกเลิกเปลี่ยนรูป
                    </button>
                    <button 
                      onClick={handleUploadClick}
                      className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                    >
                      ยืนยันและอัปโหลด
                    </button>
                  </div>
                </div>
              )}

              {(uploadStatus === 'compressing' || uploadStatus === 'uploading') && (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                  <Loader2 className="animate-spin text-emerald-600" size={40} />
                  <div>
                    <p className="font-semibold text-slate-700">
                      {uploadStatus === 'compressing' ? 'กำลังบีบอัดภาพเพื่อความรวดเร็ว...' : 'กำลังอัปโหลดเข้าโฟลเดอร์ original...'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">กรุณารอสักครู่ ห้ามปิดหน้าต่างนี้</p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      <div className={`fixed bottom-6 right-6 flex items-center gap-2 bg-slate-800 text-white px-4 py-3 rounded-lg shadow-xl transition-all duration-300 z-50 ${
        toastMsg ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'
      }`}>
        <CheckCircle2 size={20} className="text-emerald-400" />
        <span className="text-sm font-medium">{toastMsg}</span>
      </div>

    </div>
  );
}
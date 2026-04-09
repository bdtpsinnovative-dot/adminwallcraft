'use client';

// 1. นำเข้า dynamic จาก next
import dynamic from 'next/dynamic';

// 2. เปลี่ยนวิธี Import EbookViewer เป็นแบบ Dynamic และปิด SSR (Server-Side Rendering)
const EbookViewer = dynamic(() => import('@/components/EbookViewer'), { 
  ssr: false,
  loading: () => <div className="text-center py-10">กำลังเตรียมหน้ากระดาษครับนาย...</div>
});

const R2_PDF_URL = "https://pub-258bd10e7e8c4a7690a74c54cfbdef93.r2.dev/ebook/1775709325565-Crafitsan-Catalog-Update.pdf";

export default function CatalogPage() {
  // ✅ ส่งผ่าน proxy เพื่อแก้ปัญหา CORS จาก R2
  const myPdfUrl = `/api/pdf-proxy?url=${encodeURIComponent(R2_PDF_URL)}`;

  return (
    <main>
      <h1 className="text-center text-3xl font-bold mt-8">Wallcraft Catalog</h1>
      <EbookViewer pdfUrl={myPdfUrl} />
    </main>
  );
}
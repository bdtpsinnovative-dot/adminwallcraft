'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';

const EbookViewer = dynamic(() => import('@/components/EbookViewer'), {
  ssr: false,
  loading: () => (
    <div style={{ color: '#aaa', textAlign: 'center', padding: 80, letterSpacing: 4, textTransform: 'uppercase', fontSize: 13 }}>
      Loading...
    </div>
  ),
});

export default function CatalogSlugPage() {
  const params = useParams();
  const slug   = params?.slug as string;

  // ✅ ส่ง slug ให้ server สร้าง R2 URL เอง — ไม่ต้องใช้ env บน client
  const pdfUrl = `/api/pdf-proxy?slug=${encodeURIComponent(slug)}`;

  return <EbookViewer pdfUrl={pdfUrl} />;
}

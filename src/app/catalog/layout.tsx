// layout สำหรับ /catalog และ /catalog/[slug]
// ไม่มี sidebar, ไม่มี nav, เต็มจอ 100%
export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ margin: 0, padding: 0, width: '100%', minHeight: '100vh' }}>
      {children}
    </div>
  );
}

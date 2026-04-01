'use client';

import { usePathname } from 'next/navigation';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // เช็คว่าตอนนี้อยู่หน้าบ้าน หรือหน้าล็อกอินหรือเปล่า?
  const isPublicPage = pathname === '/' || pathname === '/login';

  // 🌟 ถ้าใช่หน้า Public ปล่อยให้หน้าจอกางเต็ม 100% เลย ไม่ต้องมีกรอบ!
  if (isPublicPage) {
    return <div className="min-h-screen w-full bg-[#0F0F11] m-0 p-0">{children}</div>;
  }

  // 🌟 ถ้าเป็นหน้าหลังบ้าน (Dashboard, etc.) ค่อยแสดงโครงสร้างแบบที่มีขอบ/Sidebar
  return (
    <div className="flex min-h-screen bg-[#0F0F11]">
      {/* ถ้านายมี Sidebar หรือ Navbar ให้เอามาใส่ตรงนี้ครับ 
         เช่น <Sidebar /> 
      */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
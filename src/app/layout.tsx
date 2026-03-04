'use client'; // ✅ ต้องใส่เพื่อให้ใช้ระบบกดเปิด/ปิดเมนูได้

import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation'; // 👈 นำเข้าตัวเช็ค URL
import { useState } from 'react';
import { 
  ShoppingBag, 
  Menu, 
  X, 
  Users, 
  UploadCloud, 
  Package,
  Image as ImageIcon // 👈 นำเข้า Icon รูปภาพ
} from 'lucide-react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname(); // 👈 ดึงที่อยู่หน้าปัจจุบันมาเช็ค

  // 📝 จัดกลุ่มเมนูเฉพาะหน้าที่ทำเสร็จแล้ว
  const menuItems = [
    { name: 'จัดการสินค้าทั้งหมด', path: '/manage-products', icon: Package }, 
    { name: 'นำเข้าสินค้า (Import)', path: '/import-products', icon: UploadCloud },
    { name: 'คลังรูปภาพ (Gallery)', path: '/gallery', icon: ImageIcon }, // 🌟 เพิ่มเมนู Gallery
    { name: 'จัดการทีมเซลล์', path: '/add-team', icon: Users },
  ];

  return (
    <html lang="en">
      <body className="bg-[#F8FAFC] text-slate-800 antialiased">
        <div className="flex min-h-screen relative w-full">
          
          {/* 🍔 ปุ่ม Hamburger ลอยอยู่มุมซ้ายบน เอาไว้เรียกเมนู */}
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className={`fixed top-4 left-4 z-40 p-2.5 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-all ${
              isSidebarOpen ? 'hidden' : 'block'
            }`}
          >
            <Menu size={24} />
          </button>

          {/* 🚩 Sidebar: เมนูด้านซ้าย (แบบ Slide เข้า-ออก) */}
          <aside 
            className={`fixed top-0 left-0 h-full w-72 bg-white border-r border-slate-200 z-50 shadow-[4px_0_24px_rgba(0,0,0,0.05)] transition-transform duration-300 ease-in-out flex flex-col ${
              isSidebarOpen ? 'translate-x-0' : '-translate-x-full' 
            }`}
          >
            {/* โลโก้แบรนด์ */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
              <div className="font-bold text-xl text-slate-800 flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <ShoppingBag className="text-blue-600" size={24} /> 
                </div>
                <span className="tracking-wide">Wallcraft</span>
              </div>
              {/* ปุ่ม X เอาไว้ปิดเมนู */}
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* รายการเมนูทั้งหมด */}
            <nav className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-1.5">
              <div className="px-4 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                เมนูหลัก
              </div>
              
              {menuItems.map((menu) => {
                // 💡 เช็คว่า URL ปัจจุบัน ตรงกับ path ของเมนูนี้ไหม?
                const isActive = pathname === menu.path || (menu.path === '/manage-products' && pathname.startsWith('/manage-products/'));
                const Icon = menu.icon;

                return (
                  <Link 
                    key={menu.path}
                    href={menu.path} 
                    onClick={() => setIsSidebarOpen(false)} // กดเมนูแล้วให้ปิด Sidebar อัตโนมัติ (สำหรับมือถือ)
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
                      isActive 
                        ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100' // สีตอนคลิก (Active)
                        : 'text-slate-600 hover:bg-slate-50 hover:text-blue-600 border border-transparent' // สีตอนปกติ
                    }`}
                  >
                    <Icon size={18} className={isActive ? 'text-blue-600' : 'text-slate-400'} /> 
                    <span>{menu.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* ส่วนล่างสุดของเมนู (เช่น ปุ่มออกจากระบบ หรือโปรไฟล์) */}
            <div className="p-4 border-t border-slate-100">
              <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  AD
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">Admin</p>
                  <p className="text-xs text-slate-500 truncate">admin@wallcraft.com</p>
                </div>
              </div>
            </div>
          </aside>

          {/* 🌌 พื้นที่มืดๆ (Overlay) */}
          {isSidebarOpen && (
            <div 
              className="fixed inset-0 bg-slate-900/20 z-40 backdrop-blur-sm transition-opacity"
              onClick={() => setIsSidebarOpen(false)}
            ></div>
          )}

          {/* 🚩 Content: พื้นที่แสดงเนื้อหา */}
          <main className="flex-1 min-w-0 flex flex-col w-full">
            <div className="flex-1 w-full p-4 pt-20 md:p-6 md:pt-20 lg:p-8 lg:pt-20">
              {children}
            </div>
          </main>

        </div>
      </body>
    </html>
  );
}
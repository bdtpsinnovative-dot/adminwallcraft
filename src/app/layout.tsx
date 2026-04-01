'use client';

import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation'; 
import { useState } from 'react';
import { 
  ShoppingBag, Menu, X, Users, Bot, 
  LayoutDashboard, Building2, Package, FileUp, 
  SearchCheck, Download, Sparkles, ImageIcon, 
  Cloud, ImagePlus, UserPlus, HardDrive, ShieldCheck
} from 'lucide-react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname(); 

  // 🛡️ 1. เช็คว่าเป็นหน้า Public (หน้าบ้าน หรือ หน้า Login) หรือไม่?
  const isPublicPage = pathname === '/' || pathname.startsWith('/login');

  // 📝 รายการเมนู
  const menuGroups = [
    {
      title: 'Overview & AI',
      items: [
        { name: 'หน้าแรก (Dashboard)', path: '/dashboard', icon: LayoutDashboard, color: 'blue' },
        { name: 'จัดการบริษัทคู่ค้า', path: '/companies', icon: Building2, color: 'blue' },
      ]
    },
    {
      title: 'Inventory & Operations',
      items: [
        { name: 'จัดการสินค้า', path: '/manage-products', icon: Package, color: 'blue' },
        { name: 'ตรวจสอบข้อมูล', path: '/check-data', icon: SearchCheck, color: 'blue' },
      ]
    },
    {
      title: 'Digital Assets',
      items: [
        { name: 'แกลเลอรีแผ่นไม้ R2', path: '/gallery-woodslabs', icon: Sparkles, color: 'purple' },
        { name: 'รูปภาพต้นฉบับ R2', path: '/gallery-original', icon: ImageIcon, color: 'blue' },
        { name: 'คลังข้อมูล Cloud R2', path: '/gallery-cloudflare', icon: Cloud, color: 'blue' },
        { name: 'แกลเลอรีลับห้ามใช้งาน', path: '/gallery', icon: ImagePlus, color: 'blue' },
      ]
    },
    {
      title: 'Team Management',
      items: [
        { name: 'เพิ่มทีม', path: '/add-team', icon: UserPlus, color: 'blue' },
        { name: 'เพิ่มโปรเจค xlsx & csv', path: '/upload', icon: HardDrive, color: 'blue' },
      ]
    }
  ];

  return (
    <html lang="en">
      <body className={`antialiased selection:bg-blue-100 selection:text-blue-700 m-0 p-0 ${isPublicPage ? 'bg-[#0F0F11]' : 'bg-[#F8FAFC]'}`}>
        
        {/* 🌟 เงื่อนไข: ถ้าเป็นหน้า Login หรือหน้าบ้าน ให้แสดงแค่ Children เพียวๆ เต็มจอ */}
        {isPublicPage ? (
          <div className="w-full min-h-screen">
            {children}
          </div>
        ) : (
          /* 🛠️ ถ้าเป็นหน้าหลังบ้าน (Dashboard ฯลฯ) ให้แสดง Layout แบบมี Sidebar */
          <div className="flex min-h-screen relative w-full overflow-x-hidden">
            
            {/* 🍔 ปุ่มเปิดเมนูลอยตัว */}
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className={`fixed top-4 left-4 z-40 p-3 bg-white border border-slate-200 rounded-2xl shadow-xl text-slate-600 hover:text-blue-600 transition-all active:scale-90 ${
                isSidebarOpen ? 'hidden' : 'block'
              }`}
            >
              <Menu size={22} />
            </button>

            {/* 🚩 Sidebar */}
            <aside 
              className={`fixed top-0 left-0 h-full w-72 bg-white border-r border-slate-200 z-50 shadow-[10px_0_40px_rgba(0,0,0,0.04)] transition-transform duration-500 ease-in-out flex flex-col ${
                isSidebarOpen ? 'translate-x-0' : '-translate-x-full' 
              }`}
            >
              {/* Header / Logo */}
              <div className="p-8 border-b border-slate-50 flex justify-between items-center shrink-0 bg-white">
                <div className="font-black text-2xl text-slate-900 flex items-center gap-3 tracking-tighter">
                  <div className="p-2.5 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl shadow-lg shadow-blue-100">
                    <ShoppingBag className="text-white" size={22} /> 
                  </div>
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">WALLCRAFT</span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                  <X size={20} />
                </button>
              </div>

              {/* ✅ Navigation */}
              <nav className="flex-1 overflow-y-auto py-6 px-5 flex flex-col gap-8 scrollbar-hide">
                {menuGroups.map((group, gIdx) => (
                  <div key={gIdx} className="flex flex-col gap-1.5">
                    <div className="px-4 mb-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
                      {group.title}
                    </div>
                    {group.items.map((menu) => {
                      const isActive = pathname === menu.path;
                      const Icon = menu.icon;
                      const isPurple = menu.color === 'purple';

                      return (
                        <Link 
                          key={menu.path}
                          href={menu.path} 
                          onClick={() => setIsSidebarOpen(false)}
                          className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 font-bold text-sm border ${
                            isActive 
                              ? isPurple 
                                ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg scale-[1.02]'
                                : 'bg-blue-600 text-white border-blue-400 shadow-lg scale-[1.02]'
                              : isPurple
                                ? 'text-indigo-600 hover:bg-indigo-50 border-transparent'
                                : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600 border-transparent' 
                          }`}
                        >
                          <Icon size={18} className={isActive ? 'text-white' : isPurple ? 'text-indigo-500' : 'text-slate-400'} /> 
                          <span>{menu.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>
            </aside>

            {/* 🌑 Overlay Backdrop */}
            {isSidebarOpen && (
              <div 
                className="fixed inset-0 bg-slate-900/40 z-40 backdrop-blur-md transition-opacity duration-500" 
                onClick={() => setIsSidebarOpen(false)}
              ></div>
            )}

            {/* 💻 Main Content */}
            <main className="flex-1 min-w-0 flex flex-col w-full relative">
              <div className="flex-1 w-full p-4 pt-24 md:p-8 lg:p-10 mx-auto"> 
                {/* 👆 ตรงนี้กาง "เต็มจอ" 100% เรียบร้อยแล้วครับนาย */}
                {children}
              </div>
            </main>
          </div>
        )}
      </body>
    </html>
  );
}
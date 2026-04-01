import Link from 'next/link';
import { 
  LayoutDashboard, Building2, Package, SearchCheck, 
  Sparkles, ImageIcon, Cloud, ImagePlus, 
  UserPlus, HardDrive, ArrowUpRight, Zap, Database, Cpu
} from 'lucide-react';

export default function HomePage() {
  return (
    <main className="w-full min-h-screen bg-[#F8FAFC] text-slate-900 p-4 md:p-10 overflow-hidden relative">
      
      {/* 🌸 Background Soft Glows (แสงสีพาสเทลจางๆ ด้านหลัง) */}
      <div className="absolute top-[-5%] left-[-5%] w-[40%] h-[40%] bg-blue-400/10 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-purple-400/10 rounded-full blur-[100px]"></div>

      <div className="w-full max-w-[1600px] mx-auto relative z-10">
        
        {/* --- 👑 Hero Header --- */}
        <div className="mb-12 flex flex-col md:flex-row justify-between items-end gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-blue-600/5 border border-blue-600/10 px-4 py-1.5 rounded-full text-blue-600 text-xs font-black tracking-widest uppercase">
              <Cpu size={14} className="animate-spin-slow" /> System Master v2.0
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-slate-900">
              WALLCRAFT <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">PORTAL</span>
            </h1>
            <p className="text-slate-500 font-bold text-lg">ศูนย์ควบคุมระบบฐานข้อมูลและสินทรัพย์ดิจิทัลระดับสูง</p>
          </div>
          <div className="hidden md:block text-right">
            <p className="text-slate-400 text-xs font-black uppercase tracking-[0.3em]">Last Updated</p>
            <p className="text-slate-900 font-mono font-bold italic">MAR 31, 2026 / 15:30</p>
          </div>
        </div>

        {/* --- 🎯 Bento Grid Layout (Full Width) --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 md:auto-rows-[200px]">
          
          {/* Card 1: Dashboard (Large & Vibrant) */}
          <Link href="/dashboard" className="md:col-span-2 md:row-span-2 group relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[3rem] p-10 transition-all duration-500 hover:shadow-[0_20px_50px_rgba(37,99,235,0.3)] hover:-translate-y-1">
            <LayoutDashboard className="absolute -right-4 -bottom-4 w-64 h-64 text-white/10 group-hover:scale-110 transition-transform duration-700" />
            <div className="relative z-10 h-full flex flex-col justify-between">
              <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/30">
                <LayoutDashboard size={36} className="text-white" />
              </div>
              <div>
                <h3 className="text-4xl font-black text-white mb-2 italic">DASHBOARD</h3>
                <p className="text-blue-100 font-bold text-lg">วิเคราะห์สถิติและข้อมูลโรงงานแบบ Real-time</p>
              </div>
            </div>
          </Link>

          {/* Card 2: Companies (Tall & Clean White) */}
          <Link href="/companies" className="md:col-span-1 md:row-span-2 group relative overflow-hidden bg-white/70 backdrop-blur-md border border-white rounded-[3rem] p-8 hover:bg-white transition-all duration-500 shadow-xl shadow-slate-200/50">
            <div className="h-full flex flex-col">
              <div className="bg-amber-100 text-amber-600 w-14 h-14 rounded-2xl flex items-center justify-center mb-8 border border-amber-200">
                <Building2 size={28} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-3">COMPANIES</h3>
              <p className="text-slate-500 font-bold text-sm leading-relaxed flex-1">ฐานข้อมูลพาร์ทเนอร์และบริษัทคู่ค้าทุกภาคส่วน</p>
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-all shadow-inner">
                <ArrowUpRight size={24} />
              </div>
            </div>
          </Link>

          {/* Card 3: Products (Emerald) */}
          <Link href="/manage-products" className="md:col-span-1 md:row-span-1 group relative overflow-hidden bg-emerald-50 border border-emerald-100 rounded-[2.5rem] p-6 hover:shadow-lg hover:shadow-emerald-100 transition-all">
            <div className="flex items-center gap-4 relative z-10">
              <div className="bg-emerald-500 text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Package size={24} />
              </div>
              <h3 className="text-xl font-black text-slate-800 italic">PRODUCTS</h3>
            </div>
            <Package size={80} className="absolute -right-4 -bottom-4 text-emerald-500/10 group-hover:rotate-12 transition-transform" />
          </Link>

          {/* Card 4: R2 Slabs (Purple) */}
          <Link href="/gallery-woodslabs" className="md:col-span-1 md:row-span-1 group relative overflow-hidden bg-purple-50 border border-purple-100 rounded-[2.5rem] p-6 hover:shadow-lg hover:shadow-purple-100 transition-all">
            <div className="flex items-center gap-4 relative z-10">
              <div className="bg-purple-500 text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Sparkles size={24} />
              </div>
              <h3 className="text-xl font-black text-slate-800 italic">R2 SLABS</h3>
            </div>
            <Sparkles size={80} className="absolute -right-4 -bottom-4 text-purple-500/10 group-hover:scale-125 transition-transform" />
          </Link>

          {/* Card 5: Cloud R2 */}
          <Link href="/gallery-cloudflare" className="md:col-span-1 md:row-span-1 group relative overflow-hidden bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm hover:border-blue-400 transition-all">
            <Cloud className="text-blue-500 mb-2" size={28} />
            <h3 className="font-black text-slate-800">CLOUD R2</h3>
            <p className="text-slate-400 text-xs font-bold uppercase mt-1 tracking-widest">S3 Storage</p>
          </Link>

          {/* Card 6: Teams */}
          <Link href="/add-team" className="md:col-span-1 md:row-span-1 group relative overflow-hidden bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm hover:border-orange-400 transition-all">
            <UserPlus className="text-orange-500 mb-2" size={28} />
            <h3 className="font-black text-slate-800">TEAMS</h3>
            <p className="text-slate-400 text-xs font-bold uppercase mt-1 tracking-widest">Management</p>
          </Link>

          {/* Card 7: Project Import (Long) */}
          <Link href="/upload" className="md:col-span-2 md:row-span-1 group relative overflow-hidden bg-white/70 backdrop-blur-md border border-white rounded-[3rem] p-8 flex items-center justify-between hover:shadow-xl shadow-slate-200/50 transition-all">
            <div className="flex items-center gap-6">
              <div className="bg-slate-900 w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:bg-blue-600 transition-colors">
                <HardDrive size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-800 italic">PROJECT IMPORT</h3>
                <p className="text-slate-500 font-bold text-sm">อัปโหลดไฟล์ Excel / CSV เข้าระบบจัดการ</p>
              </div>
            </div>
            <div className="bg-slate-100 p-4 rounded-full group-hover:bg-slate-900 group-hover:text-white transition-all">
              <ArrowUpRight size={28} />
            </div>
          </Link>

        </div>

        {/* --- Footer --- */}
        <div className="mt-16 flex justify-between items-center text-slate-300 text-[10px] font-black uppercase tracking-[0.5em]">
          <span>WallCraft Control Terminal</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span>System Active</span>
          </div>
        </div>
      </div>
    </main>
  );
}
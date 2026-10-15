'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { saveAdminTokenCookie } from '@/lib/admin-auth-cookie';
import { Loader2, Sparkles } from 'lucide-react';

export default function SSOPage() {
  const router = useRouter();
  const [status, setStatus] = useState('กำลังเชื่อมต่อบัญชี...');

  useEffect(() => {
    let isCancelled = false;

    const processSSO = async () => {
      try {
        // ดึง Token จาก URL parameters หรือ hash
        const urlParams = new URLSearchParams(window.location.search);
        let accessToken = urlParams.get('access_token');
        let refreshToken = urlParams.get('refresh_token');

        if (!accessToken && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
          accessToken = hashParams.get('access_token');
          refreshToken = hashParams.get('refresh_token');
        }

        if (!accessToken) {
          // หากไม่มี Token ใน URL ให้เช็คว่ามี session เดิมในเครื่องอยู่แล้วหรือไม่
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            saveAdminTokenCookie(session.access_token);
            if (!isCancelled) router.replace('/dashboard');
            return;
          }
          if (!isCancelled) router.replace('/login');
          return;
        }

        setStatus('ยืนยันตัวตนสำเร็จ กำลังเข้าสู่ระบบ...');

        // บันทึก Session เข้า Supabase JS Client ใน localStorage
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });

        if (error) {
          console.error('SSO setSession error:', error);
          if (!isCancelled) router.replace('/login?error=sso_failed');
          return;
        }

        const validToken = data.session?.access_token || accessToken;
        saveAdminTokenCookie(validToken);

        // ล้าง parameters บน URL เพื่อความสวยงามและความปลอดภัย
        if (window.history.replaceState) {
          window.history.replaceState(null, '', '/sso');
        }

        if (!isCancelled) {
          router.replace('/dashboard');
          router.refresh();
        }
      } catch (err) {
        console.error('SSO exception:', err);
        if (!isCancelled) router.replace('/login?error=sso_exception');
      }
    };

    void processSSO();

    return () => {
      isCancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-[#0A0705] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#D4A373]/15 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-sm p-8 bg-[#1A120B]/70 border border-white/10 rounded-3xl backdrop-blur-2xl shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-[#D4A373]/10 border border-[#D4A373]/20 flex items-center justify-center mb-5 text-[#D4A373]">
          <Sparkles className="w-8 h-8 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2 tracking-tight">WallCraft SSO</h2>
        <div className="flex items-center gap-2.5 text-[#D4A373] text-sm font-medium mt-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{status}</span>
        </div>
        <p className="text-xs text-white/30 mt-4">กำลังเข้าสู่ระบบผ่าน Employee Portal</p>
      </div>
    </main>
  );
}

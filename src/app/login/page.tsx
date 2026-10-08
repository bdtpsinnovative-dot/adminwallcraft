'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { saveAdminTokenCookie } from '@/lib/admin-auth-cookie';
import { Eye, EyeOff, Plus, X, Loader2, ShieldCheck, UserPlus, Sparkles } from 'lucide-react';

// ─────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────
interface SavedAccount {
  email: string
  name: string
  role?: string
  avatar_url?: string | null
  token_payload?: string
}

const STORAGE_KEY = 'wallcraft_saved_accounts_v1'

function encodeCred(val: string): string {
  try { return btoa(encodeURIComponent(val)) } catch { return val }
}
function decodeCred(val: string): string {
  try { return decodeURIComponent(atob(val)) } catch { return val }
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeLoggingEmail, setActiveLoggingEmail] = useState<string | null>(null);
  const isMouseDownOnBackdrop = useRef(false);

  // ─── Close modal on Escape key ───────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showAddModal) {
        setShowAddModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAddModal]);

  // ─── Check existing session ───────────────
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        saveAdminTokenCookie(session.access_token);
        router.replace('/dashboard');
      }
    };
    void checkSession();
  }, [router]);

  // ─── Load saved accounts from localStorage ─
  useEffect(() => {
    if (window.location.search || window.location.hash) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const accounts: SavedAccount[] = JSON.parse(raw);
        setSavedAccounts(accounts);
      }
    } catch { /* ignore */ }
  }, []);

  // ─── Persist account to localStorage ──────
  function persistAccount(acc: { email: string; name: string; role?: string; avatar_url?: string | null; pass: string }) {
    try {
      let current = [...savedAccounts];
      current = current.filter(a => a.email.toLowerCase() !== acc.email.toLowerCase());
      current.unshift({
        email: acc.email,
        name: acc.name,
        role: acc.role,
        avatar_url: acc.avatar_url,
        token_payload: encodeCred(acc.pass)
      });
      if (current.length > 8) current = current.slice(0, 8);
      setSavedAccounts(current);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch (e) {
      console.error('Error saving account:', e);
    }
  }

  function handleRemoveAccount(e: React.MouseEvent, emailToRemove: string) {
    e.stopPropagation();
    const updated = savedAccounts.filter(a => a.email.toLowerCase() !== emailToRemove.toLowerCase());
    setSavedAccounts(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  // ─── Core login logic ─────────────────────
  async function doLogin(targetEmail: string, targetPassword: string, remember: boolean) {
    setLoading(true);
    setError('');

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: targetPassword,
      });

      if (authError || !authData.user) {
        throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name, avatar_url')
        .eq('id', authData.user.id)
        .single();

      saveAdminTokenCookie(authData.session.access_token);

      if (remember) {
        persistAccount({
          email: targetEmail,
          name: profile?.full_name || targetEmail.split('@')[0],
          role: profile?.role,
          avatar_url: profile?.avatar_url,
          pass: targetPassword,
        });
      }

      router.push('/dashboard');
      router.refresh();

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
      setLoading(false);
      setActiveLoggingEmail(null);
    }
  }

  // ─── 1-Click login from saved account ────
  async function handleOneClickLogin(account: SavedAccount) {
    if (loading) return;
    const savedPass = account.token_payload ? decodeCred(account.token_payload) : '';
    if (!savedPass) {
      setError(`ไม่พบรหัสผ่านของ "${account.name}" กรุณาเพิ่มบัญชีใหม่`);
      return;
    }
    setActiveLoggingEmail(account.email);
    await doLogin(account.email, savedPass, true);
  }

  // ─── Manual login from modal form ────────
  async function handleManualLogin(e?: React.FormEvent) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (loading) return;
    const targetEmail = email.trim();
    if (!targetEmail || !password) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }
    await doLogin(targetEmail, password, rememberMe);
  }

  const renderRoleBadge = (r?: string) => {
    if (!r) return null;
    if (r === 'admin' || r === 'god') return (
      <span className="inline-flex items-center gap-1 bg-[#D4A373]/20 text-[#D4A373] border border-[#D4A373]/30 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide">
        <Sparkles className="w-2.5 h-2.5" /> Admin
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 bg-white/10 text-white/60 border border-white/10 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide">
        {r}
      </span>
    );
  };

  // ─────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────
  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden bg-[#0A0705]">

      {/* CSS animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes breathing-glow {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.3; }
          50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.6; }
        }
        .animate-glow { animation: breathing-glow 8s ease-in-out infinite; }
      `}} />

      {/* Background texture */}
      <div
        className="absolute inset-0 z-0 opacity-20"
        style={{
          backgroundImage: 'url("https://i.pinimg.com/736x/cb/1f/17/cb1f17b6497222e875f2108d91d0179b.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0A0705_80%)]" />
      <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] bg-[#D4A373]/20 rounded-full blur-[140px] animate-glow z-0 pointer-events-none" />

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md">
          <div className="flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-[#D4A373] animate-spin mb-4" strokeWidth={1.5} />
            <p className="text-[#D4A373] font-bold tracking-widest text-sm uppercase animate-pulse">Authenticating...</p>
            <p className="text-white/30 text-[11px] mt-2">กำลังเชื่อมต่อกับระบบ</p>
          </div>
        </div>
      )}

      {/* Main card */}
      <div className="w-full max-w-[600px] relative z-10">
        <div className="bg-[#1A120B]/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.9)]">

          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 shadow-inner overflow-hidden">
              <img src="/icon.png" alt="WallCraft" className="w-10 h-10 object-contain" />
            </div>
            <h1 className="text-2xl font-light text-white tracking-tight">
              Wall<span className="font-bold text-[#D4A373]">Craft</span>
            </h1>
            <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mt-1">
              Admin Control Panel
            </p>
            {savedAccounts.length > 0 && (
              <p className="text-white/40 text-xs mt-2">เลือกโปรไฟล์เพื่อเข้าสู่ระบบทันที</p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-300 text-xs font-medium">{error}</p>
            </div>
          )}

          {/* Accounts grid or empty state */}
          {savedAccounts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {savedAccounts.map((acc) => {
                const isActive = activeLoggingEmail === acc.email;
                return (
                  <div
                    key={acc.email}
                    onClick={() => handleOneClickLogin(acc)}
                    className={`group relative bg-white/5 border rounded-2xl p-3 flex flex-col items-center text-center transition-all cursor-pointer select-none hover:shadow-[0_0_20px_rgba(212,163,115,0.15)] hover:-translate-y-0.5 active:scale-[0.97] ${
                      isActive
                        ? 'border-[#D4A373]/60 ring-2 ring-[#D4A373]/20 bg-[#D4A373]/5'
                        : 'border-white/10 hover:border-[#D4A373]/40'
                    }`}
                  >
                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={(e) => handleRemoveAccount(e, acc.email)}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/10 hover:bg-red-500/20 text-white/30 hover:text-red-400 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>

                    {/* Avatar + Gold ring */}
                    <div className="relative mb-2 mt-1">
                      <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-[#D4A373] via-[#C8913A] to-[#8B6914] group-hover:scale-105 transition-transform">
                        <div className="p-[2px] bg-[#0A0705] rounded-full">
                          {acc.avatar_url ? (
                            <img
                              src={acc.avatar_url}
                              alt={acc.name}
                              className="w-14 h-14 rounded-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#D4A373] to-[#8B6914] text-[#0A0705] flex items-center justify-center font-bold text-xl">
                              {acc.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#22c55e] border-2 border-[#0A0705] rounded-full" />
                    </div>

                    <p className="text-xs font-bold text-white truncate w-full group-hover:text-[#D4A373] transition-colors">
                      {acc.name}
                    </p>
                    {acc.role && (
                      <div className="mt-0.5">{renderRoleBadge(acc.role)}</div>
                    )}
                    <p className="text-[10px] text-white/30 truncate w-full mt-0.5">{acc.email}</p>

                    <button
                      type="button"
                      className="mt-2.5 w-full py-1.5 bg-gradient-to-r from-[#D4A373] to-[#8B6914] group-hover:from-[#C8913A] group-hover:to-[#6B5010] text-[#0A0705] text-[11px] font-bold rounded-lg transition-all flex items-center justify-center shadow-sm"
                    >
                      {isActive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'เข้าสู่ระบบ'}
                    </button>
                  </div>
                );
              })}

              {/* Add account card */}
              {savedAccounts.length < 8 && (
                <div
                  onClick={() => { setError(''); setEmail(''); setPassword(''); setShowAddModal(true); }}
                  className="border-2 border-dashed border-white/10 hover:border-[#D4A373]/40 rounded-2xl p-3 flex flex-col items-center justify-center text-center cursor-pointer group bg-transparent hover:bg-[#D4A373]/5 transition-all active:scale-[0.97] min-h-[180px]"
                >
                  <div className="w-12 h-12 rounded-full bg-white/5 group-hover:bg-[#D4A373]/10 text-white/30 group-hover:text-[#D4A373] flex items-center justify-center mb-2 transition-colors">
                    <Plus className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <p className="text-xs font-bold text-white/30 group-hover:text-[#D4A373] transition-colors">เพิ่มบัญชีอื่น</p>
                  <p className="text-[10px] text-white/20 mt-0.5">เข้าด้วยอีเมลใหม่</p>
                </div>
              )}
            </div>
          ) : (
            /* Empty state — no saved accounts yet */
            <div className="flex flex-col items-center py-6 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-[#D4A373]">
                <UserPlus className="w-7 h-7" strokeWidth={1.5} />
              </div>
              <p className="text-white/50 text-sm font-medium mb-1">ยังไม่มีบัญชีที่บันทึกไว้</p>
              <p className="text-white/25 text-xs mb-5">กรุณาเข้าสู่ระบบครั้งแรกด้วยอีเมลและรหัสผ่าน</p>
              <button
                type="button"
                onClick={() => { setError(''); setEmail(''); setPassword(''); setShowAddModal(true); }}
                className="px-6 py-2.5 bg-gradient-to-r from-[#D4A373] to-[#8B6914] text-[#0A0705] font-bold text-sm rounded-2xl transition-all hover:from-[#C8913A] hover:to-[#6B5010] flex items-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                เข้าสู่ระบบ
              </button>
            </div>
          )}

          {savedAccounts.length > 0 && (
            <div className="text-center text-[11px] text-white/20 mt-2">
              ต้องการสลับบัญชี?{' '}
              <button
                type="button"
                onClick={() => { setError(''); setEmail(''); setPassword(''); setShowAddModal(true); }}
                className="text-[#D4A373]/70 hover:text-[#D4A373] font-semibold hover:underline cursor-pointer transition-colors"
              >
                คลิกเพื่อเพิ่มบัญชี
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-white/15 text-[10px] uppercase tracking-[0.2em]">
          Secure Connection &copy; 2026 · WallCraft Admin
        </p>
      </div>

      {/* ── MODAL ── */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              isMouseDownOnBackdrop.current = true;
            }
          }}
          onClick={(e) => {
            if (isMouseDownOnBackdrop.current && e.target === e.currentTarget) {
              setShowAddModal(false);
            }
            isMouseDownOnBackdrop.current = false;
          }}
        >
          <div
            className="w-full max-w-[400px] bg-[#1A120B]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 relative shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9)]"
            onMouseDown={(e) => {
              isMouseDownOnBackdrop.current = false;
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-white/30 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex p-3 rounded-2xl bg-[#D4A373]/10 text-[#D4A373] mb-3 border border-[#D4A373]/20">
                <UserPlus className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-white">Sign In to WallCraft</h2>
              <p className="text-white/30 text-xs mt-0.5">กรอกข้อมูลเพื่อเข้าสู่ระบบ</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-300 text-xs font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleManualLogin} className="space-y-4">
              <div>
                <label className="block text-white/40 text-[10px] font-bold mb-1.5 uppercase tracking-widest">Email Address</label>
                <input
                  type="text"
                  autoComplete="username"
                  disabled={loading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 focus:border-[#D4A373]/50 focus:ring-4 focus:ring-[#D4A373]/10 text-white rounded-2xl px-4 py-3 text-sm outline-none transition-all placeholder:text-white/20 disabled:opacity-50"
                  placeholder="admin@wallcraft.com"
                />
              </div>

              <div>
                <label className="block text-white/40 text-[10px] font-bold mb-1.5 uppercase tracking-widest">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    disabled={loading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 focus:border-[#D4A373]/50 focus:ring-4 focus:ring-[#D4A373]/10 text-white rounded-2xl px-4 py-3 pr-10 text-sm outline-none transition-all placeholder:text-white/20 disabled:opacity-50"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-white/30 hover:text-[#D4A373] transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 accent-[#D4A373]"
                />
                <span className="text-xs text-white/40">บันทึกบัญชีนี้ไว้ในเครื่อง</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-[#D4A373] to-[#8B6914] hover:from-[#C8913A] hover:to-[#6B5010] text-[#0A0705] font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.98] shadow-lg mt-2"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /><span>กำลังเข้าสู่ระบบ...</span></>
                  : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

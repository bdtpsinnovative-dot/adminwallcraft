'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Users, UserPlus, CheckCircle2, XCircle, Loader2,Image as ImageIcon } from 'lucide-react';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  team_id: string | null;
}

interface Team {
  id: string;
  team_name: string;
}

export default function AssignTeamsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // เก็บสถานะการโหลดของแต่ละแถว (ใครกำลังบันทึกข้อมูลอยู่)
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // 1. ดึงรายชื่อทีมทั้งหมด
      const { data: teamData, error: teamErr } = await supabase
        .from('teams')
        .select('*')
        .order('team_name');
      
      if (teamErr) throw teamErr;
      setTeams(teamData || []);

      // 2. ดึงรายชื่อพนักงานทั้งหมด
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      if (profileErr) throw profileErr;
      setProfiles(profileData || []);

    } catch (err: any) {
      alert("โหลดข้อมูลไม่สำเร็จ: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserTeam = async (userId: string, newTeamId: string) => {
    setUpdatingId(userId);
    setSuccessId(null);
    setErrorId(null);

    const finalTeamId = newTeamId === "" ? null : newTeamId;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ team_id: finalTeamId })
        .eq('id', userId);

      if (error) throw error;

      // ถ้าสำเร็จ ให้อัปเดต State บนหน้าจอด้วย
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, team_id: finalTeamId } : p));
      
      // โชว์ติ๊กถูกสีเขียว 2 วินาที
      setSuccessId(userId);
      setTimeout(() => setSuccessId(null), 2000);

    } catch (err: any) {
      setErrorId(userId);
      alert("อัปเดตไม่สำเร็จ: " + err.message);
      setTimeout(() => setErrorId(null), 3000);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* 🌟 Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <UserPlus size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">กำหนดทีมให้พนักงาน</h1>
              <p className="text-sm text-slate-500 mt-0.5">จัดสรรพนักงานเข้าสู่ทีมต่างๆ ในระบบ Wallcraft</p>
            </div>
          </div>
          <Link 
            href="/add-team" 
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
          >
            <Users size={16} /> จัดการรายชื่อทีม
          </Link>
        </div>

        {/* 🌟 Table Section */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs tracking-wider font-semibold">
                <tr>
                  <th className="py-4 px-6">ชื่อ-นามสกุล</th>
                  <th className="py-4 px-6">อีเมล</th>
                  <th className="py-4 px-6">ทีมที่สังกัด</th>
                  <th className="py-4 px-6 text-center w-24">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center text-slate-500">
                      <div className="flex justify-center items-center gap-3">
                         <Loader2 size={18} className="animate-spin text-blue-500" />
                         กำลังโหลดข้อมูลพนักงาน...
                      </div>
                    </td>
                  </tr>
                ) : profiles.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center text-slate-400">
                      ไม่พบข้อมูลพนักงานในระบบ
                    </td>
                  </tr>
                ) : (
                  profiles.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-800">{user.full_name || 'ไม่ระบุชื่อ'}</div>
                        <div className="text-xs text-slate-400 mt-0.5 font-mono">{user.id.substring(0, 8)}...</div>
                      </td>
                      <td className="py-4 px-6 text-slate-500">{user.email || '-'}</td>
                      
                      {/* 📝 Dropdown สำหรับเลือกทีม */}
                      <td className="py-4 px-6">
                        <select 
                          value={user.team_id || ''}
                          onChange={(e) => updateUserTeam(user.id, e.target.value)}
                          disabled={updatingId === user.id}
                          className={`w-full max-w-[250px] bg-white border rounded-lg px-3 py-2 text-sm outline-none transition-all cursor-pointer ${
                            updatingId === user.id 
                              ? 'border-slate-200 text-slate-400 bg-slate-50' 
                              : 'border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 hover:border-emerald-400'
                          }`}
                        >
                          <option value="">-- ยังไม่มีทีม (อิสระ) --</option>
                          {teams.map(t => (
                            <option key={t.id} value={t.id}>{t.team_name}</option>
                          ))}
                        </select>
                      </td>

                      {/* ⏳ สถานะการบันทึก (Real-time Feedback) */}
<td className="py-4 px-6 text-center">
  <div className="flex justify-center items-center h-full">
    {updatingId === user.id ? (
      <div title="กำลังอัปเดต...">
        <Loader2 size={18} className="animate-spin text-blue-500" />
      </div>
    ) : successId === user.id ? (
      <div title="อัปเดตสำเร็จ">
        <CheckCircle2 size={18} className="text-emerald-500" />
      </div>
    ) : errorId === user.id ? (
      <div title="เกิดข้อผิดพลาด">
        <XCircle size={18} className="text-red-500" />
      </div>
    ) : (
      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
        พร้อม
      </span>
    )}
  </div>
</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
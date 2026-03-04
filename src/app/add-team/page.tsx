"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Users, UserPlus, Plus, X, ArrowLeft } from "lucide-react";

interface Team {
  id: string;
  team_name: string;
  description: string;
  created_at: string;
}

export default function ManageTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 🌟 State สำหรับ Modal และ Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamDesc, setTeamDesc] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching teams:", error);
      alert("โหลดข้อมูลไม่สำเร็จ: " + error.message);
    } else {
      setTeams(data || []);
    }
    setIsLoading(false);
  };

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) {
      alert("กรุณาระบุชื่อทีมครับ");
      return;
    }

    setIsSaving(true);
    const { error } = await supabase
      .from("teams")
      .insert([{ team_name: teamName.trim(), description: teamDesc.trim() }]);

    if (error) {
      alert("เกิดข้อผิดพลาด: " + error.message);
    } else {
      setTeamName("");
      setTeamDesc("");
      setIsModalOpen(false); // 🌟 บันทึกเสร็จให้ปิด Modal อัตโนมัติ
      fetchTeams();
    }
    setIsSaving(false);
  };

  const deleteTeam = async (id: string, name: string) => {
    if (!confirm(`⚠️ ยืนยันการลบทีม "${name}" ใช่ไหมครับ?\n(หากมีเซลล์อยู่ในทีมนี้ อาจทำให้ข้อมูลเซลล์มีปัญหาได้)`)) return;

    const { error } = await supabase.from("teams").delete().eq("id", id);

    if (error) {
      alert("ลบไม่สำเร็จ: " + error.message);
    } else {
      fetchTeams();
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* 🌟 Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <Users size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">จัดการรายชื่อทีม</h1>
              <p className="text-sm text-slate-500 mt-0.5">เพิ่ม ลบ หรือแก้ไขกลุ่มทีมงานในระบบ Wallcraft</p>
            </div>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            {/* 🔗 ลิงก์ไปหน้า Assign Teams ให้ทำงานเชื่อมกัน */}
            <Link 
              href="/assign-teams" 
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"
            >
              <UserPlus size={16} /> กำหนดทีมให้พนักงาน
            </Link>
            {/* ➕ ปุ่มเปิด Modal */}
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              <Plus size={16} /> สร้างทีมใหม่
            </button>
          </div>
        </div>

        {/* 🌟 Table Section (ขยายเต็มพื้นที่ เพราะเอา Form ออกแล้ว) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-white">
            <h2 className="font-semibold text-slate-800 text-lg">รายชื่อทีมทั้งหมด ({teams.length})</h2>
            <button 
              onClick={fetchTeams} 
              disabled={isLoading}
              className="flex items-center gap-2 text-blue-600 text-sm hover:text-blue-700 font-medium transition-colors disabled:opacity-50"
            >
              <svg className={`${isLoading ? 'animate-spin' : ''}`} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              รีเฟรชข้อมูล
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                  <th className="py-4 px-6 font-medium">ชื่อทีม</th>
                  <th className="py-4 px-6 font-medium">คำอธิบาย</th>
                  <th className="py-4 px-6 font-medium text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="py-16 text-center text-slate-500">
                      <div className="flex justify-center items-center gap-3">
                         <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                         กำลังโหลดข้อมูล...
                      </div>
                    </td>
                  </tr>
                ) : teams.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <Users size={40} className="text-slate-300" />
                        <p>ยังไม่มีข้อมูลทีมในระบบ</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  teams.map((team) => (
                    <tr key={team.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-4 px-6 text-slate-800 font-medium">
                        {team.team_name}
                        <div className="text-xs text-slate-400 mt-0.5 font-mono">ID: {team.id.substring(0, 8)}...</div>
                      </td>
                      <td className="py-4 px-6 text-slate-500 text-sm">{team.description || "-"}</td>
                      <td className="py-4 px-6 text-right">
                        <button 
                          onClick={() => deleteTeam(team.id, team.team_name)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="ลบทีม"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 🌟 Modal: สร้างทีมใหม่ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md">
                  <Plus size={18} />
                </div>
                สร้างทีมใหม่
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body (Form) */}
            <form onSubmit={createTeam}>
              <div className="p-6 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">ชื่อทีม <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    required
                    autoFocus
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" 
                    placeholder="เช่น ทีมภาคกลาง, Team A"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">คำอธิบายทีม (ตัวเลือก)</label>
                  <textarea 
                    value={teamDesc}
                    onChange={(e) => setTeamDesc(e.target.value)}
                    rows={3}
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none" 
                    placeholder="ระบุรายละเอียดเขตพื้นที่ หรือหน้าที่รับผิดชอบ..."
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50 w-32"
                >
                  {isSaving ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : "บันทึกข้อมูล"}
                </button>
              </div>
            </form>
            
          </div>
        </div>
      )}

    </div>
  );
}
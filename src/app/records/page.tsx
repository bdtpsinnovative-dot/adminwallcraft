// src/app/records/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase"; 
import { Loader2, CheckCircle2, AlertCircle, X, Save, Plus, Trash2, Edit3, ClipboardList, PackagePlus, CalendarDays, PackageOpen, Check, Layers, Pencil } from "lucide-react";

interface TpsRecord {
  refCode: string;
  jkCode: string;
  ctn: string;
  tracking: string;
  status: string;
}

export default function RecordsPage() {
  // 🌟 State สำหรับข้อมูลในระบบ
  const [groupedSystemRecords, setGroupedSystemRecords] = useState<any[]>([]);
  const [isLoadingSystem, setIsLoadingSystem] = useState(true);

  // 📦 State สำหรับกรอกข้อมูลในโมดูล (Popup)
  const [batchDate, setBatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [batchCode, setBatchCode] = useState("");
  const [refCode, setRefCode] = useState("TPS"); 
  const [jkCode, setJkCode] = useState("");
  const [ctn, setCtn] = useState("1");
  const [tracking, setTracking] = useState("");

  // 📋 State สำหรับเก็บรายการชั่วคราวขณะกรอกในโมดูล
  const [tempRecords, setTempRecords] = useState<TpsRecord[]>([]);
  const [editingBatchId, setEditingBatchId] = useState<number | null>(null);

  // สถานะเปิด/ปิดโมดูล และแจ้งเตือน
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false); 
  const [statusMsg, setStatusMsg] = useState<{msg: string, type: 'success' | 'error' | 'info'} | null>(null);

  // --- 1. ดึงข้อมูลในระบบมาแสดงผล ---
  const fetchSystemRecords = async () => {
    setIsLoadingSystem(true);
    try {
      const { data, error } = await supabase
        .from('tps_records')
        .select(`
          id, ref_code, jk_code, ctn, tracking_number, status, batch_id,
          tps_batches ( batch_code, batch_date )
        `)
        .order('id', { ascending: false });

      if (error) throw error;

      if (data) {
        const groups: { [key: string]: any } = {};

        data.forEach((item: any) => {
          const batchId = item.batch_id;
          const bCode = item.tps_batches?.batch_code || "-";
          const bDate = item.tps_batches?.batch_date || "-";
          const groupKey = `${batchId}_${bCode}`;

          if (!groups[groupKey]) {
            groups[groupKey] = {
              batchId: batchId, batchCode: bCode, batchDate: bDate,
              isAllDelivered: true, items: []
            };
          }

          if (item.status !== 'delivered') groups[groupKey].isAllDelivered = false;

          groups[groupKey].items.push({
            id: item.id, refCode: item.ref_code, jkCode: item.jk_code,
            ctn: item.ctn, trackingNumber: item.tracking_number, status: item.status
          });
        });

        setGroupedSystemRecords(Object.values(groups));
      }
    } catch (error) {
      console.error("Fetch system records error:", error);
    } finally {
      setIsLoadingSystem(false);
    }
  };

  useEffect(() => { fetchSystemRecords(); }, []);

  // --- 2. เปิด Modal สำหรับสร้างใหม่ ---
  const handleOpenCreateModal = () => {
    setEditingBatchId(null); 
    setBatchDate(new Date().toISOString().split('T')[0]);
    setBatchCode(""); setRefCode("TPS"); setJkCode(""); setCtn("1"); setTracking("");
    setTempRecords([]); setIsModalOpen(true);
  };

  // --- 3. เปิด Modal สำหรับ "แก้ไข" ข้อมูลเก่า ---
  const handleOpenEditModal = (batchBlock: any) => {
    setEditingBatchId(batchBlock.batchId); 
    setBatchDate(batchBlock.batchDate); 
    setBatchCode(batchBlock.batchCode === "-" ? "" : batchBlock.batchCode); 
    
    const mappedRecords = batchBlock.items.map((item: any) => ({
      refCode: item.refCode, jkCode: item.jkCode,
      ctn: item.ctn.toString(), tracking: item.trackingNumber || "-", status: item.status
    }));
    
    setTempRecords(mappedRecords);
    setRefCode("TPS"); setJkCode(""); setCtn("1"); setTracking("");
    setIsModalOpen(true); 
  };

  // --- 4. เพิ่มรายการลงตารางชั่วคราว ---
  const handleAddToTempList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refCode || !jkCode || !ctn) {
      alert("กรุณากรอก Ref Code, JK Code และ CTN ให้ครบครับนาย!");
      return;
    }

    const newRecord: TpsRecord = {
      refCode, jkCode, ctn, tracking: tracking || "-", status: "in_transit"
    };

    setTempRecords([...tempRecords, newRecord]);
    setRefCode("TPS"); setJkCode(""); setCtn("1"); setTracking("");
  };

  // --- 5. ลบรายการออกจากตารางชั่วคราว ---
  const handleRemoveFromTempList = (index: number) => {
    const updated = [...tempRecords];
    updated.splice(index, 1);
    setTempRecords(updated);
  };

  // --- 🌟 [เพิ่มใหม่] ดูดข้อมูลจากตารางขวา กลับมาแก้ฝั่งซ้าย ---
  const handleEditTempItem = (index: number) => {
    const itemToEdit = tempRecords[index];
    
    // เอาข้อมูลเดิมมาหยอดใส่ฟอร์มฝั่งซ้าย
    setRefCode(itemToEdit.refCode);
    setJkCode(itemToEdit.jkCode);
    setCtn(itemToEdit.ctn);
    setTracking(itemToEdit.tracking === "-" ? "" : itemToEdit.tracking);

    // ลบรายการเดิมออกจากฝั่งขวา เพื่อให้พอกดเพิ่มใหม่มันจะไม่ซ้ำครับ
    handleRemoveFromTempList(index);
  };

  // --- 6. ยืนยันบันทึกทั้งหมดลง Database ---
  const handleSaveBatchToDatabase = async () => {
    if (tempRecords.length === 0) {
      alert("ยังไม่มีรายการพัสดุในโมดูลเลยครับนาย!"); return;
    }
    setIsSaving(true);
    try {
      if (editingBatchId !== null) {
        const { error: updateBatchError } = await supabase
          .from('tps_batches')
          .update({ batch_date: batchDate, batch_code: batchCode || "-" })
          .eq('id', editingBatchId);
        if (updateBatchError) throw updateBatchError;

        const { error: deleteOldRecordsError } = await supabase
          .from('tps_records').delete().eq('batch_id', editingBatchId);
        if (deleteOldRecordsError) throw deleteOldRecordsError;

        const recordsToInsert = tempRecords.map(record => ({
          batch_id: editingBatchId, ref_code: record.refCode, jk_code: record.jkCode,
          ctn: parseInt(record.ctn) || 0, tracking_number: record.tracking === "-" ? null : record.tracking, status: record.status
        }));

        const { error: insertNewRecordsError } = await supabase.from('tps_records').insert(recordsToInsert);
        if (insertNewRecordsError) throw insertNewRecordsError;
        setStatusMsg({ msg: `อัปเดตข้อมูลรอบบิลเรียบร้อยแล้วครับนาย!`, type: 'success' });
      } else {
        const payload = { batchDate, batchCode: batchCode || "-", records: tempRecords };
        const response = await fetch('/api/tps-ocr', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setStatusMsg({ msg: `บันทึกข้อมูลเข้าฐานข้อมูลสำเร็จ (${tempRecords.length} รายการ)!`, type: 'success' });
      }
      
      setBatchDate(new Date().toISOString().split('T')[0]);
      setBatchCode(""); setRefCode("TPS"); setJkCode(""); setCtn("1"); setTracking("");
      setTempRecords([]); setEditingBatchId(null); setIsModalOpen(false);
      fetchSystemRecords();
    } catch (error: any) {
      alert("บันทึกไม่สำเร็จ: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // --- 7. อัปเดต "ส่งสำเร็จทั้งบล็อก" ---
  const handleMarkBatchAsDelivered = async (batchId: number) => {
    try {
      const { error } = await supabase.from('tps_records').update({ status: 'delivered' }).eq('batch_id', batchId);
      if (error) throw error;
      setStatusMsg({ msg: "อัปเดตสถานะพัสดุทุกชิ้นในรอบบิลนี้เป็นส่งสำเร็จแล้วครับนาย!", type: 'success' });
      fetchSystemRecords();
    } catch (error: any) { alert("ไม่สามารถอัปเดตสถานะได้: " + error.message); }
  };

  // --- 8. ลบรอบจัดส่งพัสดุทั้งบล็อก ---
  const handleDeleteBatchBlock = async (batchId: number, batchCode: string) => {
    const confirmDelete = window.confirm(`นายแน่ใจนะว่าต้องการลบรอบบิล "${batchCode}" ทิ้งทั้งหมด?`);
    if (!confirmDelete) return;
    try {
      const { error } = await supabase.from('tps_batches').delete().eq('id', batchId);
      if (error) throw error;
      setStatusMsg({ msg: `ลบรอบจัดส่งออกเรียบร้อยครับนาย!`, type: 'success' });
      fetchSystemRecords();
    } catch (error: any) { alert("ไม่สามารถลบข้อมูลได้: " + error.message); }
  };

  return (
    <main className="p-4 md:p-8 bg-slate-50 min-h-screen text-slate-800 font-sans relative">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <Edit3 className="text-indigo-600" /> ระบบจัดการข้อมูล TPS (Web Admin)
            </h1>
            <p className="text-slate-500 text-sm">ตรวจสอบสถานะรอบจัดส่ง และสร้างรอบจัดส่งพัสดุใหม่</p>
          </div>
          <button onClick={handleOpenCreateModal} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95">
            <PackagePlus size={18} /> สร้างรอบจัดส่งใหม่
          </button>
        </div>

        {statusMsg && (
          <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 ${statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
            <CheckCircle2 size={20} /> <span className="text-sm font-bold">{statusMsg.msg}</span>
            <button onClick={() => setStatusMsg(null)} className="ml-auto p-1 hover:bg-white/50 rounded-lg"><X size={18} /></button>
          </div>
        )}

        <div className="space-y-6">
          <h2 className="text-base font-bold text-slate-700 flex items-center gap-2 mb-2">
            <Layers className="text-indigo-500" size={20}/> รอบการจัดส่งพัสดุในระบบ (Live Database)
          </h2>

          {isLoadingSystem ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 flex justify-center items-center text-slate-400"><Loader2 size={32} className="animate-spin text-indigo-600" /></div>
          ) : groupedSystemRecords.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 text-slate-400 flex flex-col items-center justify-center bg-slate-50/50">
              <PackageOpen size={56} className="text-slate-200 mb-4" /> <p className="text-sm text-slate-500">ไม่พบข้อมูลรอบจัดส่งในระบบเลยครับนาย</p>
            </div>
          ) : (
            groupedSystemRecords.map((batchBlock, bIdx) => (
              <div key={bIdx} className={`bg-white rounded-3xl shadow-sm border p-6 transition-all ${batchBlock.isAllDelivered ? 'border-slate-200 opacity-80' : 'border-orange-200 ring-2 ring-orange-500/5'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 mb-4 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600"><CalendarDays size={20} /></div>
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase">รอบบิลจัดส่ง ({batchBlock.batchDate})</div>
                      <div className="text-base font-bold text-slate-800">รหัสรอบ: <span className="text-indigo-600 font-extrabold">{batchBlock.batchCode}</span></div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:self-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-extrabold border mr-2 ${batchBlock.isAllDelivered ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                      {batchBlock.isAllDelivered ? "📦 ส่งสำเร็จครบทั้งหมดแล้ว" : `⚠️ กำลังจัดส่ง (${batchBlock.items.length} รายการ)`}
                    </span>
                    {!batchBlock.isAllDelivered && (
                      <button onClick={() => handleMarkBatchAsDelivered(batchBlock.batchId)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1 active:scale-95">
                        <Check size={14} /> กดส่งสำเร็จทั้งหมด
                      </button>
                    )}
                    <button onClick={() => handleOpenEditModal(batchBlock)} className="bg-amber-50 hover:bg-amber-500 text-amber-600 hover:text-white p-2 rounded-xl text-xs font-bold transition-all border border-amber-200 active:scale-95 flex items-center gap-1" title="แก้ไขรอบจัดส่งนี้">
                      <Edit3 size={15} /> แก้ไข
                    </button>
                    <button onClick={() => handleDeleteBatchBlock(batchBlock.batchId, batchBlock.batchCode)} className="bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white p-2 rounded-xl text-xs font-bold transition-all border border-rose-200 active:scale-95" title="ลบรอบจัดส่งนี้ทั้งหมด">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Ref Code</th><th className="px-4 py-2.5 font-semibold">JK Code</th>
                        <th className="px-4 py-2.5 font-semibold text-center">CTN</th><th className="px-4 py-2.5 font-semibold">Tracking</th>
                        <th className="px-4 py-2.5 font-semibold text-center">สถานะชิ้นย่อย</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {batchBlock.items.map((item: any, iIdx: number) => (
                        <tr key={iIdx} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5 font-bold text-slate-700">{item.refCode}</td>
                          <td className="px-4 py-2.5 text-slate-600">{item.jkCode}</td>
                          <td className="px-4 py-2.5 text-center"><span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-medium border border-slate-200">{item.ctn}</span></td>
                          <td className="px-4 py-2.5 text-slate-500">{item.trackingNumber || "-"}</td>
                          <td className="px-4 py-2.5 text-center"><span className={`text-[10px] font-bold ${item.status === 'delivered' ? 'text-emerald-600' : 'text-amber-600'}`}>{item.status === 'delivered' ? "● สำเร็จ" : "● กำลังไป"}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* --- 📦 โมดูล (Popup) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="font-bold text-slate-700 flex items-center gap-2">
                <PackagePlus size={20} className="text-indigo-600" /> {editingBatchId !== null ? "📝 แก้ไขรอบจัดส่งข้อมูล TPS" : "บันทึกรอบส่งพัสดุใหม่"}
              </h2>
              <button onClick={() => { setIsModalOpen(false); setTempRecords([]); }} className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-1.5 rounded-lg transition-colors"><X size={20} /></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-5 gap-6">
              
              <form onSubmit={handleAddToTempList} className="md:col-span-2 space-y-4 border-b md:border-b-0 md:border-r border-slate-100 pb-6 md:pb-0 md:pr-6">
                <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-50 space-y-3">
                  <h3 className="text-xs font-bold text-indigo-500 flex items-center gap-1.5 uppercase"><CalendarDays size={14}/> รอบจัดส่ง</h3>
                  <div><label className="block text-[11px] font-bold text-slate-500 mb-1">วันที่จัดส่ง</label><input type="date" value={batchDate} onChange={(e) => setBatchDate(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-100 text-sm bg-white" /></div>
                  <div><label className="block text-[11px] font-bold text-slate-500 mb-1">รหัสรอบบิล</label><input type="text" placeholder="เช่น ADN2026-07 (ไม่ใส่ได้)" value={batchCode} onChange={(e) => setBatchCode(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-100 text-sm font-bold text-indigo-700 bg-white" /></div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase"><PackageOpen size={14}/> ข้อมูลพัสดุ</h3>
                  <div><label className="block text-[11px] font-bold text-slate-500 mb-1">Ref Code *</label><input type="text" value={refCode} onChange={(e) => setRefCode(e.target.value)} className="w-full border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400 text-sm font-bold uppercase bg-slate-50" /></div>
                  <div><label className="block text-[11px] font-bold text-slate-500 mb-1">JK Code *</label><input type="text" placeholder="เช่น 0144397" value={jkCode} onChange={(e) => setJkCode(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-100 text-sm" /></div>
                  <div className="flex gap-2">
                    <div className="w-1/3"><label className="block text-[11px] font-bold text-slate-500 mb-1">CTN *</label><input type="number" min="1" value={ctn} onChange={(e) => setCtn(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-100 text-sm text-center" /></div>
                    <div className="w-2/3"><label className="block text-[11px] font-bold text-slate-500 mb-1">Tracking</label><input type="text" placeholder="เลขพัสดุ..." value={tracking} onChange={(e) => setTracking(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-100 text-sm" /></div>
                  </div>
                </div>
                <button type="submit" className="w-full bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-200 py-2.5 rounded-xl font-bold transition-all flex justify-center items-center gap-2 pt-2"><Plus size={16} /> ใส่ลงรายการด้านข้าง</button>
              </form>

              <div className="md:col-span-3 flex flex-col min-h-[300px]">
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex justify-between">
                  <span>ตารางตรวจสอบ (รอเซฟ)</span><span className="text-indigo-600 font-bold">{tempRecords.length} รายการ</span>
                </h3>

                {tempRecords.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl p-4 bg-slate-50/50"><p className="text-xs">กรอกข้อมูลพัสดุฝั่งซ้าย แล้วกดเพิ่ม รายการจะแสดงตรงนี้ครับนาย</p></div>
                ) : (
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="overflow-x-auto border border-slate-100 rounded-xl max-h-[320px] overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 sticky top-0">
                          <tr>
                            <th className="p-2 font-semibold">Ref Code</th><th className="p-2 font-semibold">JK Code</th>
                            <th className="p-2 font-semibold text-center">CTN</th><th className="p-2 font-semibold">Tracking</th>
                            <th className="p-2 font-semibold text-center">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {tempRecords.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-2 font-bold text-slate-700">{item.refCode}</td>
                              <td className="p-2 text-slate-600">{item.jkCode}</td>
                              <td className="p-2 text-center">{item.ctn}</td>
                              <td className="p-2 text-amber-600 font-medium">{item.tracking}</td>
                              <td className="p-2 text-center">
                                {/* 🌟 เปลี่ยนจากปุ่มลบอย่างเดียว เป็นปุ่มแก้ไขและลบครับ 🌟 */}
                                <div className="flex justify-center gap-1">
                                  <button type="button" onClick={() => handleEditTempItem(idx)} className="text-slate-400 hover:text-indigo-500 p-1 bg-white hover:bg-indigo-50 rounded" title="ดึงกลับไปแก้ไข">
                                    <Pencil size={14} />
                                  </button>
                                  <button type="button" onClick={() => handleRemoveFromTempList(idx)} className="text-slate-400 hover:text-rose-500 p-1 bg-white hover:bg-rose-50 rounded" title="ลบทิ้ง">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                      <button onClick={handleSaveBatchToDatabase} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 text-sm">
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {editingBatchId !== null ? "ยืนยันการแก้ไขข้อมูล" : "บันทึกพัสดุทั้งหมดลง Database"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

    </main>
  );
}
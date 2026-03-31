"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Search, RefreshCw, Edit3, Save, X, Trash2, RotateCcw, FileSpreadsheet, Calendar, AlertTriangle, CheckSquare
} from "lucide-react";

export default function DetailedDataCheckerPage() {
  const [allData, setAllData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- State สำหรับระบบ Bulk Edit ---
  const [isEditMode, setIsEditMode] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  // --- State สำหรับระบบ Filter ---
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterSource, setFilterSource] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // --- State สำหรับระบบ Checkbox ---
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  // --- State สำหรับ Infinite Scroll ---
  const [displayLimit, setDisplayLimit] = useState(50);

  // --- 1. ฟังก์ชันดึงข้อมูล ---
  const fetchDetailedData = async () => {
    setLoading(true);
    try {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name");
      const { data: teams } = await supabase.from("teams").select("id, name");

      const profileMap = (profiles || []).reduce((acc: any, curr) => { acc[curr.id] = curr.full_name; return acc; }, {});
      const teamMap = (teams || []).reduce((acc: any, curr) => { acc[curr.id] = curr.name; return acc; }, {});

      let allProjects: any[] = [];
      let isFetching = true;
      let startRow = 0;
      const step = 1000;

      while (isFetching) {
        const { data: mainData, error: mainError } = await supabase
          .from("order_item_projects")
          .select(`
            *,
            order_items ( 
              id, note, interest_level, order_id, product_category_id,
              orders (
                id, customer_name, phone, user_id, team_id, is_synced, source, audit_log
              )
            )
          `)
          .order("created_at", { ascending: false })
          .range(startRow, startRow + step - 1);

        if (mainError) throw mainError;
        if (mainData && mainData.length > 0) {
          allProjects = [...allProjects, ...mainData];
          startRow += step;
        }
        if (!mainData || mainData.length < step) isFetching = false;
      }

      const flattenedData = allProjects.map((proj: any) => {
        const item = proj.order_items || {};
        const order = item.orders || {};
        const isImported = order.audit_log === null || order.audit_log === undefined;

        return {
          id: proj.id,
          project_name: proj.project_name || "-",
          area_sqm: proj.area_sqm || 0,
          is_deleted: proj.is_deleted,
          created_at: proj.created_at,
          account_developer: proj.account_developer || "",
          contact_developer: proj.contact_developer || "",
          account_architecture: proj.account_architecture || "",
          contact_architecture: proj.contact_architecture || "",
          account_interior: proj.account_interior || "",
          contact_interior: proj.contact_interior || "",
          account_contractor: proj.account_contractor || "",
          contact_contractor: proj.contact_contractor || "",
          item_id: item.id || null,
          note: item.note || "",
          interest_level: item.interest_level || "",
          order_id: order.id || null,
          customer_name: order.customer_name || "-",
          phone: order.phone || "-",
          team_name: teamMap[order?.team_id] || "ไม่ระบุทีม",
          sales_name: profileMap[order?.user_id] || "ไม่ระบุเซลส์",
          data_source: isImported ? "IMPORT" : "APP", 
        };
      });

      setAllData(flattenedData);
      setFilteredData(flattenedData);
      setDrafts({});
      setIsEditMode(false);
      setSelectedRows([]);
    } catch (error: any) {
      console.error("Fetch Error:", error);
      alert(`ดึงข้อมูลไม่สำเร็จ: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDetailedData(); }, []);

  // --- 2. ฟังก์ชันระบบค้นหา & กรองข้อมูล ---
  useEffect(() => {
    let result = allData;
    if (filterStatus === "DELETED") result = result.filter(item => item.is_deleted === true);
    else if (filterStatus === "ACTIVE") result = result.filter(item => item.is_deleted === false || item.is_deleted === null);
    
    if (filterSource === "APP") result = result.filter(item => item.data_source === "APP");
    else if (filterSource === "IMPORT") result = result.filter(item => item.data_source === "IMPORT");
    
    if (searchTerm.trim() !== "") {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(item => 
        item.project_name.toLowerCase().includes(lowerSearch) ||
        item.customer_name.toLowerCase().includes(lowerSearch) ||
        item.sales_name.toLowerCase().includes(lowerSearch) ||
        item.id.toLowerCase().includes(lowerSearch)
      );
    }
    if (startDate) {
      const startTime = new Date(startDate).getTime();
      result = result.filter(item => new Date(item.created_at).getTime() >= startTime);
    }
    if (endDate) {
      const endTime = new Date(endDate).getTime();
      result = result.filter(item => new Date(item.created_at).getTime() <= endTime);
    }
    setFilteredData(result);
    setDisplayLimit(50);
  }, [searchTerm, filterStatus, filterSource, startDate, endDate, allData]);

  // --- 3. ฟังก์ชันระบบจัดการ Checkbox ---
  const dataToDisplay = filteredData.slice(0, displayLimit);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedRows(dataToDisplay.map(item => item.id));
    else setSelectedRows([]);
  };

  const handleSelectRow = (id: string) => {
    setSelectedRows(prev => prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]);
  };

  // --- ตรรกะเช็คสถานะข้อมูลที่ถูกเลือก (เพื่อโชว์ปุ่มให้ถูก) ---
  const selectedItems = dataToDisplay.filter(item => selectedRows.includes(item.id));
  const hasActiveSelected = selectedItems.some(item => !item.is_deleted);
  const hasDeletedSelected = selectedItems.some(item => item.is_deleted);

  // --- 4. ฟังก์ชันจัดการการลบ/กู้คืน (Bulk Actions) ---
  const handleBulkStatusChange = async (isDeleted: boolean) => {
    const actionText = isDeleted ? "ย้ายลงถังขยะ" : "กู้คืน";
    if (!window.confirm(`ยืนยันการ${actionText} ${selectedRows.length} รายการ?`)) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('order_item_projects').update({ is_deleted: isDeleted }).in('id', selectedRows);
      if (error) throw error;
      setAllData(prev => prev.map(item => selectedRows.includes(item.id) ? { ...item, is_deleted: isDeleted } : item));
      setSelectedRows([]);
    } catch (error: any) { alert(`ทำรายการไม่สำเร็จ: ${error.message}`); } finally { setSaving(false); }
  };

  const handleBulkHardDelete = async () => {
    if (!window.confirm(`⚠️ คำเตือนระดับสูงสุด: คุณกำลังจะ "ลบถาวร" ${selectedRows.length} รายการออกจากฐานข้อมูล (Orders/Items/Projects)\n\nข้อมูลจะหายไปตลอดกาล ยืนยันหรือไม่?`)) return;
    setSaving(true);
    try {
      const itemsToDelete = allData.filter(d => selectedRows.includes(d.id));
      const projectIds = itemsToDelete.map(p => p.id);
      const itemIds = itemsToDelete.map(p => p.item_id).filter(Boolean);
      const orderIds = itemsToDelete.map(p => p.order_id).filter(Boolean);

      if (projectIds.length > 0) await supabase.from('order_item_projects').delete().in('id', projectIds);
      if (itemIds.length > 0) await supabase.from('order_items').delete().in('id', itemIds);
      if (orderIds.length > 0) await supabase.from('orders').delete().in('id', orderIds);

      setAllData(prev => prev.filter(item => !selectedRows.includes(item.id)));
      setSelectedRows([]);
      alert('ถอนรากถอนโคนเรียบร้อยครับ!');
    } catch (error: any) { alert(`ลบไม่สำเร็จ: ${error.message}`); } finally { setSaving(false); }
  };

  // --- 5. ฟังก์ชันระบบแก้ข้อมูล (Bulk Edit) ---
  const handleDraftChange = (rowId: string, field: string, value: any) => {
    setDrafts((prev) => ({ ...prev, [rowId]: { ...(prev[rowId] || {}), [field]: value } }));
  };

  const handleSaveAllChanges = async () => {
    const rowIdsToUpdate = Object.keys(drafts);
    if (rowIdsToUpdate.length === 0) return setIsEditMode(false);
    if (!window.confirm(`ยืนยันการบันทึก ${rowIdsToUpdate.length} รายการ?`)) return;
    setSaving(true);
    try {
      for (const id of rowIdsToUpdate) {
        const changes = drafts[id];
        const originalRow = allData.find(r => r.id === id);
        if (!originalRow) continue;
        const projectPayload: any = {}; const itemPayload: any = {}; const orderPayload: any = {};
        const projectFields = ['project_name', 'area_sqm', 'created_at', 'account_developer', 'contact_developer', 'account_architecture', 'contact_architecture', 'account_interior', 'contact_interior', 'account_contractor', 'contact_contractor'];
        const itemFields = ['note', 'interest_level'];
        const orderFields = ['customer_name', 'phone'];
        for (const key in changes) {
          if (projectFields.includes(key)) projectPayload[key] = changes[key];
          if (itemFields.includes(key)) itemPayload[key] = changes[key];
          if (orderFields.includes(key)) orderPayload[key] = changes[key];
        }
        if (Object.keys(projectPayload).length > 0) await supabase.from('order_item_projects').update(projectPayload).eq('id', id);
        if (Object.keys(itemPayload).length > 0 && originalRow.item_id) await supabase.from('order_items').update(itemPayload).eq('id', originalRow.item_id);
        if (Object.keys(orderPayload).length > 0 && originalRow.order_id) await supabase.from('orders').update(orderPayload).eq('id', originalRow.order_id);
      }
      setAllData(prev => prev.map(item => drafts[item.id] ? { ...item, ...drafts[item.id] } : item));
      setDrafts({});
      setIsEditMode(false);
    } catch (error: any) { alert(`ไม่สำเร็จ: ${error.message}`); } finally { setSaving(false); }
  };

  const handleCancelEdit = () => {
    if (Object.keys(drafts).length > 0 && !window.confirm("ยกเลิกการแก้ไขใช่หรือไม่?")) return;
    setDrafts({}); setIsEditMode(false);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 100 && displayLimit < filteredData.length) setDisplayLimit(prev => prev + 50);
  };

  const EditableCell = ({ row, field, type = "text", width = "w-full" }: { row: any, field: string, type?: string, width?: string }) => {
    if (!isEditMode) return <span className="truncate">{row[field] || "-"}</span>;
    let value = drafts[row.id]?.[field] ?? row[field] ?? "";
    if (type === "datetime-local" && value && !drafts[row.id]?.[field]) value = new Date(value).toISOString().slice(0, 16);
    return (
      <input type={type} value={value} onChange={(e) => handleDraftChange(row.id, field, e.target.value)}
        className={`${width} px-2 py-1 text-xs border border-blue-300 bg-white rounded outline-none focus:ring-2 focus:ring-blue-500 shadow-sm`}
      />
    );
  };

  return (
    <div className="fixed inset-0 z-0 pt-20 px-4 md:px-5 pb-5 bg-slate-100 flex flex-col font-sans overflow-hidden">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex-1 flex flex-col overflow-hidden relative">
        
        {/* --- Toolbar --- */}
        <div className="flex-none bg-white border-b border-gray-200 px-5 py-3 shadow-sm z-20 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white shadow-sm"><FileSpreadsheet size={20} /></div>
            <div>
              <h1 className="text-lg font-bold text-gray-800 leading-none">DataSheet Pro</h1>
              <p className="text-xs text-gray-500 mt-1">{filteredData.length} Records</p>
            </div>
          </div>

          <div className="flex flex-wrap w-full xl:w-auto items-center gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-2.5 top-2.5 text-gray-400" />
              <input type="text" placeholder="ค้นหา..." className="w-32 md:w-36 lg:w-48 border rounded-md pl-9 pr-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} disabled={isEditMode} />
            </div>

            <div className="flex items-center gap-1 bg-gray-50 border rounded-md px-2 py-1">
              <Calendar size={14} className="text-gray-500" />
              <input type="datetime-local" className="bg-transparent text-xs outline-none w-[130px]" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={isEditMode} />
              <span className="text-gray-400">-</span>
              <input type="datetime-local" className="bg-transparent text-xs outline-none w-[130px]" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={isEditMode} />
            </div>

            <select className="border rounded-md px-2 py-1.5 text-sm bg-blue-50 text-blue-800 font-medium outline-none" value={filterSource} onChange={(e) => setFilterSource(e.target.value)} disabled={isEditMode}>
              <option value="ALL">ที่มา: ทั้งหมด</option>
              <option value="APP">📱 ผ่านแอปฯ</option>
              <option value="IMPORT">📁 นำเข้าไฟล์</option>
            </select>

            <select className="border rounded-md px-2 py-1.5 text-sm outline-none" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} disabled={isEditMode}>
              <option value="ALL">สถานะ: ทั้งหมด</option>
              <option value="ACTIVE">ปกติ</option>
              <option value="DELETED">ถังขยะ</option>
            </select>

            <div className="w-px h-6 bg-gray-300 mx-1 hidden lg:block"></div>

            {/* 🔥 Smart Bulk Action Buttons (ทำงานแบบมืออาชีพ) */}
            {!isEditMode && selectedRows.length > 0 && (
              <div className="flex gap-1.5 animate-fade-in bg-slate-800 p-1.5 rounded-lg border border-slate-700 shadow-md">
                <div className="px-2 py-1 text-white text-xs font-medium border-r border-slate-600 flex items-center">
                  <CheckSquare size={14} className="mr-1.5 text-blue-400" /> เลือก {selectedRows.length}
                </div>
                
                {hasDeletedSelected && (
                  <button onClick={() => handleBulkStatusChange(false)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded-md text-xs font-bold shadow flex items-center gap-1.5 transition">
                    <RotateCcw size={14} /> กู้คืน
                  </button>
                )}
                
                {hasActiveSelected && (
                  <button onClick={() => handleBulkStatusChange(true)} className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-md text-xs font-bold shadow flex items-center gap-1.5 transition">
                    <Trash2 size={14} /> ถังขยะ
                  </button>
                )}

                <button onClick={handleBulkHardDelete} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-xs font-bold shadow flex items-center gap-1.5 transition ml-1">
                  <AlertTriangle size={14} /> ลบถาวร
                </button>
              </div>
            )}

            {isEditMode ? (
              <div className="flex gap-2">
                <button onClick={handleSaveAllChanges} className="bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-bold shadow hover:bg-blue-700 transition flex items-center gap-2"><Save size={16} /> บันทึก</button>
                <button onClick={handleCancelEdit} className="bg-gray-100 text-gray-700 border hover:bg-gray-200 transition px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2"><X size={16} /> ยกเลิก</button>
              </div>
            ) : (
              <button onClick={() => setIsEditMode(true)} className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-md text-sm font-medium shadow transition flex items-center gap-2"><Edit3 size={16} /> แก้ไขตาราง</button>
            )}

            {!isEditMode && (
              <button onClick={fetchDetailedData} disabled={loading} className="bg-gray-50 border hover:bg-gray-100 px-2 py-1.5 rounded-md transition"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
            )}
          </div>
        </div>

        {/* --- Table --- */}
        <div className="flex-1 overflow-auto bg-gray-50 relative custom-scrollbar" onScroll={handleScroll}>
          <table className="w-full text-left border-collapse whitespace-nowrap min-w-max">
            <thead className="bg-slate-200 text-slate-600 text-[11px] uppercase font-bold sticky top-0 z-20 shadow-sm border-b border-slate-300 tracking-wider">
              <tr>
                {!isEditMode && <th className="px-3 py-2.5 border-r border-slate-300 sticky left-0 bg-slate-200 z-30 text-center w-10 shadow-[1px_0_0_#cbd5e1]"><input type="checkbox" className="cursor-pointer w-3.5 h-3.5 accent-blue-600" onChange={handleSelectAll} checked={dataToDisplay.length > 0 && selectedRows.length === dataToDisplay.length} /></th>}
                <th className="px-4 py-2.5 border-r border-slate-300">วันที่สร้าง / ที่มา</th>
                <th className="px-4 py-2.5 border-r border-slate-300">ชื่อโปรเจกต์</th>
                <th className="px-4 py-2.5 border-r border-slate-300 text-right">พื้นที่ (ตร.ม.)</th>
                <th className="px-4 py-2.5 border-r border-slate-300">ชื่อลูกค้า</th>
                <th className="px-4 py-2.5 border-r border-slate-300">เบอร์โทรศัพท์</th>
                <th className="px-4 py-2.5 border-r border-slate-300">เซลส์ดูแล</th>
                <th className="px-4 py-2.5 border-r border-slate-300">ความสนใจ</th>
                <th className="px-4 py-2.5 border-r border-slate-300">หมายเหตุ</th>
                <th className="px-4 py-2.5 border-r border-slate-300">Developer</th>
                <th className="px-4 py-2.5 border-r border-slate-300">Architect</th>
                <th className="px-4 py-2.5 border-r border-slate-300">Interior</th>
                <th className="px-4 py-2.5 border-slate-300">Contractor</th>
                {/* ❌ เอาคอลัมน์ จัดการ ทิ้งไปแล้วตามสั่งครับ ❌ */}
              </tr>
            </thead>
            <tbody className="bg-white text-xs text-gray-800">
              {loading ? (
                <tr><td colSpan={17} className="text-center py-20 text-slate-500 font-medium"><RefreshCw size={20} className="animate-spin inline mr-2 text-blue-500" /> กำลังประมวลผลข้อมูล...</td></tr>
              ) : dataToDisplay.length === 0 ? (
                <tr><td colSpan={17} className="text-center py-20 text-slate-500 font-medium">ไม่พบข้อมูล</td></tr>
              ) : (
                dataToDisplay.map((row) => (
                  <tr key={row.id} className={`hover:bg-blue-50/40 transition-colors border-b border-slate-200 
                    ${row.is_deleted ? 'bg-slate-50 text-slate-400' : ''} 
                    ${selectedRows.includes(row.id) ? 'bg-blue-50/80' : ''}`}>
                    
                    {!isEditMode && <td className={`px-3 py-1.5 border-r border-slate-200 sticky left-0 z-10 text-center shadow-[1px_0_0_#e2e8f0] ${selectedRows.includes(row.id) ? 'bg-blue-50' : 'bg-inherit'}`}><input type="checkbox" className="cursor-pointer w-3.5 h-3.5 accent-blue-600" checked={selectedRows.includes(row.id)} onChange={() => handleSelectRow(row.id)} /></td>}
                    
                    <td className="px-3 py-2 border-r border-slate-200 min-w-[150px]">
                      <div className="flex flex-col gap-1">
                        <span className={row.is_deleted ? 'line-through opacity-70' : ''}>{new Date(row.created_at).toLocaleString("th-TH")}</span>
                        <div className="flex gap-1">
                          {row.data_source === "IMPORT" ? <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[10px] w-fit font-semibold border border-purple-200">📁 IMPORT</span> : <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] w-fit font-semibold border border-blue-200">📱 APP</span>}
                          {row.is_deleted && <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded text-[10px] w-fit font-semibold border border-red-200">🗑️ ถังขยะ</span>}
                        </div>
                      </div>
                    </td>
                    <td className={`px-3 py-1.5 border-r border-slate-200 font-bold min-w-[200px] ${row.is_deleted ? 'text-slate-400' : 'text-slate-700'}`}><EditableCell row={row} field="project_name" /></td>
                    <td className="px-3 py-1.5 border-r border-slate-200 text-right min-w-[80px] font-mono"><EditableCell row={row} field="area_sqm" type="number" /></td>
                    <td className="px-3 py-1.5 border-r border-slate-200 min-w-[150px]"><EditableCell row={row} field="customer_name" /></td>
                    <td className="px-3 py-1.5 border-r border-slate-200 min-w-[120px]"><EditableCell row={row} field="phone" /></td>
                    <td className="px-3 py-1.5 border-r border-slate-200 font-bold min-w-[120px]"><EditableCell row={row} field="sales_name" /></td>
                    <td className="px-3 py-1.5 border-r border-slate-200 min-w-[100px]"><EditableCell row={row} field="interest_level" /></td>
                    <td className="px-3 py-1.5 border-r border-slate-200 min-w-[200px] italic"><EditableCell row={row} field="note" /></td>
                    <td className="px-3 py-1.5 border-r border-slate-200 text-slate-500"><EditableCell row={row} field="account_developer" /></td>
                    <td className="px-3 py-1.5 border-r border-slate-200 text-slate-500"><EditableCell row={row} field="account_architecture" /></td>
                    <td className="px-3 py-1.5 border-r border-slate-200 text-slate-500"><EditableCell row={row} field="account_interior" /></td>
                    <td className="px-3 py-1.5 border-slate-200 text-slate-500"><EditableCell row={row} field="account_contractor" /></td>
                    {/* ❌ ไม่มีคอลัมน์ จัดการ แล้ว ❌ */}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `.animate-fade-in { animation: fadeIn 0.2s ease-in-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: translateY(0); } } .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; } .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }`}} />
    </div>
  );
}
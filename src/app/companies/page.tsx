"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Building2, Tags, Plus, Save, Trash2, 
  ArrowLeft, CheckCircle2, Loader2, Search, Filter, 
  ChevronRight, AlertCircle, X, CheckSquare, Square, FileUp, UploadCloud
} from 'lucide-react';
import Link from 'next/link';
import Papa from 'papaparse'; // ✅ Import สำหรับอ่าน CSV

export default function ManageCompaniesPage() {
  const [loading, setLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<{msg: string, type: 'info' | 'success' | 'error'} | null>(null);
  const [customerTypes, setCustomerTypes] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState('all'); 
  const [typeName, setTypeName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [formTypeId, setFormTypeId] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const { data: types } = await supabase.from('customer_types').select('*').order('name');
    if (types) setCustomerTypes(types);

    const { data: comps } = await supabase
      .from('companies')
      .select(`id, name, created_at, customer_type_id, customer_types ( name )`)
      .order('created_at', { ascending: false });
    
    if (comps) setCompanies(comps);
    setSelectedIds([]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // 🔥 ฟังก์ชันสร้างและดาวน์โหลดไฟล์ CSV ตัวอย่าง
  const handleDownloadTemplate = () => {
    const headers = "customer,companies\n"; 
    const sampleData = "บริษัท แสนสิริ จำกัด (มหาชน),Developer\nบริษัท สถาปนิก 49 จำกัด,Architect\n2601 House,Developer"; 
    const csvContent = headers + sampleData;
    
    // สร้าง Blob สำหรับดาวน์โหลด (ใส่ \uFEFF เพื่อให้ Excel อ่านภาษาไทยได้ไม่เพี้ยน)
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'template_partner_import.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 🔥 ฟังก์ชันอัปโหลด CSV แบบอัจฉริยะ
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setImportStatus({ msg: 'กำลังอ่านไฟล์และประมวลผล...', type: 'info' });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        let successCount = 0;
        let errorCount = 0;

        for (const row of rows) {
          // คอลัมน์ A: customer (ชื่อบริษัท), คอลัมน์ B: companies (ประเภท)
          const compName = row.customer?.trim();
          const typeNameInCsv = row.companies?.trim();

          if (!compName || !typeNameInCsv) continue;

          try {
            let typeId = customerTypes.find(t => t.name === typeNameInCsv)?.id;

            if (!typeId) {
              const { data: newType } = await supabase
                .from('customer_types')
                .insert([{ name: typeNameInCsv }])
                .select()
                .single();
              
              if (newType) {
                typeId = newType.id;
                customerTypes.push(newType); 
              }
            }

            if (typeId) {
              const { error: compErr } = await supabase
                .from('companies')
                .upsert([{ name: compName, customer_type_id: typeId }], { onConflict: 'name,customer_type_id' });
              
              if (!compErr) successCount++;
              else errorCount++;
            }
          } catch (err) {
            errorCount++;
          }
        }

        setImportStatus({ 
          msg: `นำเข้าสำเร็จ ${successCount} รายการ ${errorCount > 0 ? `(ล้มเหลว ${errorCount})` : ''}`, 
          type: 'success' 
        });
        fetchData();
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  };

  const toggleSelectAll = (filteredItems: any[]) => {
    if (selectedIds.length === filteredItems.length) setSelectedIds([]);
    else setSelectedIds(filteredItems.map(item => item.id));
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`ลบ ${selectedIds.length} รายการ?`)) return;
    setLoading(true);
    const { error } = await supabase.from('companies').delete().in('id', selectedIds);
    if (error) alert("ลบบางรายการไม่ได้เนื่องจากติดข้อมูล Order");
    else { setSelectedIds([]); fetchData(); }
    setLoading(false);
  };

  const handleAddType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeName) return;
    const { error } = await supabase.from('customer_types').insert([{ name: typeName }]);
    if (error) alert(error.message); else { setTypeName(''); fetchData(); }
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !formTypeId) return;
    const { error } = await supabase.from('companies').insert([{ name: companyName, customer_type_id: formTypeId }]);
    if (error) alert("ข้อมูลซ้ำ"); else { setCompanyName(''); fetchData(); }
  };

  const filteredCompanies = companies.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    let matchType = selectedTypeId === 'all' ? true : (selectedTypeId === 'none' ? c.customer_type_id === null : c.customer_type_id === selectedTypeId);
    return matchSearch && matchType;
  });

  return (
    <main className="p-4 md:p-8 bg-slate-50 min-h-screen text-slate-800 font-sans relative">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 bg-white rounded-xl shadow-sm hover:bg-slate-100 border border-slate-200 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="text-indigo-600" /> Partner Management
            </h1>
            <p className="text-slate-500 text-sm">จัดการข้อมูลคู่ค้าและระบบนำเข้าข้อมูลแบบกลุ่ม</p>
          </div>
        </div>

        {/* 🔥 โซนปุ่มนำเข้าและดาวน์โหลด Template */}
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={handleDownloadTemplate}
            className="bg-white hover:bg-slate-50 text-slate-600 px-4 py-2.5 rounded-2xl font-bold flex items-center gap-2 border border-slate-200 transition-all active:scale-95 text-sm shadow-sm"
          >
            <FileUp size={18} />
            โหลด Template
          </button>

          <div className="relative">
            <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" ref={fileInputRef} />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-100 transition-all active:scale-95 text-sm"
            >
              <UploadCloud size={20} />
              นำเข้า CSV
            </button>
          </div>
        </div>
      </div>

      {/* แจ้งเตือนสถานะการ Import */}
      {importStatus && (
        <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${
          importStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 
          importStatus.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
        }`}>
          {importStatus.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-bold">{importStatus.msg}</span>
          <button onClick={() => setImportStatus(null)} className="ml-auto p-1 hover:bg-white/50 rounded-lg"><X size={18} /></button>
        </div>
      )}

      {/* --- ส่วนฟอร์มเพิ่มข้อมูล --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <h2 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2 text-indigo-500"><Tags size={16}/> 1. เพิ่มประเภท</h2>
          <form onSubmit={handleAddType} className="flex gap-2">
            <input type="text" value={typeName} onChange={(e) => setTypeName(e.target.value)} placeholder="เช่น อสังหาฯ..." className="flex-1 border border-slate-200 rounded-2xl px-4 py-3 outline-none" />
            <button type="submit" className="bg-indigo-600 text-white px-5 rounded-2xl font-bold transition-transform active:scale-95"><Plus size={20} /></button>
          </form>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <h2 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2 text-emerald-500"><Building2 size={16}/> 2. เพิ่มบริษัท</h2>
          <form onSubmit={handleAddCompany} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={formTypeId} onChange={(e) => setFormTypeId(e.target.value)} className="border border-slate-200 rounded-2xl px-4 py-3 bg-slate-50 text-sm outline-none cursor-pointer">
              <option value="">เลือกประเภท...</option>
              {customerTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div className="flex gap-2">
              <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="ชื่อบริษัท..." className="flex-1 border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none" />
              <button type="submit" className="bg-emerald-600 text-white px-5 rounded-2xl font-bold transition-transform active:scale-95"><Save size={20} /></button>
            </div>
          </form>
        </div>
      </div>

      {/* --- ส่วนตารางพาร์ทเนอร์ --- */}
      <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden mb-20">
        <div className="p-6 border-b border-slate-100 space-y-6 bg-slate-50/30">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2"><Filter size={20} className="text-indigo-600" /> คลังข้อมูลพาร์ทเนอร์</h3>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder="ค้นหาชื่อบริษัท..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-indigo-500/10 outline-none shadow-sm transition-all" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-2">กรองตามประเภท:</span>
            <button onClick={() => setSelectedTypeId('all')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${selectedTypeId === 'all' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}>ทั้งหมด</button>
            <button onClick={() => setSelectedTypeId('none')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${selectedTypeId === 'none' ? 'bg-rose-600 border-rose-600 text-white shadow-md' : 'bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-100'}`}><AlertCircle size={14} />ไม่ระบุประเภท</button>
            {customerTypes.map(type => (
              <button key={type.id} onClick={() => setSelectedTypeId(type.id)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${selectedTypeId === type.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-indigo-50 border-transparent text-indigo-600 hover:bg-indigo-100'}`}>{type.name}</button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto p-2">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-400 text-[11px] font-black uppercase tracking-[0.2em]">
                <th className="px-6 py-5 w-10">
                  <button onClick={() => toggleSelectAll(filteredCompanies)} className="text-slate-400 hover:text-indigo-600 transition-colors">
                    {selectedIds.length === filteredCompanies.length && filteredCompanies.length > 0 ? <CheckSquare size={20} className="text-indigo-600" /> : <Square size={20} />}
                  </button>
                </th>
                <th className="px-4 py-5 text-sm">Partner Name</th>
                <th className="px-6 py-5">Category</th>
                <th className="px-6 py-5">Registration</th>
                <th className="px-6 py-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-indigo-500" /></td></tr>
              ) : filteredCompanies.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-20 italic text-slate-400">ไม่พบข้อมูล</td></tr>
              ) : (
                filteredCompanies.map((comp) => (
                  <tr key={comp.id} className={`hover:bg-indigo-50/30 transition-colors group ${selectedIds.includes(comp.id) ? 'bg-indigo-50/50' : ''}`}>
                    <td className="px-6 py-5">
                      <button onClick={() => toggleSelectOne(comp.id)} className="text-slate-400 hover:text-indigo-600 transition-colors">
                        {selectedIds.includes(comp.id) ? <CheckSquare size={20} className="text-indigo-600" /> : <Square size={20} />}
                      </button>
                    </td>
                    <td className="px-4 py-5 font-extrabold text-slate-700 text-sm">{comp.name}</td>
                    <td className="px-6 py-5">
                      <span className="bg-white text-slate-600 px-3 py-1.5 rounded-xl text-[11px] font-bold border border-slate-200">{comp.customer_types?.name || 'ทั่วไป'}</span>
                    </td>
                    <td className="px-6 py-5 text-slate-400 text-xs">{new Date(comp.created_at).toLocaleDateString('th-TH')}</td>
                    <td className="px-6 py-5 text-right">
                      <button onClick={() => { if(confirm('ลบรายการนี้?')) { supabase.from('companies').delete().eq('id', comp.id).then(() => fetchData()) } }} className="p-2 text-slate-300 hover:text-rose-500 transition-all"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 z-[100] border border-slate-700 animate-in fade-in zoom-in slide-in-from-bottom-4">
          <span className="text-sm font-bold border-r border-slate-700 pr-6">เลือกอยู่ {selectedIds.length} รายการ</span>
          <div className="flex gap-3">
            <button onClick={() => setSelectedIds([])} className="text-sm font-bold text-slate-400 hover:text-white transition-colors">ยกเลิก</button>
            <button onClick={handleBulkDelete} className="bg-rose-500 hover:bg-rose-600 px-5 py-2 rounded-xl text-sm font-black flex items-center gap-2 transition-all active:scale-95">
              <Trash2 size={16} /> ลบทั้งหมด
            </button>
          </div>
        </div>
      )}

    </main>
  );
}
'use client';

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { FileSpreadsheet, Filter, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const columns = [
  { key: 'piSupplier', label: 'PI-Supplier' }, { key: 'date', label: 'Date' }, { key: 'supplier', label: 'Supplier' },
  { key: 'linkFile', label: 'Link/File' }, { key: 'etd', label: 'ETD' }, { key: 'brand', label: 'Band' },
  { key: 'orderNo', label: 'Order_NO.' }, { key: 'file', label: 'File' }, { key: 'saleName', label: 'Sale_Name' },
  { key: 'projectName', label: 'Project_name' }, { key: 'paymentDate', label: 'Payment_Date' },
  { key: 'deliveredDate', label: 'Delivered_Date' }, { key: 'dateOrder', label: 'Date_Order / วันที่ลูกค้าชำระเงิน' },
] as const;

type ColumnKey = (typeof columns)[number]['key'];
type PiRecord = Record<ColumnKey, string> & { id: string; linkFileUrl: string; fileUrl: string };

type DatabasePiRecord = {
  id: string; pi_supplier: string; record_date: string; supplier: string; link_file: string; link_file_url: string;
  etd: string; brand: string; order_no: string; file_name: string; file_url: string; sale_name: string;
  project_name: string; payment_date: string; delivered_date: string; date_order: string;
};

const storageKey = 'wallcraft-pi-records-v1';
const headerAliases: Record<ColumnKey, string[]> = {
  piSupplier: ['pi-supplier', 'pi supplier', 'pisupplier'], date: ['date'], supplier: ['supplier'],
  linkFile: ['link/file', 'link file', 'linkfile'], etd: ['etd'], brand: ['band', 'brand'],
  orderNo: ['order_no.', 'order_no', 'order no', 'orderno', 'order number'], file: ['file'],
  saleName: ['sale_name', 'sale name', 'salename'], projectName: ['project_name', 'project name', 'projectname'],
  paymentDate: ['payment_date', 'payment date', 'paymentdate'], deliveredDate: ['delivered_date', 'delivered date', 'delivereddate'],
  dateOrder: ['date_order / วันที่ลูกค้าชำระเงิน', 'date_order', 'date order', 'วันที่ลูกค้าชำระเงิน'],
};

function normaliseHeader(value: string) {
  return value.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function emptyRecord(): Omit<PiRecord, 'id'> {
  return { ...Object.fromEntries(columns.map(({ key }) => [key, ''])), linkFileUrl: '', fileUrl: '' } as Omit<PiRecord, 'id'>;
}

function emptyFilters(): Record<ColumnKey, string> {
  return Object.fromEntries(columns.map(({ key }) => [key, ''])) as Record<ColumnKey, string>;
}

function fromDatabaseRecord(record: DatabasePiRecord): PiRecord {
  return {
    id: record.id, piSupplier: record.pi_supplier, date: record.record_date, supplier: record.supplier,
    linkFile: record.link_file, linkFileUrl: record.link_file_url, etd: record.etd, brand: record.brand,
    orderNo: record.order_no, file: record.file_name, fileUrl: record.file_url, saleName: record.sale_name,
    projectName: record.project_name, paymentDate: record.payment_date, deliveredDate: record.delivered_date,
    dateOrder: record.date_order,
  };
}

function toDatabaseRecord(record: PiRecord): DatabasePiRecord {
  return {
    id: record.id, pi_supplier: record.piSupplier, record_date: record.date, supplier: record.supplier,
    link_file: record.linkFile, link_file_url: record.linkFileUrl, etd: record.etd, brand: record.brand,
    order_no: record.orderNo, file_name: record.file, file_url: record.fileUrl, sale_name: record.saleName,
    project_name: record.projectName, payment_date: record.paymentDate, delivered_date: record.deliveredDate,
    date_order: record.dateOrder,
  };
}

function getLinkDetails(value: string, helperUrl?: string) {
  const text = value.trim();
  if (helperUrl && /^https?:\/\//i.test(helperUrl.trim())) return { href: helperUrl.trim(), label: text || 'เปิดไฟล์' };
  const formulaMatch = text.match(/^=HYPERLINK\(\s*"([^"]+)"(?:\s*,\s*"([^"]*)")?\s*\)$/i);
  if (formulaMatch) return { href: formulaMatch[1], label: formulaMatch[2] || 'เปิดไฟล์' };
  if (/^https?:\/\//i.test(text)) return { href: text, label: text };
  return null;
}

export default function PiRecordPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [records, setRecords] = useState<PiRecord[]>([]);
  const [search, setSearch] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [filters, setFilters] = useState<Record<ColumnKey, string>>(() => emptyFilters());
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadRecords = async () => {
      let savedRecords: PiRecord[] = [];
      try { savedRecords = JSON.parse(window.localStorage.getItem(storageKey) || '[]'); }
      catch { savedRecords = []; }

      const { data, error } = await supabase.from('pi_records').select('*').order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        console.warn('Unable to read PI records from Supabase:', error);
        setRecords(savedRecords);
        const tableUnavailable = error.message.includes("Could not find the table 'public.pi_records' in the schema cache");
        setMessage(tableUnavailable
          ? 'ระบบกำลังเตรียมตาราง PI Record กรุณารีเฟรชหน้านี้อีกครั้ง'
          : 'กำลังแสดงข้อมูลเดิมจากเครื่องนี้ เนื่องจากยังเชื่อมฐานข้อมูลไม่ได้');
        return;
      }

      const remoteRecords = ((data || []) as DatabasePiRecord[]).map(fromDatabaseRecord);
      if (remoteRecords.length > 0 || savedRecords.length === 0) {
        setRecords(remoteRecords);
        return;
      }

      // Migrate records previously stored only in this browser on the first load.
      const { error: migrateError } = await supabase.from('pi_records').upsert(savedRecords.map(toDatabaseRecord), { onConflict: 'id' });
      if (migrateError) {
        setRecords(savedRecords);
        setMessage('ย้ายข้อมูลเดิมไปฐานข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        return;
      }
      setRecords(savedRecords);
      setMessage(`ย้ายข้อมูลเดิม ${savedRecords.length} รายการไปฐานข้อมูลแล้ว`);
    };
    void loadRecords();
    return () => { cancelled = true; };
  }, []);

  const saveRecords = async (nextRecords: PiRecord[]) => {
    setRecords(nextRecords);
    try { window.localStorage.setItem(storageKey, JSON.stringify(nextRecords)); }
    catch (error) { console.error('Unable to save PI records:', error); setMessage('บันทึกข้อมูลในเบราว์เซอร์ไม่สำเร็จ'); }
    const { error } = await supabase.from('pi_records').upsert(nextRecords.map(toDatabaseRecord), { onConflict: 'id' });
    if (error) {
      console.error('Unable to save PI records to Supabase:', error);
      setMessage('บันทึกลงฐานข้อมูลไม่สำเร็จ ข้อมูลถูกเก็บไว้ในเครื่องนี้ชั่วคราว');
    }
  };

  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesSearch = !keyword || columns.some(({ key }) => record[key].toLowerCase().includes(keyword));
      const matchesFilters = columns.every(({ key }) => !filters[key].trim() || record[key].toLowerCase().includes(filters[key].trim().toLowerCase()));
      return matchesSearch && matchesFilters;
    });
  }, [filters, records, search]);

  const activeFilterCount = columns.filter(({ key }) => filters[key].trim()).length;

  const filterOptions = useMemo(() => Object.fromEntries(
    columns.map(({ key }) => [key, Array.from(new Set(records.map((record) => record[key].trim()).filter((value) => value && value !== '-'))).sort((a, b) => a.localeCompare(b, 'th'))]),
  ) as Record<ColumnKey, string[]>, [records]);

  const importCsv = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) { setMessage('กรุณาเลือกไฟล์ .csv เท่านั้น'); return; }
    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: 'greedy',
      complete: (result) => {
        const sourceHeaders = result.meta.fields?.map(normaliseHeader) || [];
        const matchedFields = columns.filter(({ key }) => headerAliases[key].some((alias) => sourceHeaders.includes(alias)));
        if (matchedFields.length === 0) { setMessage('ไม่พบหัวคอลัมน์ PI Record ในไฟล์ CSV'); return; }
        const importedRecords = result.data.map((sourceRow) => {
          const normalisedRow = Object.fromEntries(Object.entries(sourceRow).map(([key, value]) => [normaliseHeader(key), String(value ?? '').trim()]));
          const getSourceValue = (aliases: string[]) => aliases.map((alias) => normalisedRow[alias]).find((value) => value !== undefined) || '';
          const record = emptyRecord();
          columns.forEach(({ key }) => {
            const matchedHeader = headerAliases[key].find((alias) => Object.hasOwn(normalisedRow, alias));
            if (matchedHeader) record[key] = normalisedRow[matchedHeader];
          });
          record.linkFileUrl = getSourceValue(['link_url', 'link/file_url', 'linkfile_url', 'link url', 'link/file url']);
          record.fileUrl = getSourceValue(['file_url', 'file url']);
          return { id: crypto.randomUUID(), ...record };
        });
        if (importedRecords.length === 0) { setMessage('ไม่พบแถวข้อมูลสำหรับนำเข้า'); return; }
        void saveRecords([...importedRecords, ...records]);
        setIsImportModalOpen(false);
        setMessage(`นำเข้า ${importedRecords.length} รายการเรียบร้อยแล้ว`);
      },
      error: () => setMessage('อ่านไฟล์ CSV ไม่สำเร็จ'),
    });
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) importCsv(file);
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault(); setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) importCsv(file);
  };

  const clearRecords = () => {
    if (!window.confirm('ต้องการล้างข้อมูล PI Record ทั้งหมดจากเครื่องนี้ใช่ไหม?')) return;
    setRecords([]);
    try { window.localStorage.removeItem(storageKey); }
    catch (error) { console.error('Unable to clear PI records from browser:', error); }
    void supabase.from('pi_records').delete().neq('id', '00000000-0000-0000-0000-000000000000').then(({ error }) => {
      setMessage(error ? 'ล้างข้อมูลจากฐานข้อมูลไม่สำเร็จ' : 'ล้างข้อมูลทั้งหมดแล้ว');
    });
  };

  return (
    <main className="mx-auto w-full max-w-[1800px] text-slate-800">
      <div className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div><p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-blue-600">Procurement</p><h1 className="text-3xl font-black tracking-tight text-slate-900">PI Record</h1><p className="mt-1 text-sm font-medium text-slate-500">ตารางบันทึก PI Supplier และสถานะเอกสารสั่งซื้อ</p></div>
        <div className="flex flex-wrap items-center gap-3"><span className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">{records.length.toLocaleString()} รายการ</span><button type="button" onClick={() => setIsImportModalOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700"><Plus size={17} /> เพิ่มข้อมูล</button><button type="button" onClick={clearRecords} disabled={records.length === 0} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3.5 py-2.5 text-sm font-bold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 size={16} /> ล้างข้อมูล</button></div>
      </div>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600" title="ตัวกรอง"><Filter size={18} /></span>
          {columns.map(({ key, label }) => <select key={key} value={filters[key]} onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value }))} disabled={filterOptions[key].length === 0} className="h-10 max-w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 outline-none transition hover:border-blue-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"><option value="">{label}: ทั้งหมด</option>{filterOptions[key].map((option) => <option key={option} value={option}>{label}: {option}</option>)}</select>)}
          {activeFilterCount > 0 && <button type="button" onClick={() => setFilters(emptyFilters())} className="h-10 rounded-xl border border-rose-200 px-3 text-sm font-bold text-rose-600 transition hover:bg-rose-50">ล้าง {activeFilterCount}</button>}
        </div>
      </section>

      {message && <div className="mb-5 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700"><FileSpreadsheet size={18} /> {message}<button type="button" onClick={() => setMessage('')} className="ml-auto rounded-lg p-1 text-blue-400 transition hover:bg-blue-100 hover:text-blue-700" aria-label="ปิดข้อความ"><X size={17} /></button></div>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between"><h2 className="text-base font-black text-slate-800">รายการ PI</h2><label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-400 focus-within:border-blue-400 focus-within:bg-white"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาทุกรายการ" className="w-full bg-transparent text-sm text-slate-700 outline-none md:w-60" /></label></div>
        {filteredRecords.length === 0 ? <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center"><FileSpreadsheet size={42} className="mb-3 text-slate-200" /><p className="text-sm font-bold text-slate-500">ยังไม่มีข้อมูล PI Record</p><p className="mt-1 text-xs text-slate-400">อัปโหลดไฟล์ CSV เพื่อเพิ่มข้อมูลลงในตาราง</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[1700px] border-collapse text-left text-xs"><thead className="border-b border-slate-200 bg-slate-50 text-slate-600"><tr>{columns.map(({ key, label }) => <th key={key} className="whitespace-nowrap border-r border-slate-200 px-3 py-3 font-bold last:border-r-0">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filteredRecords.map((record) => <tr key={record.id} className="transition hover:bg-blue-50/40">{columns.map(({ key }) => { const link = key === 'linkFile' ? getLinkDetails(record[key], record.linkFileUrl) : key === 'file' ? getLinkDetails(record[key], record.fileUrl) : null; return <td key={key} className="max-w-64 border-r border-slate-100 px-3 py-3 align-top text-slate-600 last:border-r-0">{link ? <a href={link.href} target="_blank" rel="noopener noreferrer" className="block truncate font-semibold text-blue-600 underline decoration-blue-200 underline-offset-2 transition hover:text-blue-800 hover:decoration-blue-600" title={link.href}>{link.label}</a> : record[key] || '-'}</td>; })}</tr>)}</tbody></table></div>}
      </section>

      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="import-csv-title">
          <div className="w-full max-w-5xl rounded-3xl bg-white p-5 shadow-2xl md:p-7">
            <div className="mb-5 flex items-start justify-between gap-4"><div><h2 id="import-csv-title" className="text-xl font-black text-slate-900">เพิ่มข้อมูล PI Record</h2><p className="mt-1 text-sm text-slate-500">อัปโหลดไฟล์ CSV ที่จัดหัวคอลัมน์ตามรายการด้านล่าง</p></div><button type="button" onClick={() => setIsImportModalOpen(false)} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="ปิดโมดอล"><X size={21} /></button></div>
            <div className="grid gap-4 md:grid-cols-[1.3fr_0.9fr]">
              <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} className={`flex min-h-32 items-center gap-4 rounded-2xl border-2 border-dashed px-5 text-left transition ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50'}`}><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-100"><Upload size={22} /></span><span><span className="block text-sm font-extrabold text-slate-800">อัปโหลด CSV</span><span className="mt-1 block text-xs font-medium leading-5 text-slate-500">เลือกไฟล์ หรือลาก CSV มาวางที่นี่ หัวคอลัมน์ใช้ตามตารางในภาพได้ทันที</span></span></button>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-xs leading-5 text-slate-500"><span className="font-bold text-slate-700">หัวคอลัมน์ที่รองรับ</span><p className="mt-1">PI-Supplier, Date, Supplier, Link/File, ETD, Band, Order_NO., File, Sale_Name, Project_name, Payment_Date, Delivered_Date, Date_Order</p></div>
            </div>
            <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />
          </div>
        </div>
      )}
    </main>
  );
}

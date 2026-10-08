'use client';

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Filter,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
  Download,
  CheckCircle2,
  AlertCircle,
  Eye,
  Loader2,
  ArrowRight,
  RefreshCw,
  FileText
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

const columns = [
  { key: 'piSupplier', label: 'PI-Supplier' },
  { key: 'date', label: 'Date' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'linkFile', label: 'Link/File' },
  { key: 'etd', label: 'ETD' },
  { key: 'brand', label: 'Band' },
  { key: 'orderNo', label: 'Order_NO.' },
  { key: 'file', label: 'File' },
  { key: 'saleName', label: 'Sale_Name' },
  { key: 'projectName', label: 'Project_name' },
  { key: 'paymentDate', label: 'Payment_Date' },
  { key: 'deliveredDate', label: 'Delivered_Date' },
  { key: 'dateOrder', label: 'Date_Order / วันที่ลูกค้าชำระเงิน' },
] as const;

type ColumnKey = (typeof columns)[number]['key'];
type PiRecord = Record<ColumnKey, string> & { id: string; linkFileUrl: string; fileUrl: string };

type DatabasePiRecord = {
  id: string;
  pi_supplier: string;
  record_date: string;
  supplier: string;
  link_file: string;
  link_file_url: string;
  etd: string;
  brand: string;
  order_no: string;
  file_name: string;
  file_url: string;
  sale_name: string;
  project_name: string;
  payment_date: string;
  delivered_date: string;
  date_order: string;
};

interface PreviewData {
  fileName: string;
  fileSize: number;
  fileType: 'xlsx' | 'csv';
  records: PiRecord[];
  matchedColumnCount: number;
}

const storageKey = 'wallcraft-pi-records-v1';

const headerAliases: Record<ColumnKey, string[]> = {
  piSupplier: ['pi-supplier', 'pi supplier', 'pisupplier', 'pi_supplier', 'pi', 'pi supplier no'],
  date: ['date', 'record_date', 'record date', 'วันที่'],
  supplier: ['supplier', 'ผู้จัดจำหน่าย', 'ซัพพลายเออร์'],
  linkFile: ['link/file', 'link file', 'linkfile', 'link_file', 'link', 'ลิงก์ไฟล์', 'ลิงค์'],
  etd: ['etd', 'กำหนดส่ง', 'estimated delivery'],
  brand: ['band', 'brand', 'แบรนด์'],
  orderNo: ['order_no.', 'order_no', 'order no', 'orderno', 'order number', 'เลขออเดอร์', 'เลขที่สั่งซื้อ'],
  file: ['file', 'file_name', 'filename', 'ชื่อไฟล์', 'ไฟล์'],
  saleName: ['sale_name', 'sale name', 'salename', 'sale', 'ชื่อเซลล์', 'ผู้ขาย'],
  projectName: ['project_name', 'project name', 'projectname', 'project', 'ชื่อโครงการ', 'โครงการ'],
  paymentDate: ['payment_date', 'payment date', 'paymentdate', 'วันชำระเงิน', 'วันที่ชำระ'],
  deliveredDate: ['delivered_date', 'delivered date', 'delivereddate', 'วันส่งมอบ', 'วันที่ส่งของ'],
  dateOrder: ['date_order / วันที่ลูกค้าชำระเงิน', 'date_order', 'date order', 'dateorder', 'วันที่ลูกค้าชำระเงิน', 'order date'],
};

const sampleTemplateRows = [
  {
    'PI-Supplier': 'PI-2026-001',
    'Date': '2026-10-01',
    'Supplier': 'Siam Wood Co., Ltd.',
    'Link/File': 'https://drive.google.com/sample-file-1.pdf',
    'ETD': '2026-10-25',
    'Band': 'WallCraft Elite',
    'Order_NO.': 'ORD-9842',
    'File': 'PI_Doc_001.pdf',
    'Sale_Name': 'สมชาย ใจดี',
    'Project_name': 'Villa Phuket Residence',
    'Payment_Date': '2026-10-05',
    'Delivered_Date': '2026-10-28',
    'Date_Order / วันที่ลูกค้าชำระเงิน': '2026-10-02'
  },
  {
    'PI-Supplier': 'PI-2026-002',
    'Date': '2026-10-03',
    'Supplier': 'Timber Master Import',
    'Link/File': 'https://drive.google.com/sample-file-2.pdf',
    'ETD': '2026-11-02',
    'Band': 'Terra Teak',
    'Order_NO.': 'ORD-9843',
    'File': 'PI_Doc_002.pdf',
    'Sale_Name': 'วิภาดา รวยรื่น',
    'Project_name': 'The Riverfront Condo',
    'Payment_Date': '2026-10-08',
    'Delivered_Date': '2026-11-05',
    'Date_Order / วันที่ลูกค้าชำระเงิน': '2026-10-04'
  }
];

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
    id: record.id,
    piSupplier: record.pi_supplier,
    date: record.record_date,
    supplier: record.supplier,
    linkFile: record.link_file,
    linkFileUrl: record.link_file_url,
    etd: record.etd,
    brand: record.brand,
    orderNo: record.order_no,
    file: record.file_name,
    fileUrl: record.file_url,
    saleName: record.sale_name,
    projectName: record.project_name,
    paymentDate: record.payment_date,
    deliveredDate: record.delivered_date,
    dateOrder: record.date_order,
  };
}

function toDatabaseRecord(record: PiRecord): DatabasePiRecord {
  return {
    id: record.id,
    pi_supplier: record.piSupplier,
    record_date: record.date,
    supplier: record.supplier,
    link_file: record.linkFile,
    link_file_url: record.linkFileUrl,
    etd: record.etd,
    brand: record.brand,
    order_no: record.orderNo,
    file_name: record.file,
    file_url: record.fileUrl,
    sale_name: record.saleName,
    project_name: record.projectName,
    payment_date: record.paymentDate,
    delivered_date: record.deliveredDate,
    date_order: record.dateOrder,
  };
}

function getLinkDetails(value: string, helperUrl?: string) {
  const text = (value || '').trim();
  if (helperUrl && /^https?:\/\//i.test(helperUrl.trim())) return { href: helperUrl.trim(), label: text || 'เปิดไฟล์' };
  const formulaMatch = text.match(/^=HYPERLINK\(\s*"([^"]+)"(?:\s*,\s*"([^"]*)")?\s*\)$/i);
  if (formulaMatch) return { href: formulaMatch[1], label: formulaMatch[2] || 'เปิดไฟล์' };
  if (/^https?:\/\//i.test(text)) return { href: text, label: text };
  return null;
}

export default function PiRecordPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const isMouseDownOnBackdrop = useRef(false);

  const [records, setRecords] = useState<PiRecord[]>([]);
  const [search, setSearch] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [filters, setFilters] = useState<Record<ColumnKey, string>>(() => emptyFilters());
  const [message, setMessage] = useState('');

  // Preview & Import State
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [showAllPreview, setShowAllPreview] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isImportModalOpen) {
        setIsImportModalOpen(false);
        setPreviewData(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isImportModalOpen]);

  // Load records from Supabase / localStorage
  useEffect(() => {
    let cancelled = false;
    const loadRecords = async () => {
      let savedRecords: PiRecord[] = [];
      try {
        savedRecords = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
      } catch {
        savedRecords = [];
      }

      const { data, error } = await supabase.from('pi_records').select('*').order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        console.warn('Unable to read PI records from Supabase:', error);
        setRecords(savedRecords);
        const tableUnavailable = error.message.includes("Could not find the table 'public.pi_records' in the schema cache");
        setMessage(
          tableUnavailable
            ? 'ระบบกำลังเตรียมตาราง PI Record กรุณารีเฟรชหน้านี้อีกครั้ง'
            : 'กำลังแสดงข้อมูลเดิมจากเครื่องนี้ เนื่องจากยังเชื่อมฐานข้อมูลไม่ได้'
        );
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
    return () => {
      cancelled = true;
    };
  }, []);

  // Save records
  const saveRecords = async (nextRecords: PiRecord[]) => {
    setRecords(nextRecords);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextRecords));
    } catch (error) {
      console.error('Unable to save PI records:', error);
      setMessage('บันทึกข้อมูลในเบราว์เซอร์ไม่สำเร็จ');
    }
    const { error } = await supabase.from('pi_records').upsert(nextRecords.map(toDatabaseRecord), { onConflict: 'id' });
    if (error) {
      console.error('Unable to save PI records to Supabase:', error);
      setMessage('บันทึกลงฐานข้อมูลไม่สำเร็จ ข้อมูลถูกเก็บไว้ในเครื่องนี้ชั่วคราว');
    }
  };

  // Download Templates
  const downloadTemplateExcel = () => {
    const ws = XLSX.utils.json_to_sheet(sampleTemplateRows);
    ws['!cols'] = columns.map(() => ({ wch: 24 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PI_Record_Template');
    XLSX.writeFile(wb, 'PI_Record_Template.xlsx');
    setShowDownloadMenu(false);
  };

  const downloadTemplateCsv = () => {
    const csv = Papa.unparse(sampleTemplateRows);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'PI_Record_Template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowDownloadMenu(false);
  };

  // Parse Raw Rows into PiRecord objects
  const processRawRows = (rawRows: Record<string, any>[], fileName: string, fileSize: number, fileType: 'xlsx' | 'csv') => {
    if (!rawRows || rawRows.length === 0) {
      setMessage('ไม่พบข้อมูลในไฟล์ที่เลือก');
      setIsParsing(false);
      return;
    }

    const firstRow = rawRows[0];
    const sourceHeaders = Object.keys(firstRow).map(normaliseHeader);
    const matchedCount = columns.filter(({ key }) =>
      headerAliases[key].some((alias) => sourceHeaders.includes(alias))
    ).length;

    if (matchedCount === 0) {
      setMessage('ไม่พบหัวคอลัมน์ PI Record ในไฟล์ กรุณาตรวจสอบหรือใช้เทมเพลตมาตรฐาน');
      setIsParsing(false);
      return;
    }

    const parsedRecords: PiRecord[] = rawRows
      .filter((row) => Object.values(row).some((val) => String(val ?? '').trim() !== ''))
      .map((sourceRow) => {
        const normalisedRow = Object.fromEntries(
          Object.entries(sourceRow).map(([key, value]) => [normaliseHeader(key), String(value ?? '').trim()])
        );

        const getSourceValue = (aliases: string[]) =>
          aliases.map((alias) => normalisedRow[alias]).find((value) => value !== undefined) || '';

        const record = emptyRecord();
        columns.forEach(({ key }) => {
          const matchedHeader = headerAliases[key].find((alias) => Object.hasOwn(normalisedRow, alias));
          if (matchedHeader) {
            record[key] = normalisedRow[matchedHeader];
          }
        });

        record.linkFileUrl = getSourceValue(['link_url', 'link/file_url', 'linkfile_url', 'link url', 'link/file url']);
        record.fileUrl = getSourceValue(['file_url', 'file url']);

        return {
          id: crypto.randomUUID(),
          ...record,
        };
      });

    if (parsedRecords.length === 0) {
      setMessage('ไม่พบแถวข้อมูลสำหรับนำเข้า');
      setIsParsing(false);
      return;
    }

    setPreviewData({
      fileName,
      fileSize,
      fileType,
      records: parsedRecords,
      matchedColumnCount: matchedCount,
    });
    setIsParsing(false);
  };

  // Handle uploaded file (detect CSV vs XLSX)
  const handleUploadedFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      setMessage('กรุณาเลือกไฟล์ .csv, .xlsx หรือ .xls เท่านั้น');
      return;
    }

    setIsParsing(true);
    setMessage('');

    if (ext === 'csv') {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: 'greedy',
        complete: (result) => {
          processRawRows(result.data, file.name, file.size, 'csv');
        },
        error: (err) => {
          console.error(err);
          setMessage('อ่านไฟล์ CSV ไม่สำเร็จ');
          setIsParsing(false);
        },
      });
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '', raw: false });
          processRawRows(json, file.name, file.size, 'xlsx');
        } catch (err) {
          console.error(err);
          setMessage('อ่านไฟล์ Excel ไม่สำเร็จ');
          setIsParsing(false);
        }
      };
      reader.onerror = () => {
        setMessage('อ่านไฟล์ล้มเหลว');
        setIsParsing(false);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleUploadedFile(file);
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) handleUploadedFile(file);
  };

  // Confirm and persist import
  const handleConfirmImport = async () => {
    if (!previewData || previewData.records.length === 0) return;
    setIsSaving(true);

    try {
      if (importMode === 'replace') {
        // Clear remote
        await supabase.from('pi_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await saveRecords(previewData.records);
        setMessage(`แทนที่ข้อมูลเรียบร้อยแล้ว (${previewData.records.length} รายการ)`);
      } else {
        await saveRecords([...previewData.records, ...records]);
        setMessage(`นำเข้าข้อมูลใหม่ ${previewData.records.length} รายการเรียบร้อยแล้ว`);
      }

      setIsImportModalOpen(false);
      setPreviewData(null);
    } catch (err) {
      console.error(err);
      setMessage('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSaving(false);
    }
  };

  const clearRecords = () => {
    if (!window.confirm('ต้องการล้างข้อมูล PI Record ทั้งหมดจากระบบใช่ไหม?')) return;
    setRecords([]);
    try {
      window.localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Unable to clear PI records from browser:', error);
    }
    void supabase
      .from('pi_records')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .then(({ error }) => {
        setMessage(error ? 'ล้างข้อมูลจากฐานข้อมูลไม่สำเร็จ' : 'ล้างข้อมูลทั้งหมดแล้ว');
      });
  };

  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesSearch = !keyword || columns.some(({ key }) => record[key].toLowerCase().includes(keyword));
      const matchesFilters = columns.every(
        ({ key }) => !filters[key].trim() || record[key].toLowerCase().includes(filters[key].trim().toLowerCase())
      );
      return matchesSearch && matchesFilters;
    });
  }, [filters, records, search]);

  const activeFilterCount = columns.filter(({ key }) => filters[key].trim()).length;

  const filterOptions = useMemo(
    () =>
      Object.fromEntries(
        columns.map(({ key }) => [
          key,
          Array.from(new Set(records.map((record) => record[key].trim()).filter((value) => value && value !== '-'))).sort((a, b) =>
            a.localeCompare(b, 'th')
          ),
        ])
      ) as Record<ColumnKey, string[]>,
    [records]
  );

  return (
    <main className="mx-auto w-full max-w-[1800px] text-slate-800">
      {/* ── Page Header ── */}
      <div className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-blue-600">Procurement</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">PI Record</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">ตารางบันทึก PI Supplier และสถานะเอกสารสั่งซื้อ</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">
            {records.length.toLocaleString()} รายการ
          </span>

          {/* Template Download Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300"
            >
              <Download size={16} className="text-emerald-600" />
              ดาวน์โหลดเทมเพลต
            </button>

            {showDownloadMenu && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl z-30"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  เลือกรูปแบบไฟล์
                </div>
                <button
                  type="button"
                  onClick={downloadTemplateExcel}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition text-left"
                >
                  <FileSpreadsheet size={16} className="text-emerald-600" />
                  เทมเพลต Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={downloadTemplateCsv}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition text-left"
                >
                  <FileText size={16} className="text-blue-600" />
                  เทมเพลต CSV (.csv)
                </button>
              </div>
            )}
          </div>

          {/* Add / Import Button */}
          <button
            type="button"
            onClick={() => {
              setPreviewData(null);
              setIsImportModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700"
          >
            <Plus size={17} /> เพิ่มข้อมูล / อัปโหลด
          </button>

          {/* Clear Button */}
          <button
            type="button"
            onClick={clearRecords}
            disabled={records.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3.5 py-2.5 text-sm font-bold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={16} /> ล้างข้อมูล
          </button>
        </div>
      </div>

      {/* ── Filters Bar ── */}
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600" title="ตัวกรอง">
            <Filter size={18} />
          </span>
          {columns.map(({ key, label }) => (
            <select
              key={key}
              value={filters[key]}
              onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value }))}
              disabled={filterOptions[key].length === 0}
              className="h-10 max-w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 outline-none transition hover:border-blue-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"
            >
              <option value="">{label}: ทั้งหมด</option>
              {filterOptions[key].map((option) => (
                <option key={option} value={option}>
                  {label}: {option}
                </option>
              ))}
            </select>
          ))}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => setFilters(emptyFilters())}
              className="h-10 rounded-xl border border-rose-200 px-3 text-sm font-bold text-rose-600 transition hover:bg-rose-50"
            >
              ล้าง {activeFilterCount}
            </button>
          )}
        </div>
      </section>

      {/* ── Feedback Message ── */}
      {message && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 animate-in fade-in">
          <FileSpreadsheet size={18} /> {message}
          <button
            type="button"
            onClick={() => setMessage('')}
            className="ml-auto rounded-lg p-1 text-blue-400 transition hover:bg-blue-100 hover:text-blue-700"
            aria-label="ปิดข้อความ"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* ── Main Table ── */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-base font-black text-slate-800">รายการ PI</h2>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-400 focus-within:border-blue-400 focus-within:bg-white">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหาทุกรายการ"
              className="w-full bg-transparent text-sm text-slate-700 outline-none md:w-60"
            />
          </label>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
            <FileSpreadsheet size={42} className="mb-3 text-slate-200" />
            <p className="text-sm font-bold text-slate-500">ยังไม่มีข้อมูล PI Record</p>
            <p className="mt-1 text-xs text-slate-400">อัปโหลดไฟล์ Excel หรือ CSV เพื่อเพิ่มข้อมูลลงในตาราง</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1700px] border-collapse text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  {columns.map(({ key, label }) => (
                    <th key={key} className="whitespace-nowrap border-r border-slate-200 px-3 py-3 font-bold last:border-r-0">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="transition hover:bg-blue-50/40">
                    {columns.map(({ key }) => {
                      const link =
                        key === 'linkFile'
                          ? getLinkDetails(record[key], record.linkFileUrl)
                          : key === 'file'
                          ? getLinkDetails(record[key], record.fileUrl)
                          : null;
                      return (
                        <td key={key} className="max-w-64 border-r border-slate-100 px-3 py-3 align-top text-slate-600 last:border-r-0">
                          {link ? (
                            <a
                              href={link.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block truncate font-semibold text-blue-600 underline decoration-blue-200 underline-offset-2 transition hover:text-blue-800 hover:decoration-blue-600"
                              title={link.href}
                            >
                              {link.label}
                            </a>
                          ) : (
                            record[key] || '-'
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── UPLOAD & PREVIEW MODAL ── */}
      {isImportModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-modal-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              isMouseDownOnBackdrop.current = true;
            }
          }}
          onClick={(e) => {
            if (isMouseDownOnBackdrop.current && e.target === e.currentTarget && !isSaving) {
              setIsImportModalOpen(false);
              setPreviewData(null);
            }
            isMouseDownOnBackdrop.current = false;
          }}
        >
          <div
            className={`w-full ${previewData ? 'max-w-6xl max-h-[92vh]' : 'max-w-3xl'} bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 border border-slate-100`}
            onMouseDown={(e) => {
              isMouseDownOnBackdrop.current = false;
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold shadow-sm">
                  {previewData ? <Eye size={20} /> : <Upload size={20} />}
                </div>
                <div>
                  <h2 id="import-modal-title" className="text-lg font-black text-slate-800">
                    {previewData ? 'ตัวอย่างข้อมูลก่อนนำเข้า (Preview)' : 'นำเข้าข้อมูล PI Record'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {previewData
                      ? `ตรวจสอบความถูกต้องของข้อมูลจากไฟล์ ${previewData.fileName}`
                      : 'รองรับไฟล์ Excel (.xlsx, .xls) และ CSV (.csv)'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!isSaving) {
                    setIsImportModalOpen(false);
                    setPreviewData(null);
                  }
                }}
                disabled={isSaving}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto min-h-0 flex-1">
              {!previewData ? (
                /* ── STEP 1: UPLOAD ZONE ── */
                <div className="space-y-6">
                  {/* Template Download Prompt */}
                  <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-200">
                        <FileSpreadsheet size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">ยังไม่มีรูปแบบไฟล์ที่ถูกต้อง?</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          ดาวน์โหลดเทมเพลตมาตรฐานที่มีหัวคอลัมน์ครบ 13 รายการ พร้อมตัวอย่างการกรอกข้อมูล
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={downloadTemplateExcel}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                      >
                        <Download size={14} /> ดาวน์โหลด Excel (.xlsx)
                      </button>
                      <button
                        type="button"
                        onClick={downloadTemplateCsv}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition shadow-sm cursor-pointer"
                      >
                        <Download size={14} /> CSV (.csv)
                      </button>
                    </div>
                  </div>

                  {/* Drag & Drop Area */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                    className={`border-2 border-dashed rounded-3xl p-8 sm:p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
                      isDragging
                        ? 'border-blue-500 bg-blue-50/70 scale-[0.99]'
                        : 'border-slate-300 bg-slate-50/60 hover:border-blue-400 hover:bg-blue-50/30'
                    }`}
                  >
                    {isParsing ? (
                      <div className="flex flex-col items-center py-4">
                        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-3" />
                        <p className="text-sm font-bold text-slate-700">กำลังประมวลผลและอ่านข้อมูลในไฟล์...</p>
                        <p className="text-xs text-slate-400 mt-1">กรุณารอสักครู่</p>
                      </div>
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-200 mb-4 transition-transform group-hover:scale-105">
                          <Upload size={28} />
                        </div>
                        <h4 className="text-base font-bold text-slate-800">
                          คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
                        </h4>
                        <p className="text-xs text-slate-500 mt-1 max-w-md">
                          รองรับไฟล์ <strong>Excel (.xlsx, .xls)</strong> และ <strong>CSV (.csv)</strong> ระบบจะทำการตรวจสอบหัวคอลัมน์และแสดงตัวอย่างก่อนบันทึก
                        </p>
                        <span className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-200/80 text-slate-700 text-[11px] font-bold">
                          เบราว์เซอร์จะเปิดหน้าพรีวิวก่อนนำเข้า
                        </span>
                      </>
                    )}
                  </div>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {/* Columns Reference */}
                  <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/80">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      <span className="text-xs font-bold text-slate-700">13 หัวคอลัมน์ที่ระบบรองรับอัตโนมัติ:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {columns.map(({ label }) => (
                        <span
                          key={label}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-600 shadow-2xs"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* ── STEP 2: PREVIEW MODE ── */
                <div className="space-y-5">
                  {/* Summary Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                        {previewData.fileType === 'xlsx' ? <FileSpreadsheet size={20} /> : <FileText size={20} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">ไฟล์ที่เลือก</p>
                        <p className="text-xs font-bold text-slate-800 truncate" title={previewData.fileName}>
                          {previewData.fileName}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {(previewData.fileSize / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
                        {previewData.records.length}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-blue-600 tracking-wider">จำนวนแถวข้อมูล</p>
                        <p className="text-xs font-bold text-slate-800">
                          พบทั้งหมด {previewData.records.length.toLocaleString()} รายการ
                        </p>
                        <p className="text-[10px] text-blue-600/80">พร้อมนำเข้าสู่ระบบ</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-emerald-600 tracking-wider">การจับคู่คอลัมน์</p>
                        <p className="text-xs font-bold text-slate-800">
                          ตรงกับระบบ {previewData.matchedColumnCount} / {columns.length} คอลัมน์
                        </p>
                        <p className="text-[10px] text-emerald-600/80">
                          {previewData.matchedColumnCount === columns.length ? 'สมบูรณ์ครบถ้วน' : 'ข้อมูลบางส่วนอาจเป็นค่าว่าง'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Mode Option */}
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-800">รูปแบบการบันทึก:</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        เลือกได้ว่าจะเพิ่มต่อท้ายข้อมูลเดิม หรือล้างข้อมูลเก่าแล้วแทนที่
                      </p>
                    </div>
                    <div className="flex items-center gap-3 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setImportMode('append')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          importMode === 'append'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        เพิ่มต่อท้าย (Append)
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportMode('replace')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          importMode === 'replace'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-rose-600'
                        }`}
                      >
                        แทนที่ทั้งหมด (Replace)
                      </button>
                    </div>
                  </div>

                  {/* Preview Table Header & Controls */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Eye size={15} className="text-blue-600" />
                      ตัวอย่างข้อมูล (แสดง {showAllPreview ? previewData.records.length : Math.min(10, previewData.records.length)} จาก {previewData.records.length} แถว):
                    </span>

                    {previewData.records.length > 10 && (
                      <button
                        type="button"
                        onClick={() => setShowAllPreview(!showAllPreview)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                      >
                        {showAllPreview ? 'ย่อเหลือ 10 แถว' : `ดูทั้งหมด (${previewData.records.length} แถว)`}
                      </button>
                    )}
                  </div>

                  {/* Preview Table */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs max-h-72 overflow-x-auto overflow-y-auto">
                    <table className="w-full min-w-[1500px] border-collapse text-left text-xs bg-white">
                      <thead className="bg-slate-100/90 text-slate-700 sticky top-0 z-10 border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2.5 font-bold border-r border-slate-200 w-12 text-center text-slate-400">#</th>
                          {columns.map(({ key, label }) => (
                            <th key={key} className="whitespace-nowrap border-r border-slate-200 px-3 py-2.5 font-bold last:border-r-0">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(showAllPreview ? previewData.records : previewData.records.slice(0, 10)).map((record, index) => (
                          <tr key={record.id} className="hover:bg-blue-50/30">
                            <td className="px-3 py-2 border-r border-slate-100 text-center font-bold text-slate-400">
                              {index + 1}
                            </td>
                            {columns.map(({ key }) => {
                              const val = record[key];
                              return (
                                <td key={key} className="max-w-60 truncate border-r border-slate-100 px-3 py-2 text-slate-600 last:border-r-0">
                                  {val || <span className="text-slate-300 italic">-</span>}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              {previewData ? (
                <>
                  <button
                    type="button"
                    onClick={() => setPreviewData(null)}
                    disabled={isSaving}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw size={14} /> เลือกไฟล์ใหม่
                  </button>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsImportModalOpen(false);
                        setPreviewData(null);
                      }}
                      disabled={isSaving}
                      className="px-4 py-2.5 rounded-xl text-slate-500 hover:text-slate-800 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmImport}
                      disabled={isSaving}
                      className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md shadow-blue-200 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          <span>กำลังบันทึกข้อมูล...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={16} />
                          <span>ยืนยันนำเข้าข้อมูล ({previewData.records.length} รายการ)</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-white text-xs font-bold transition cursor-pointer"
                  >
                    ปิด
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

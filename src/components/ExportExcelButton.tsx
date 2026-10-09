// src/components/ExportExcelButton.tsx
'use client';

import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { 
  FileDown, X, Download, Database, Filter, 
  FileSpreadsheet, FileText, CheckCircle2, 
  AlertCircle, Loader2, ShieldCheck, Layers, Sparkles
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ExportButtonProps {
  currentUserRole?: string;
  currentFilteredProjects?: any[];
  profiles?: any[];
  teams?: any[];
  projectTypes?: any[];
  productCategories?: any[];
  customerTypes?: any[];
  dateRangeStr?: string;
  ordersData?: any[]; // สำหรับ backwards compatibility
}

export default function ExportExcelButton({
  currentUserRole = 'admin',
  currentFilteredProjects = [],
  profiles = [],
  teams = [],
  projectTypes = [],
  productCategories = [],
  customerTypes = [],
  dateRangeStr = '',
  ordersData
}: ExportButtonProps) {
  // 🔒 ความปลอดภัยสูงสุด: อนุญาตเฉพาะ Admin เท่านั้น
  if (currentUserRole !== 'admin') {
    return null;
  }

  const [isOpen, setIsOpen] = useState(false);
  const [scope, setScope] = useState<'ALL' | 'FILTERED'>('ALL');
  const [format, setFormat] = useState<'FULL_EXCEL' | 'ODOO_EXCEL' | 'CSV'>('FULL_EXCEL');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // เตรียม Maps สำหรับจับคู่ ID กับชื่อ
  const profileMap = useMemo(() => {
    const map: Record<string, string> = {};
    profiles.forEach((p: any) => { if (p?.id) map[p.id] = p.full_name; });
    return map;
  }, [profiles]);

  const teamMap = useMemo(() => {
    const map: Record<string, string> = {};
    teams.forEach((t: any) => { if (t?.id) map[t.id] = t.team_name; });
    return map;
  }, [teams]);

  const projectTypeMap = useMemo(() => {
    const map: Record<string, string> = {};
    projectTypes.forEach((pt: any) => { if (pt?.id) map[pt.id] = pt.name; });
    return map;
  }, [projectTypes]);

  const productCategoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    productCategories.forEach((pc: any) => { if (pc?.id) map[pc.id] = pc.name; });
    return map;
  }, [productCategories]);

  const customerTypeMap = useMemo(() => {
    const map: Record<string, string> = {};
    customerTypes.forEach((ct: any) => { if (ct?.id) map[ct.id] = ct.name; });
    return map;
  }, [customerTypes]);

  // ฟังก์ชันจัดฟอร์แมตวันและเวลาไทย (UTC+7)
  const formatDateTime = (isoDate: string | null | undefined) => {
    if (!isoDate) return { date: '-', time: '-' };
    try {
      const d = new Date(isoDate);
      if (isNaN(d.getTime())) return { date: isoDate, time: '-' };
      const thaiD = new Date(d.getTime() + (7 * 60 * 60 * 1000));
      const y = thaiD.getUTCFullYear();
      const m = String(thaiD.getUTCMonth() + 1).padStart(2, '0');
      const day = String(thaiD.getUTCDate()).padStart(2, '0');
      const h = String(thaiD.getUTCHours()).padStart(2, '0');
      const min = String(thaiD.getUTCMinutes()).padStart(2, '0');
      const sec = String(thaiD.getUTCSeconds()).padStart(2, '0');
      return {
        date: `${y}-${m}-${day}`,
        time: `${h}:${min}:${sec}`
      };
    } catch {
      return { date: isoDate, time: '-' };
    }
  };

  // หมวดหมู่ไซส์พื้นที่ ตร.ม.
  const getAreaSizeCategory = (sqm: number) => {
    if (sqm === 0) return '0 sqm. (ไม่มีพื้นที่)';
    if (sqm <= 30) return 'XS (ต่ำกว่า 30 ตร.ม.)';
    if (sqm <= 100) return 'S (31 - 100 ตร.ม.)';
    if (sqm <= 300) return 'M (101 - 300 ตร.ม.)';
    if (sqm <= 500) return 'L (301 - 500 ตร.ม.)';
    if (sqm <= 1000) return 'XL (501 - 1,000 ตร.ม.)';
    return 'XXL (มากกว่า 1,000 ตร.ม.)';
  };

  // รวมชื่อและเบอร์ติดต่อ Stakeholder
  const formatStakeholder = (account: string | null | undefined, contact: string | null | undefined) => {
    const acc = (account || '').trim();
    const con = (contact || '').trim();
    if (acc && con) return `${acc} (${con})`;
    return acc || con || '-';
  };

  // ฟังก์ชันแปลงข้อมูลโครงการให้อยู่ในรูปแบบมาตรฐาน (Normalized)
  const normalizeProject = (item: any, contactMap: Record<string, any>) => {
    const isNested = !!item.order_items;
    const orderItem = isNested
      ? (Array.isArray(item.order_items) ? item.order_items[0] : item.order_items)
      : null;
    const order = orderItem?.orders;

    const id = item.id || '';
    const projectName = item.project_name || 'ไม่มีการระบุโครงการ';
    const areaSqm = Number(item.area_sqm) || 0;
    const createdAt = item.created_at;
    const isVip = Boolean(item.is_important);
    const queueLevel = item.queue_level;
    const projectYear = item.project_year;
    const projectNote = item.project_note || '';

    const projectTypeId = item.project_type_id;
    const projectTypeName = isNested
      ? (item.project_types?.name || projectTypeMap[projectTypeId] || '-')
      : (item.project_type_name || projectTypeMap[projectTypeId] || '-');

    const productCategoryId = isNested ? orderItem?.product_category_id : item.product_category_id;
    const productCategoryName = isNested
      ? (orderItem?.product_categories?.name || productCategoryMap[productCategoryId] || '-')
      : (item.product_category_name || productCategoryMap[productCategoryId] || '-');

    const salesNote = (isNested ? orderItem?.note : item.sales_note) || '';
    const interestLevel = (isNested ? orderItem?.interest_level : item.interest_level) || '-';

    const orderId = isNested ? order?.id : item.order_id;
    const orderItemId = isNested ? orderItem?.id : item.order_item_id;
    const customerName = (isNested ? order?.customer_name : item.customer_name) || '-';
    const phone = (isNested ? order?.phone : item.phone) || '-';
    const userId = isNested ? order?.user_id : item.user_id;
    const teamId = isNested ? order?.team_id : item.team_id;
    const isSynced = (isNested ? order?.is_synced : item.is_synced) ?? true;
    const auditLog = isNested ? order?.audit_log : item.audit_log;
    const source = isNested ? order?.source : item.source;
    const customerTypeId = isNested ? order?.customer_type_id : item.customer_type_id;
    const companyName = (isNested ? (order?.companies?.name || '') : (item.company_name || '')) || '-';

    // ดึงเบอร์ติดต่อ Stakeholder จาก contactMap ถ้ามี
    const contacts = contactMap[id] || {};
    const accDev = item.account_developer || '';
    const conDev = contacts.contact_developer || '';
    const accArch = item.account_architecture || '';
    const conArch = contacts.contact_architecture || '';
    const accInt = item.account_interior || '';
    const conInt = contacts.contact_interior || '';
    const accCont = item.account_contractor || '';
    const conCont = contacts.contact_contractor || '';

    const salesName = profileMap[userId] || (userId ? 'พนักงานที่ถูกลบ' : 'ไม่ระบุ');
    const teamName = teamMap[teamId] || (teamId ? 'ทีมไม่ระบุ' : '-');
    const customerTypeName = customerTypeMap[customerTypeId] || '-';

    // วิเคราะห์ Audit Log (GPS, อุปกรณ์, เครือข่าย)
    const location = auditLog?.location;
    const lat = location?.lat ?? location?.latitude;
    const lng = location?.lng ?? location?.longitude;
    const accuracy = location?.accuracy;
    const mapsUrl = (lat && lng) ? `https://www.google.com/maps?q=${lat},${lng}` : '';

    const device = auditLog?.device;
    const deviceStr = device 
      ? `${device.brand || ''} ${device.model || ''} (${device.os || ''} ${device.version || ''})`.trim() 
      : '-';
    const networkIp = auditLog?.network?.ip || '-';
    const sourceName = auditLog ? 'Mobile App (ลงพื้นที่)' : (source || 'File Import');

    const dt = formatDateTime(createdAt);

    return {
      id,
      projectName,
      areaSqm,
      areaCategory: getAreaSizeCategory(areaSqm),
      createdDate: dt.date,
      createdTime: dt.time,
      isVip,
      queueLevel,
      projectYear,
      projectNote,
      projectTypeName,
      productCategoryName,
      salesNote,
      interestLevel,
      customerName,
      phone,
      salesName,
      teamName,
      companyName,
      customerTypeName,
      accDev, conDev,
      accArch, conArch,
      accInt, conInt,
      accCont, conCont,
      developerFormatted: formatStakeholder(accDev, conDev),
      architectFormatted: formatStakeholder(accArch, conArch),
      interiorFormatted: formatStakeholder(accInt, conInt),
      contractorFormatted: formatStakeholder(accCont, conCont),
      isSynced,
      hasAuditLog: !!auditLog,
      sourceName,
      lat,
      lng,
      accuracy,
      mapsUrl,
      deviceStr,
      networkIp,
      orderId,
      orderItemId
    };
  };

  // ดึงข้อมูลทั้งหมดในฐานข้อมูล (All Data - ไม่จำกัดวันที่)
  const fetchAllDataFromDatabase = async () => {
    setExportProgress('กำลังเชื่อมต่อฐานข้อมูล Supabase...');
    const PAGE_SIZE = 1000;

    // 1. ดึง contactMap จาก order_item_projects (ถ้ามี)
    let contactMap: Record<string, any> = {};
    try {
      const { data: contacts } = await supabase
        .from('order_item_projects')
        .select('id, contact_developer, contact_architecture, contact_interior, contact_contractor')
        .or('contact_developer.not.is.null,contact_architecture.not.is.null,contact_interior.not.is.null,contact_contractor.not.is.null');
      if (contacts) {
        contacts.forEach((c: any) => {
          contactMap[c.id] = c;
        });
      }
    } catch (err) {
      console.warn('Could not fetch contacts:', err);
    }

    // 2. ดึงข้อมูลจาก v_dashboard_projects ทั้งหมด
    setExportProgress('กำลังดึงข้อมูลโครงการทั้งหมด...');
    const { data: firstBatch, count: totalCount, error: firstError } = await supabase
      .from('v_dashboard_projects')
      .select('*', { count: 'exact' })
      .or('is_deleted.eq.false,is_deleted.is.null')
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1);

    if (firstError) throw firstError;

    let allRows = [...(firstBatch || [])];
    const total = totalCount || allRows.length;

    if (total > PAGE_SIZE) {
      const promises = [];
      for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
        promises.push(
          supabase
            .from('v_dashboard_projects')
            .select('*')
            .or('is_deleted.eq.false,is_deleted.is.null')
            .order('created_at', { ascending: false })
            .range(offset, offset + PAGE_SIZE - 1)
        );
      }
      const results = await Promise.all(promises);
      results.forEach(({ data, error }) => {
        if (error) throw error;
        if (data) allRows = allRows.concat(data);
      });
    }

    return { rawRows: allRows, contactMap };
  };

  // ดึง contactMap สำหรับข้อมูลที่กรองอยู่ปัจจุบัน
  const fetchContactsForCurrentProjects = async () => {
    let contactMap: Record<string, any> = {};
    try {
      const { data: contacts } = await supabase
        .from('order_item_projects')
        .select('id, contact_developer, contact_architecture, contact_interior, contact_contractor')
        .or('contact_developer.not.is.null,contact_architecture.not.is.null,contact_interior.not.is.null,contact_contractor.not.is.null');
      if (contacts) {
        contacts.forEach((c: any) => {
          contactMap[c.id] = c;
        });
      }
    } catch (err) {
      console.warn('Could not fetch contacts:', err);
    }
    return contactMap;
  };

  // แมป Odoo Project Type
  const mapOdooProjectType = (type: string, area: number) => {
    if (!type || type === '-') return '';
    const t = type.trim();
    if (t.includes('Private Residence') || t.includes('Private Resident')) return 'Private Residence';
    if (t.includes('Hotel')) return 'Hotel';
    if (t.includes('Shopping Mall')) return 'Community Mall';
    if (t.includes('Office Building')) return 'Office';
    if (t.includes('Hospital')) return 'Hospital';
    if (t.includes('อื่นๆ') || t.includes('Other')) return 'Other';
    if (t.includes('Shop&Restaurant') || t.includes('Shop & Restaurant')) return 'Commercial';
    if (t.includes('Resort/Villa') || t.includes('Resort / Villa')) return 'Resort/Villa';
    if (t.includes('Housing Estate')) return 'Housing Estate';
    if (t.includes('Condominium')) {
      return area >= 500 ? 'High Rise' : 'Low Rise';
    }
    const cleaned = t.replace(/\s*\(.*?\)/g, '');
    return cleaned === '-' ? '' : cleaned;
  };

  // แมป Odoo Pipeline
  const mapOdooPipeline = (teamName: string, productCategoryName: string) => {
    let pipeline = teamName || '';
    if (pipeline.includes('Team-Project')) {
      const pg = (productCategoryName || '').toLowerCase();
      if (pg.includes('flooring') || pg.includes('door') || pg.includes('decting') || pg.includes('decking')) {
        pipeline = 'W-Project';
      } else if (pg.includes('wallcraft')) {
        pipeline = 'Wall-Project';
      } else if (pg.includes('furniture')) {
        pipeline = 'Fur-Project';
      }
    }
    return pipeline;
  };

  // สร้างไฟล์และดาวน์โหลด
  const handleExport = async () => {
    setIsExporting(true);
    setErrorMsg(null);

    try {
      let rawProjects: any[] = [];
      let contactMap: Record<string, any> = {};

      if (scope === 'ALL') {
        const result = await fetchAllDataFromDatabase();
        rawProjects = result.rawRows;
        contactMap = result.contactMap;
      } else {
        setExportProgress('กำลังเตรียมข้อมูลตามตัวกรอง...');
        rawProjects = currentFilteredProjects.length > 0 ? currentFilteredProjects : (ordersData || []);
        contactMap = await fetchContactsForCurrentProjects();
      }

      if (!rawProjects || rawProjects.length === 0) {
        throw new Error('ไม่พบข้อมูลโครงการสำหรับดาวน์โหลด');
      }

      setExportProgress(`กำลังประมวลผลข้อมูล ${rawProjects.length.toLocaleString()} รายการ...`);

      // แปลงข้อมูลให้อยู่ในรูปแบบ Normalized
      const normalizedList = rawProjects.map((p) => normalizeProject(p, contactMap));
      const todayDate = new Date().toISOString().slice(0, 10);
      const scopeSuffix = scope === 'ALL' ? 'AllProjects' : 'Filtered';

      if (format === 'FULL_EXCEL') {
        setExportProgress('กำลังสร้างรายงาน Excel แบบละเอียด...');
        const detailedRows = normalizedList.map((p, idx) => ({
          'ลำดับ': idx + 1,
          'รหัสโครงการ (Project ID)': p.id,
          'วันที่บันทึก': p.createdDate,
          'เวลาบันทึก': p.createdTime,
          'ชื่อโครงการ': p.projectName,
          'สถานะ VIP': p.isVip ? 'VIP (ติดดาว)' : 'ทั่วไป',
          'พื้นที่ (ตร.ม.)': p.areaSqm,
          'ขนาดพื้นที่': p.areaCategory,
          'ประเภทโครงการ': p.projectTypeName,
          'ประเภทสินค้า': p.productCategoryName,
          'ระดับความสนใจ': p.interestLevel,
          'ไตรมาส (Estimate)': p.queueLevel ? `Q${p.queueLevel}` : '-',
          'ปีโครงการ': p.projectYear || '-',
          'พนักงานขาย': p.salesName,
          'ทีมขาย': p.teamName,
          'ชื่อลูกค้า / ผู้ติดต่อ': p.customerName,
          'เบอร์โทรศัพท์': p.phone,
          'ประเภทลูกค้า': p.customerTypeName,
          'ชื่อบริษัท / คู่ค้า': p.companyName,
          'Developer (ผู้พัฒนา)': p.developerFormatted,
          'Architect (สถาปนิก)': p.architectFormatted,
          'Interior (มัณฑนากร)': p.interiorFormatted,
          'Contractor (ผู้รับเหมา)': p.contractorFormatted,
          'โน้ตจากเซลส์': p.salesNote || '-',
          'คอมเมนต์แอดมิน': p.projectNote || '-',
          'ช่องทางการบันทึก': p.sourceName,
          'สถานะการซิงค์': p.isSynced ? 'ซิงค์แล้ว' : 'รอการเชื่อมต่อ',
          'พิกัดละติจูด (Lat)': p.lat ?? '',
          'พิกัดลองจิจูด (Lng)': p.lng ?? '',
          'ความแม่นยำ GPS (ม.)': p.accuracy ? `${Math.round(p.accuracy)} ม.` : '',
          'ลิงก์ Google Maps': p.mapsUrl,
          'อุปกรณ์ที่ใช้บันทึก': p.deviceStr,
          'IP Address': p.networkIp,
          'Order ID': p.orderId || '',
          'Order Item ID': p.orderItemId || ''
        }));

        const worksheet = XLSX.utils.json_to_sheet(detailedRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects Detailed');

        // คำนวณความกว้างคอลัมน์อัตโนมัติให้สวยงาม
        const colWidths = Object.keys(detailedRows[0] || {}).map((key) => {
          let maxLen = key.length;
          detailedRows.slice(0, 150).forEach((r: any) => {
            const val = r[key] != null ? String(r[key]) : '';
            if (val.length > maxLen) maxLen = val.length;
          });
          return { wch: Math.min(Math.max(maxLen + 4, 12), 45) };
        });
        worksheet['!cols'] = colWidths;

        const fileName = `Wallcraft_Project_Report_${scopeSuffix}_${todayDate}.xlsx`;
        XLSX.writeFile(workbook, fileName);

      } else if (format === 'ODOO_EXCEL') {
        setExportProgress('กำลังสร้างไฟล์ Excel รูปแบบ Odoo...');
        const odooRows = normalizedList.map((p) => ({
          'Project name': p.projectName,
          'Contact': p.customerName === '-' ? '' : p.customerName,
          'Phone': p.phone === '-' ? '' : p.phone,
          'Pipeline': mapOdooPipeline(p.teamName, p.productCategoryName),
          'Project Type': mapOdooProjectType(p.projectTypeName, p.areaSqm),
          'Closing Potential': p.interestLevel === '-' ? '' : p.interestLevel,
          'Salesperson': p.salesName === 'ไม่ระบุ' ? '' : p.salesName,
          'Product Group': p.productCategoryName === '-' ? '' : p.productCategoryName,
          'Source': p.sourceName,
          'Architecture': p.architectFormatted === '-' ? '' : p.architectFormatted,
          'Contractor': p.contractorFormatted === '-' ? '' : p.contractorFormatted,
          'Landscape': '',
          'Interior': p.interiorFormatted === '-' ? '' : p.interiorFormatted,
          'Developer': p.developerFormatted === '-' ? '' : p.developerFormatted,
          'Unit / Project': p.areaSqm,
          'Note :': p.salesNote || '',
          'Admin Note': p.projectNote || ''
        }));

        const worksheet = XLSX.utils.json_to_sheet(odooRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Project History Odoo');

        worksheet['!cols'] = [
          { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
          { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
          { wch: 20 }, { wch: 30 }, { wch: 30 }, { wch: 20 },
          { wch: 30 }, { wch: 30 }, { wch: 15 }, { wch: 30 }, { wch: 30 }
        ];

        const fileName = `Wallcraft_Odoo_Export_${scopeSuffix}_${todayDate}.xlsx`;
        XLSX.writeFile(workbook, fileName);

      } else if (format === 'CSV') {
        setExportProgress('กำลังสร้างไฟล์ CSV (UTF-8 BOM)...');
        const csvRows = normalizedList.map((p, idx) => ({
          'ลำดับ': idx + 1,
          'รหัสโครงการ': p.id,
          'วันที่บันทึก': p.createdDate,
          'เวลาบันทึก': p.createdTime,
          'ชื่อโครงการ': p.projectName,
          'สถานะ VIP': p.isVip ? 'VIP (ติดดาว)' : 'ทั่วไป',
          'พื้นที่ (ตร.ม.)': p.areaSqm,
          'ขนาดพื้นที่': p.areaCategory,
          'ประเภทโครงการ': p.projectTypeName,
          'ประเภทสินค้า': p.productCategoryName,
          'ระดับความสนใจ': p.interestLevel,
          'ไตรมาส': p.queueLevel ? `Q${p.queueLevel}` : '-',
          'ปีโครงการ': p.projectYear || '-',
          'พนักงานขาย': p.salesName,
          'ทีมขาย': p.teamName,
          'ชื่อลูกค้า / ผู้ติดต่อ': p.customerName,
          'เบอร์โทรศัพท์': p.phone,
          'ประเภทลูกค้า': p.customerTypeName,
          'ชื่อบริษัท / คู่ค้า': p.companyName,
          'Developer': p.developerFormatted,
          'Architect': p.architectFormatted,
          'Interior': p.interiorFormatted,
          'Contractor': p.contractorFormatted,
          'โน้ตจากเซลส์': p.salesNote || '-',
          'คอมเมนต์แอดมิน': p.projectNote || '-',
          'ช่องทางการบันทึก': p.sourceName,
          'สถานะซิงค์': p.isSynced ? 'ซิงค์แล้ว' : 'รอการเชื่อมต่อ',
          'พิกัด Lat': p.lat ?? '',
          'พิกัด Lng': p.lng ?? '',
          'ลิงก์ Google Maps': p.mapsUrl,
          'อุปกรณ์': p.deviceStr
        }));

        const csvString = Papa.unparse(csvRows);
        // เติม UTF-8 BOM (\uFEFF) เพื่อให้ Excel ภาษาไทยไม่แสดงเครื่องหมายคำถามหรือเพี้ยน
        const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Wallcraft_Projects_Export_${scopeSuffix}_${todayDate}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      setExportProgress('ดาวน์โหลดสำเร็จเรียบร้อย!');
      setTimeout(() => {
        setIsExporting(false);
        setIsOpen(false);
      }, 1000);

    } catch (err: any) {
      console.error('Export Error:', err);
      setErrorMsg(err?.message || 'เกิดข้อผิดพลาดในการส่งออกข้อมูล');
      setIsExporting(false);
    }
  };

  return (
    <>
      {/* 🚀 ปุ่มโหลดข้อมูลหลักบน Dashboard (เฉพาะ Admin) */}
      <button
        onClick={() => {
          setIsOpen(true);
          setErrorMsg(null);
          setExportProgress('');
        }}
        title="ดาวน์โหลดข้อมูลโครงการ (เฉพาะแอดมิน)"
        className="inline-flex items-center gap-2 text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-3.5 py-1.5 rounded-lg transition-all shadow-sm hover:shadow border border-emerald-500 hover:scale-[1.02] active:scale-95 cursor-pointer shrink-0"
      >
        <FileDown size={14} className="stroke-[2.5]" />
        <span>โหลดข้อมูล</span>
        <span className="bg-emerald-950/40 text-[9px] px-1.5 py-0.5 rounded font-black tracking-wide uppercase border border-emerald-400/30">
          Admin
        </span>
      </button>

      {/* 🪟 หน้าต่าง Modal ศูนย์ดาวน์โหลดข้อมูล */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            {/* ส่วนหัว Modal */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-emerald-50/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-200">
                  <FileDown size={20} className="stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-slate-800 text-base">
                      ศูนย์ดาวน์โหลดข้อมูลโครงการ (Export Center)
                    </h3>
                    <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                      <ShieldCheck size={11} /> Admin Only
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ส่งออกข้อมูลโปรเจกต์ทั้งหมดอย่างละเอียด ครบทุกคอลัมน์
                  </p>
                </div>
              </div>
              <button 
                onClick={() => !isExporting && setIsOpen(false)}
                disabled={isExporting}
                className="text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 p-1.5 rounded-lg transition-colors border border-slate-200 shadow-sm disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            {/* ส่วนเนื้อหาตัวเลือก */}
            <div className="p-6 space-y-6 overflow-y-auto">

              {/* ข้อความแจ้งเตือน Error (ถ้ามี) */}
              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-700 text-xs">
                  <AlertCircle size={18} className="shrink-0 text-rose-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* ส่วนที่ 1: เลือกขอบเขตข้อมูล (Scope) */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2.5">
                  1. เลือกขอบเขตข้อมูลที่ต้องการดาวน์โหลด
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  
                  {/* ตัวเลือก: ทั้งหมดทั้งระบบ */}
                  <div
                    onClick={() => !isExporting && setScope('ALL')}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                      scope === 'ALL'
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-sm ring-1 ring-emerald-600'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Database size={16} className={scope === 'ALL' ? 'text-emerald-600' : 'text-slate-400'} />
                        <span className="font-black text-xs text-slate-800">
                          ข้อมูลทั้งหมดในระบบ
                        </span>
                      </div>
                      <span className="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full shadow-sm">
                        แนะนำ
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      ดึงข้อมูลโครงการสดทั้งหมดในฐานข้อมูล (2,400+ รายการ) ไม่จำกัดช่วงเวลา
                    </p>
                  </div>

                  {/* ตัวเลือก: ตามตัวกรองปัจจุบัน */}
                  <div
                    onClick={() => !isExporting && setScope('FILTERED')}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                      scope === 'FILTERED'
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-600'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Filter size={16} className={scope === 'FILTERED' ? 'text-indigo-600' : 'text-slate-400'} />
                        <span className="font-black text-xs text-slate-800">
                          ตามตัวกรองปัจจุบัน
                        </span>
                      </div>
                      <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                        {currentFilteredProjects.length} รายการ
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      ดึงเฉพาะรายการที่กำลังแสดงบนหน้าจอ (ตามวันที่, เซลล์, ทีม, ไซส์)
                    </p>
                  </div>

                </div>
              </div>

              {/* ส่วนที่ 2: เลือกรูปแบบไฟล์และโครงสร้างคอลัมน์ (Format) */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2.5">
                  2. เลือกรูปแบบไฟล์และโครงสร้างคอลัมน์
                </label>
                <div className="space-y-2.5">
                  
                  {/* รูปแบบที่ 1: รายงานแบบละเอียดครบถ้วน (Full Detailed Excel) */}
                  <div
                    onClick={() => !isExporting && setFormat('FULL_EXCEL')}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                      format === 'FULL_EXCEL'
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-sm ring-1 ring-emerald-600'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-2.5 rounded-lg shrink-0 mt-0.5 ${
                      format === 'FULL_EXCEL' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <FileSpreadsheet size={18} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                          รายงานแบบละเอียดครบถ้วน (Full Detailed .xlsx)
                          <Sparkles size={12} className="text-amber-500" />
                        </h4>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                          35 คอลัมน์ครบทุกมิติ
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                        รวมทุกฟิลด์: วันที่, โปรเจกต์, VIP, ตร.ม., ประเภท, สินค้า, Q/ปี, เซลล์, ทีม, ลูกค้า, คู่ค้า, Stakeholders ทุกฝ่าย (พร้อมเบอร์), โน้ตเซลส์, คอมเมนต์แอดมิน, พิกัด GPS & ลิงก์ Maps
                      </p>
                    </div>
                  </div>

                  {/* รูปแบบที่ 2: Odoo CRM Format */}
                  <div
                    onClick={() => !isExporting && setFormat('ODOO_EXCEL')}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                      format === 'ODOO_EXCEL'
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-600'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-2.5 rounded-lg shrink-0 mt-0.5 ${
                      format === 'ODOO_EXCEL' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <Layers size={18} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-black text-xs text-slate-800">
                          รูปแบบ Odoo CRM Import (.xlsx)
                        </h4>
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                          เข้ากันได้กับ Odoo
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                        จัดคอลัมน์และ Pipeline (W-Project, Wall-Project, Fur-Project) ตามโครงสร้างระบบ Odoo
                      </p>
                    </div>
                  </div>

                  {/* รูปแบบที่ 3: CSV Format */}
                  <div
                    onClick={() => !isExporting && setFormat('CSV')}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                      format === 'CSV'
                        ? 'border-amber-600 bg-amber-50/50 shadow-sm ring-1 ring-amber-600'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-2.5 rounded-lg shrink-0 mt-0.5 ${
                      format === 'CSV' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <FileText size={18} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-black text-xs text-slate-800">
                          ไฟล์ CSV ภาษาไทยสมบูรณ์ (UTF-8 BOM .csv)
                        </h4>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                          เปิดใน Excel ภาษาไทยไม่เพี้ยน
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                        เข้ารหัส UTF-8 พร้อม BOM เปิดใน Excel, Numbers หรือโปรแกรม Database ได้ทันที
                      </p>
                    </div>
                  </div>

                </div>
              </div>

              {/* ข้อความบอกสถานะความคืบหน้า */}
              {isExporting && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                  <Loader2 size={18} className="animate-spin text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-700">
                    {exportProgress || 'กำลังเตรียมการดาวน์โหลด...'}
                  </span>
                </div>
              )}

            </div>

            {/* ส่วนท้ายปุ่มกดดาวน์โหลด */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsOpen(false)}
                disabled={isExporting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl transition shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {isExporting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    กำลังประมวลผล...
                  </>
                ) : (
                  <>
                    <Download size={14} className="stroke-[2.5]" />
                    ดาวน์โหลดข้อมูลทันที
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
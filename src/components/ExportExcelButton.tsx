// src/components/ExportExcelButton.tsx
'use client';

import React from 'react';
import * as XLSX from 'xlsx';
import { FileDown } from 'lucide-react';

interface ExportButtonProps {
  ordersData: any[];
}

export default function ExportExcelButton({ ordersData }: ExportButtonProps) {
  
  const handleExport = () => {
    // 🌟 1. แมปข้อมูลใหม่ จัดเรียงคอลัมน์ตามรูป image_3d521d.png เป๊ะๆ
    const rows = ordersData.flatMap((order) => {
      return order.projects.map((proj: any) => {
        const fmtStakeholder = (company: string, contact: string) => {
          if (company && contact) return `${company} (${contact})`;
          return company || contact || '';
        };

        // สุ่มหยิบเบอร์/ชื่อผู้ติดต่อมา 1 อัน
        const availableContacts = [
          proj.stakeholders.devCont,
          proj.stakeholders.archCont,
          proj.stakeholders.intCont,
          proj.stakeholders.contCont
        ].filter(Boolean);

        const randomPhone = availableContacts.length > 0 
          ? availableContacts[Math.floor(Math.random() * availableContacts.length)] 
          : (order.phone || '');

        // เช็คที่มา (Source) แบบรัดกุม 
        const sourceName = order.source || (order.isCsv ? 'CSV Import' : 'Mobile App');

        return {
          'Project name': proj.projectName || '',
          'Contact': order.customerName || '',
          'Phone': randomPhone,
          '*Pipeline': order.teamName || '', 
          '*Project Type': proj.projectType || '', 
          'Closing Potential': proj.interestLevel || order.interestLevel || '', 
          'Salesperson': order.salesName || '',
          '*Product Group': proj.categoryName || '', 
          '*Source': sourceName, // ✨ คอลัมน์ที่เพิ่มมาใหม่
          'Architecture': fmtStakeholder(proj.stakeholders.archAcc, proj.stakeholders.archCont),
          'Contractor': fmtStakeholder(proj.stakeholders.contAcc, proj.stakeholders.contCont),
          'Landscape': '', // ✨ คอลัมน์ที่เพิ่มมาใหม่ (เว้นว่างไว้ก่อนเพราะ Database ยังไม่มี)
          'Interior': fmtStakeholder(proj.stakeholders.intAcc, proj.stakeholders.intCont),
          'Developer': fmtStakeholder(proj.stakeholders.devAcc, proj.stakeholders.devCont),
          'Unit / Project': Number(proj.area) || 0, // ✨ ย้ายมาอยู่ตรงนี้
          'Note :': proj.note || '', // ✨ เปลี่ยนชื่อคอลัมน์ให้ตรงเป๊ะ
        };
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Project History');

    // จัดความกว้างคอลัมน์ใหม่ให้สอดคล้องกับคอลัมน์ที่เพิ่มมา
    const maxProps = [
      { wch: 30 }, // A: Project name
      { wch: 20 }, // B: Contact
      { wch: 20 }, // C: Phone 
      { wch: 20 }, // D: *Pipeline
      { wch: 20 }, // E: *Project Type
      { wch: 20 }, // F: Closing Potential
      { wch: 20 }, // G: Salesperson
      { wch: 20 }, // H: *Product Group
      { wch: 15 }, // I: *Source
      { wch: 30 }, // J: Architecture
      { wch: 30 }, // K: Contractor
      { wch: 30 }, // L: Landscape
      { wch: 30 }, // M: Interior
      { wch: 30 }, // N: Developer
      { wch: 15 }, // O: Unit / Project
      { wch: 30 }, // P: Note :
    ];
    worksheet['!cols'] = maxProps;

    const fileName = `Project_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  if (!ordersData || ordersData.length === 0) return null;

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl transition-all shadow-sm border border-emerald-500 hover:scale-[1.02] shrink-0"
    >
      <FileDown size={16} />
      โหลดข้อมูล
    </button>
  );
}
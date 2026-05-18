'use client';

import { useState } from 'react';
import { updateCheckInData } from '@/app/actions/checkin'; // เปลี่ยน path ให้ตรงกับที่เซฟ

interface Category {
  id: string;
  name: string;
}

interface EditProps {
  orderItemId: string;
  projectId: string;
  currentCategoryId: string;
  currentArea: number;
  userId: string;
  categories: Category[]; // รายชื่อหมวดหมู่ทั้งหมดสำหรับทำ Dropdown
}

export default function EditCheckInModal({ 
  orderItemId, 
  projectId, 
  currentCategoryId, 
  currentArea, 
  userId,
  categories 
}: EditProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [categoryId, setCategoryId] = useState(currentCategoryId || '');
  const [area, setArea] = useState(currentArea);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    const result = await updateCheckInData(orderItemId, projectId, categoryId, Number(area), userId);
    setIsSaving(false);
    
    if (result.success) {
      setIsOpen(false);
      alert('อัปเดตข้อมูลสำเร็จ!');
    } else {
      alert(`เกิดข้อผิดพลาด: ${result.message}`);
    }
  };

  if (!isOpen) return (
    <button onClick={() => setIsOpen(true)} className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-200 transition">
      แก้ไขข้อมูล
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-bold mb-4 text-slate-800">แก้ไขข้อมูล Check-in</h3>
        
        <div className="space-y-4">
          {/* Dropdown เลือกหมวดหมู่ */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">หมวดหมู่สินค้า (Product Category)</label>
            <select 
              value={categoryId} 
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 text-slate-700"
            >
              <option value="">-- ไม่ระบุหมวดหมู่ --</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Input แก้ไขพื้นที่ */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">พื้นที่ (ตร.ม.)</label>
            <input 
              type="number" 
              value={area} 
              onChange={(e) => setArea(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg p-2 text-slate-700"
              min="0"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button 
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200"
            disabled={isSaving}
          >
            ยกเลิก
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            disabled={isSaving}
          >
            {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  );
}
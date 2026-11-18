'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { revalidateWallcraftCache } from '@/lib/revalidateWallcraft';
import { 
  Search, 
  Edit, 
  Trash2, 
  Package, 
  Plus, 
  ArrowLeft, 
  Image as ImageIcon,
  CheckSquare,
  Square,
  MinusSquare,
  Filter,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Layers,
  RefreshCw
} from 'lucide-react';

export default function ManageProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCollection, setSelectedCollection] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleManualRevalidate = async () => {
    setIsRevalidating(true);
    const cacheResult = await revalidateWallcraftCache({ reason: 'manual-manage-products' });
    setNotification({
      type: cacheResult.ok ? 'success' : 'error',
      message: cacheResult.message,
    });
    setIsRevalidating(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // สรุปรายชื่อกลุ่ม / คอลเลกชัน ทั้งหมด พร้อมนับจำนวนสินค้าในแต่ละกลุ่ม
  const collectionStats = useMemo(() => {
    const counts: Record<string, number> = {};
    let noCollectionCount = 0;

    products.forEach((p) => {
      const col = p.collection?.trim();
      if (col) {
        counts[col] = (counts[col] || 0) + 1;
      } else {
        noCollectionCount++;
      }
    });

    const sortedCollections = Object.keys(counts).sort((a, b) => a.localeCompare(b, 'th'));
    return {
      list: sortedCollections,
      counts,
      noCollectionCount,
    };
  }, [products]);

  // ระบบค้นหาและกรองกลุ่ม Real-time
  useEffect(() => {
    let result = products;

    // กรองตามกลุ่ม / คอลเลกชัน
    if (selectedCollection !== 'all') {
      if (selectedCollection === '__none__') {
        result = result.filter((p) => !p.collection || !p.collection.trim());
      } else {
        result = result.filter((p) => p.collection?.trim() === selectedCollection);
      }
    }

    // กรองตามคำค้นหา
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      result = result.filter((p) => 
        (p.name && p.name.toLowerCase().includes(lower)) || 
        (p.collection && p.collection.toLowerCase().includes(lower))
      );
    }

    setFilteredProducts(result);
  }, [searchTerm, selectedCollection, products]);

  // ID ของสินค้าที่กำลังแสดงอยู่ทั้งหมดในขณะนี้
  const visibleIds = useMemo(() => filteredProducts.map((p) => String(p.id)), [filteredProducts]);
  const isAllSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const isPartiallySelected = visibleIds.some((id) => selectedIds.includes(id)) && !isAllSelected;

  // ดึงข้อมูลสินค้าแม่ และขอนับจำนวนลูก (Variants)
  const fetchProducts = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        collection,
        image_url,
        product_variants ( id )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      setNotification({
        type: 'error',
        message: 'ดึงข้อมูลไม่สำเร็จ: ' + error.message,
      });
    } else {
      setProducts(data || []);
      setFilteredProducts(data || []);
    }
    setIsLoading(false);
  };

  // เลือกทั้งหมด / ยกเลิกการเลือกในรายการที่แสดงอยู่
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // เลือก / ยกเลิกรายการเดียว
  const toggleSelectOne = (id: string | number) => {
    const idStr = String(id);
    setSelectedIds((prev) => 
      prev.includes(idStr) ? prev.filter((i) => i !== idStr) : [...prev, idStr]
    );
  };

  // ลบสินค้าเดี่ยว
  const deleteProduct = async (id: string | number, name: string) => {
    if (!confirm(`⚠️ ยืนยันการลบสินค้า "${name}" ใช่ไหมครับ?\n(การลบนี้จะลบรายการย่อยและ Variants ทั้งหมดของสินค้านี้ทิ้งด้วย)`)) return;

    try {
      // ลบ variants ลูกก่อนเพื่อป้องกัน foreign key constraint error
      await supabase.from('product_variants').delete().eq('product_id', id);
      const { error } = await supabase.from('products').delete().eq('id', id);

      if (error) throw error;

      const idStr = String(id);
      const deletedProduct = products.find((p) => String(p.id) === idStr);
      const cacheResult = await revalidateWallcraftCache({
        productId: id,
        collection: deletedProduct?.collection || undefined,
        reason: 'delete-product',
      });
      const cacheNote = cacheResult.ok
        ? ' • ล้างแคชหน้าเว็บอัตโนมัติเรียบร้อย'
        : ` • (หมายเหตุ: ${cacheResult.message})`;

      setSelectedIds((prev) => prev.filter((i) => i !== idStr));
      setNotification({
        type: 'success',
        message: `ลบสินค้า "${name}" เรียบร้อยแล้ว${cacheNote}`,
      });
      fetchProducts();
    } catch (error: any) {
      alert('ลบไม่สำเร็จ: ' + error.message);
    }
  };

  // ลบสินค้าแบบกลุ่ม / หลายรายการพร้อมกัน
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    const count = selectedIds.length;
    const confirmMsg = `⚠️ ยืนยันการลบสินค้าที่เลือกทั้งหมด ${count} รายการ ใช่ไหมครับ?\n\n(การลบนี้จะลบรายการย่อยและ Variants ทั้งหมดของสินค้าเหล่านี้ทิ้งอย่างถาวร)`;
    if (!confirm(confirmMsg)) return;

    setIsDeleting(true);
    try {
      const deletedIds = [...selectedIds];
      const deletedCollections = Array.from(
        new Set(
          products
            .filter((p) => deletedIds.includes(String(p.id)) && p.collection)
            .map((p) => String(p.collection))
        )
      );

      // แบ่ง batch ละ 50 รายการ เพื่อป้องกันข้อจำกัดความยาวของ URL ใน Supabase PostgREST
      const chunkSize = 50;
      for (let i = 0; i < deletedIds.length; i += chunkSize) {
        const chunk = deletedIds.slice(i, i + chunkSize);
        
        // 1. ลบ variants ลูก
        await supabase.from('product_variants').delete().in('product_id', chunk);
        
        // 2. ลบสินค้าแม่
        const { error } = await supabase.from('products').delete().in('id', chunk);
        if (error) throw error;
      }

      const cacheResult = await revalidateWallcraftCache({
        productIds: deletedIds,
        collections: deletedCollections,
        reason: 'bulk-delete-products',
      });
      const cacheNote = cacheResult.ok
        ? ' • ล้างแคชหน้าเว็บอัตโนมัติเรียบร้อย'
        : ` • (หมายเหตุ: ${cacheResult.message})`;

      setNotification({
        type: 'success',
        message: `ลบสินค้าที่เลือกสำเร็จทั้งหมด ${count} รายการ เรียบร้อยแล้ว${cacheNote}`,
      });
      setSelectedIds([]);
      fetchProducts();
    } catch (error: any) {
      console.error(error);
      alert('เกิดข้อผิดพลาดในการลบสินค้า: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full space-y-6 text-slate-800 font-sans pb-28">
      
      {/* 🌟 Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Package size={26} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800">จัดการข้อมูลสินค้าทั้งหมด</h1>
            <p className="text-sm text-slate-500 mt-0.5">ค้นหา, แก้ไข หรือเลือกลบสินค้าแบบเดี่ยวและแบบกลุ่มในระบบ Wallcraft</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={handleManualRevalidate}
            disabled={isRevalidating}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors border border-amber-200 disabled:opacity-60 cursor-pointer"
            title="สั่งล้างแคชหน้าเว็บ Wallcraft ทันที"
          >
            <RefreshCw size={16} className={isRevalidating ? 'animate-spin' : ''} />
            {isRevalidating ? 'กำลังล้างแคช...' : 'ล้างแคชหน้าเว็บ'}
          </button>
          <Link 
            href="/" 
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-xl transition-colors border border-slate-200"
          >
            <ArrowLeft size={16} /> หน้าหลัก
          </Link>
          <Link 
            href="/import-products" 
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
          >
            <Plus size={16} /> นำเข้าสินค้า (Import)
          </Link>
        </div>
      </div>

      {/* แจ้งเตือน Notification Banner */}
      {notification && (
        <div className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm font-medium animate-in fade-in slide-in-from-top-2 ${
          notification.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={18} className="text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button 
            onClick={() => setNotification(null)} 
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 🌟 Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-1">
          {/* กล่องค้นหา */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search size={18} className="text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="ค้นหาชื่อสินค้า หรือ คอลเลกชัน..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm bg-slate-50/50 focus:bg-white"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* ดรอปดาวน์กรองกลุ่ม / คอลเลกชัน */}
          <div className="relative sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Filter size={16} />
            </div>
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm bg-slate-50/50 focus:bg-white text-slate-700 cursor-pointer appearance-none truncate font-medium"
            >
              <option value="all">ทุกกลุ่ม / คอลเลกชัน ({products.length})</option>
              {collectionStats.noCollectionCount > 0 && (
                <option value="__none__">-- ไม่มีคอลเลกชัน ({collectionStats.noCollectionCount}) --</option>
              )}
              {collectionStats.list.map((col) => (
                <option key={col} value={col}>
                  {col} ({collectionStats.counts[col]} รายการ)
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
              <Layers size={14} />
            </div>
          </div>

          {/* ปุ่มรีเซ็ตตัวกรอง */}
          {(searchTerm || selectedCollection !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCollection('all');
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 underline whitespace-nowrap"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-sm text-slate-500 font-medium whitespace-nowrap">
          {selectedIds.length > 0 && (
            <span className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-lg text-xs font-bold">
              เลือกอยู่ {selectedIds.length} รายการ
            </span>
          )}
          <span>
            พบสินค้าทั้งหมด <strong className="text-blue-600 font-bold">{filteredProducts.length}</strong> รายการ
          </span>
        </div>
      </div>

      {/* 🌟 Product Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 select-none">
              <tr>
                {/* Master Checkbox */}
                <th className="py-3 px-4 w-12 text-center">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="p-1 rounded hover:bg-slate-200 text-slate-600 transition-colors inline-flex items-center justify-center cursor-pointer"
                    title={isAllSelected ? 'ยกเลิกการเลือกทั้งหมด' : 'เลือกทั้งหมดที่แสดง'}
                  >
                    {isAllSelected ? (
                      <CheckSquare size={19} className="text-blue-600" />
                    ) : isPartiallySelected ? (
                      <MinusSquare size={19} className="text-blue-600" />
                    ) : (
                      <Square size={19} className="text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-6 font-medium w-20">รูปภาพ</th>
                <th className="py-3 px-6 font-medium min-w-[200px]">ชื่อสินค้า (Product Name)</th>
                <th className="py-3 px-6 font-medium min-w-[180px]">คอลเลกชัน (Collection)</th>
                <th className="py-3 px-6 font-medium text-center w-36">ตัวเลือก (Variants)</th>
                <th className="py-3 px-6 font-medium text-right w-28">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500">
                    <div className="flex justify-center items-center gap-3">
                      <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                      กำลังโหลดข้อมูลสินค้า...
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Package size={40} className="text-slate-300" />
                      <p>ไม่พบรายการสินค้าที่ค้นหา</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const isSelected = selectedIds.includes(String(product.id));
                  return (
                    <tr 
                      key={product.id} 
                      className={`transition-colors group ${
                        isSelected ? 'bg-blue-50/70 hover:bg-blue-50' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Checkbox รายแถว */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSelectOne(product.id)}
                          className="p-1 rounded hover:bg-slate-200/80 text-slate-400 hover:text-blue-600 transition-colors inline-flex items-center justify-center cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare size={19} className="text-blue-600" />
                          ) : (
                            <Square size={19} className="text-slate-300 hover:text-slate-500" />
                          )}
                        </button>
                      </td>

                      {/* รูปภาพ */}
                      <td className="py-3 px-6">
                        <div className="w-12 h-12 rounded-lg border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <div title="รูปภาพสินค้า">
                              <ImageIcon size={20} className="text-slate-300" />
                            </div>
                          )}
                        </div>
                      </td>
                      
                      {/* ชื่อสินค้า */}
                      <td className="py-3 px-6 text-slate-800 font-medium">
                        {product.name || '-'}
                      </td>
                      
                      {/* คอลเลกชัน */}
                      <td className="py-3 px-6 text-slate-600">
                        {product.collection ? (
                          <button
                            type="button"
                            onClick={() => setSelectedCollection(product.collection)}
                            className="bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 px-2.5 py-1 rounded-md text-xs border border-slate-200 transition-colors cursor-pointer text-left font-medium"
                            title="คลิกเพื่อกรองเฉพาะกลุ่มนี้"
                          >
                            {product.collection}
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                      
                      {/* จำนวน Variants */}
                      <td className="py-3 px-6 text-center">
                        <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-semibold border border-blue-100">
                          {product.product_variants?.length || 0} แบบ
                        </span>
                      </td>
                      
                      {/* ปุ่มจัดการ */}
                      <td className="py-3 px-6 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* ลิงก์ไปหน้า Edit */}
                          <Link 
                            href={`/manage-products/${product.id}`}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                            title="แก้ไขข้อมูล"
                          >
                            <Edit size={18} />
                          </Link>
                          <button 
                            onClick={() => deleteProduct(product.id, product.name)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                            title="ลบสินค้า"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🌟 Floating Bulk Action Bar (สไตล์ Clean Light Theme ให้กลมกลืนกับหน้าเว็บ) */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white/95 backdrop-blur-md text-slate-800 px-5 py-3 rounded-2xl shadow-xl shadow-slate-300/40 border border-slate-200/90 flex flex-wrap items-center gap-4 md:gap-5 animate-in fade-in slide-in-from-bottom-4 max-w-[95vw]">
          <div className="flex items-center gap-3 pr-2 md:border-r border-slate-200">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-sm text-blue-600 shadow-xs">
              {selectedIds.length}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 whitespace-nowrap">
                เลือกอยู่ <span className="text-blue-600 font-extrabold">{selectedIds.length}</span> รายการ
              </p>
              <p className="text-[11px] text-slate-500 whitespace-nowrap">
                {selectedCollection !== 'all' ? `ในกลุ่ม: ${selectedCollection}` : 'จากสินค้าทั้งหมด'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isAllSelected && (
              <button
                type="button"
                onClick={() => {
                  setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
                }}
                className="text-xs font-medium bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 px-3.5 py-2 rounded-xl transition-colors border border-slate-200 hover:border-blue-200 whitespace-nowrap cursor-pointer"
              >
                เลือกทั้งหมดที่แสดง ({filteredProducts.length})
              </button>
            )}

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-xs font-medium bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 px-3.5 py-2 rounded-xl transition-colors border border-slate-200 whitespace-nowrap cursor-pointer"
            >
              ยกเลิกการเลือก
            </button>

            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="text-xs font-semibold bg-red-600 hover:bg-red-700 active:scale-95 disabled:opacity-50 text-white px-4 py-2 rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              {isDeleting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  กำลังลบ {selectedIds.length} รายการ...
                </>
              ) : (
                <>
                  <Trash2 size={15} />
                  ลบที่เลือก ({selectedIds.length} รายการ)
                </>
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

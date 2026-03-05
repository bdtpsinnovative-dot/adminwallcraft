'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Search, Edit, Trash2, Package, Plus, ArrowLeft, Image as ImageIcon} from 'lucide-react';

export default function ManageProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  // ระบบค้นหา Real-time
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredProducts(products);
    } else {
      const lower = searchTerm.toLowerCase();
      const filtered = products.filter(p => 
        (p.name && p.name.toLowerCase().includes(lower)) || 
        (p.collection && p.collection.toLowerCase().includes(lower))
      );
      setFilteredProducts(filtered);
    }
  }, [searchTerm, products]);

  const fetchProducts = async () => {
    setIsLoading(true);
    // ดึงข้อมูลสินค้าแม่ และขอนับจำนวนลูก (Variants) มาด้วยเพื่อแสดงผล
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
      alert('ดึงข้อมูลไม่สำเร็จ: ' + error.message);
    } else {
      setProducts(data || []);
      setFilteredProducts(data || []);
    }
    setIsLoading(false);
  };

  const deleteProduct = async (id: string, name: string) => {
    if (!confirm(`⚠️ ยืนยันการลบสินค้า "${name}" ใช่ไหมครับ?\n(การลบนี้จะลบรายการย่อยทั้งหมดของสินค้านี้ทิ้งด้วย)`)) return;

    // Supabase ถ้าตั้งค่า Foreign Key แบบ CASCADE ไว้ ลบแม่ปุ๊บ ลูกจะหายหมดอัตโนมัติ
    const { error } = await supabase.from('products').delete().eq('id', id);

    if (error) {
      alert('ลบไม่สำเร็จ: ' + error.message);
    } else {
      fetchProducts(); // โหลดข้อมูลใหม่
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* 🌟 Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <Package size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">จัดการข้อมูลสินค้าทั้งหมด</h1>
              <p className="text-sm text-slate-500 mt-0.5">ค้นหา, แก้ไข หรือลบสินค้าในระบบ Wallcraft</p>
            </div>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <Link 
              href="/" 
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200"
            >
              <ArrowLeft size={16} /> หน้าหลัก
            </Link>
            <Link 
              href="/import-products" 
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              <Plus size={16} /> นำเข้าสินค้า (Import)
            </Link>
          </div>
        </div>

        {/* 🌟 Search Toolbar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="ค้นหาชื่อสินค้า หรือ คอลเลกชัน..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
            />
          </div>
          <div className="text-sm text-slate-500 font-medium whitespace-nowrap">
            พบสินค้าทั้งหมด <span className="text-blue-600 font-bold">{filteredProducts.length}</span> รายการ
          </div>
        </div>

        {/* 🌟 Product Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-6 font-medium w-20">รูปภาพ</th>
                  <th className="py-3 px-6 font-medium">ชื่อสินค้า (Product Name)</th>
                  <th className="py-3 px-6 font-medium">คอลเลกชัน (Collection)</th>
                  <th className="py-3 px-6 font-medium text-center">ตัวเลือก (Variants)</th>
                  <th className="py-3 px-6 font-medium text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-500">
                      <div className="flex justify-center items-center gap-3">
                         <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                         กำลังโหลดข้อมูลสินค้า...
                      </div>
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <Package size={40} className="text-slate-300" />
                        <p>ไม่พบรายการสินค้าที่ค้นหา</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* รูปภาพ */}
                      <td className="py-3 px-6">
                        <div className="w-12 h-12 rounded-lg border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center">
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
                          <span className="bg-slate-100 px-2.5 py-1 rounded-md text-xs border border-slate-200">
                            {product.collection}
                          </span>
                        ) : '-'}
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
                          {/* 🔗 ลิงก์ไปหน้า Edit ที่เราสร้างไว้ */}
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
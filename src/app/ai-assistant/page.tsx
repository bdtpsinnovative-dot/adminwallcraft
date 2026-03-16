"use client";
import { useState } from 'react';

export default function AIAssistantPage() {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [aiAnalysis, setAiAnalysis] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (selected) {
            setFile(selected);
            setPreview(URL.createObjectURL(selected));
            setProducts([]);
            setAiAnalysis('');
        }
    };

    const handleSearch = async () => {
        if (!file) return alert("กรุณาเลือกรูปภาพก่อนครับ");
        setLoading(true);
        setProducts([]);
        setAiAnalysis('');

        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await fetch('/api/ai-assistant', { method: 'POST', body: formData });
            const data = await res.json();
            
            if (data.products) {
                setProducts(data.products);
                if (data.ai_analysis) setAiAnalysis(data.ai_analysis);
            } else if (data.error) {
                alert("เกิดข้อผิดพลาด: " + data.error);
            }
        } catch (err) {
            console.error(err);
            alert("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-center">🤖 ค้นหาสินค้าด้วย AI (Image Search)</h1>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 mb-6 text-center bg-white shadow-sm">
                {preview ? (
                    <img src={preview} className="max-h-64 mx-auto rounded-lg mb-4 shadow-md object-contain" alt="Preview" />
                ) : (
                    <div className="py-10 text-gray-400">อัปโหลดรูปภาพสินค้าเพื่อค้นหา</div>
                )}
                
                <div className="flex justify-center items-center gap-4 mt-4">
                    <input type="file" onChange={handleFileChange} accept="image/*" className="text-sm" />
                    <button 
                        onClick={handleSearch} 
                        disabled={loading || !file} 
                        className="bg-blue-600 text-white px-8 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                    >
                        {loading ? 'กำลังค้นหา...' : '🔍 ค้นหาเลย'}
                    </button>
                </div>
            </div>

            {loading && (
                <div className="text-center py-10">
                    <p className="text-blue-600 animate-pulse font-medium text-lg">🧠 AI กำลังวิเคราะห์รูปภาพและค้นหาในระบบ...</p>
                </div>
            )}

            {/* ส่วนแสดงข้อความจาก AI เมื่อหาไม่เจอ */}
            {!loading && aiAnalysis && products.length === 0 && (
                <div className="bg-amber-50 border-l-4 border-amber-400 p-5 mb-8 rounded-r-xl shadow-sm">
                    <div className="flex items-start">
                        <span className="text-3xl mr-4">💡</span>
                        <div>
                            <h3 className="text-amber-800 font-bold mb-1">ผลการวิเคราะห์จาก AI</h3>
                            <p className="text-amber-700">{aiAnalysis}</p>
                        </div>
                    </div>
                </div>
            )}

            {!loading && products.length > 0 && (
                <div>
                    <h2 className="text-xl font-semibold mb-6 border-b pb-2">พบสินค้าที่ใกล้เคียง ({products.length})</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
                        {products.map((product, idx) => {
                            const matchPercent = (product.similarity * 100).toFixed(1);
                            const displayName = `${product.name || '' } ${product.color || ''}`.trim();
                            
                            return (
                                <div key={idx} className="bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300">
                                    <div className="h-48 bg-gray-100 overflow-hidden relative">
                                        <img src={product.variant_image} alt={product.sku} className="w-full h-full object-cover" />
                                        <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                                            แมทช์ {matchPercent}%
                                        </div>
                                    </div>
                                    <div className="p-5">
                                        <p className="font-bold text-gray-800 text-lg mb-1 leading-tight h-12 overflow-hidden" title={displayName}>
                                            {displayName}
                                        </p>
                                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-50">
                                            <span className="text-xs text-gray-400 font-mono">SKU: {product.sku}</span>
                                            {product.price && <span className="font-extrabold text-blue-600">฿{product.price}</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
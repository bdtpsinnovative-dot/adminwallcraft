"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { revalidateWallcraftCache } from "@/lib/revalidateWallcraft";
import {
  Download,
  FileSpreadsheet,
  FileText,
  ArrowLeft,
  Package,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Layers,
  RefreshCw,
} from "lucide-react";

type FieldKey =
  | "odoo_sku"
  | "sku"
  | "product_name"
  | "collection"
  | "series"
  | "core_material"
  | "film"
  | "color"
  | "pattern"
  | "thickness_mm"
  | "width_mm"
  | "length_mm"
  | "weight_per_m2"
  | "price"
  | "cost"
  | "sqm_per_unit"
  | "joint_type"
  | "moq"
  | "description"
  | "product_type"
  | "variant_image"
  | "cad_url"
  | "usage_area"
  | "track_no";

interface ParsedVariantRow {
  rowNumber: number;
  odoo_sku: string | null;
  sku: string;
  product_name: string;
  collection: string | null;
  series: string | null;
  core_material: string | null;
  film: string | null;
  color: string | null;
  pattern: string | null;
  thickness_mm: number | null;
  width_mm: number | null;
  length_mm: number | null;
  weight_per_m2: number | null;
  price: number | null;
  cost: number | null;
  sqm_per_unit: number | null;
  joint_type: string | null;
  moq: string | null;
  description: string | null;
  product_type: string | null;
  variant_image: string | null;
  cad_url: string | null;
  usage_area: string | null;
  track_no: string | null;
}

const HEADER_ALIASES: Record<FieldKey, string[]> = {
  odoo_sku: ["odoo sku", "odoosku", "odoo_sku", "odoo"],
  sku: ["sku", "product sku", "variant sku", "รหัสสินค้า"],
  product_name: ["product name", "productname", "product_name", "name", "ชื่อสินค้า"],
  collection: ["collection", "คอลเลกชัน", "คอลเลกชั่น"],
  series: ["series", "ซีรีส์", "ซีรีย์"],
  core_material: ["core material", "corematerial", "core_material", "วัสดุแกนกลาง"],
  film: ["film", "ฟิล์ม"],
  color: ["color", "colour", "สี"],
  pattern: ["pattern", "ลาย", "ลวดลาย"],
  thickness_mm: ["thickness", "thickness_mm", "thickness (mm)", "thickness(mm)", "ความหนา"],
  width_mm: ["width", "width_mm", "width (mm)", "width(mm)", "ความกว้าง"],
  length_mm: ["length", "lenge", "length_mm", "length (mm)", "length(mm)", "ความยาว"],
  weight_per_m2: ["weight / m2", "weight/m2", "weight_per_m2", "weight per m2", "weight", "น้ำหนัก/ตรม"],
  price: ["price", "ราคา", "ราคาขาย"],
  cost: ["cost", "ต้นทุน"],
  sqm_per_unit: ["sqm", "sqm_per_unit", "sqm/unit", "ตร.ม.", "ตรม"],
  joint_type: ["joint", "joint_type", "joint type", "รอยต่อ"],
  moq: ["moq", "ขั้นต่ำ"],
  description: ["description", "รายละเอียด"],
  product_type: ["type", "product_type", "product type", "ประเภท"],
  variant_image: ["main picture", "mainpicture", "main_picture", "variant_image", "image_url", "image", "รูปภาพ"],
  cad_url: ["cad", "cad_url", "cad url", "ไฟล์ cad"],
  usage_area: ["พื้นที่แนะนำ", "พื้นที่ แนะนำ", "usage area", "usage_area", "พื้นที่ใช้งาน"],
  track_no: ["#", "track no", "track_no", "trackno", "hashtag"],
};

const LEGACY_23_COL_ORDER: FieldKey[] = [
  "sku",
  "product_name",
  "collection",
  "series",
  "core_material",
  "film",
  "color",
  "pattern",
  "thickness_mm",
  "width_mm",
  "length_mm",
  "weight_per_m2",
  "price",
  "cost",
  "sqm_per_unit",
  "joint_type",
  "moq",
  "description",
  "product_type",
  "variant_image",
  "cad_url",
  "usage_area",
  "track_no",
];

const FIELD_LABELS: Record<FieldKey, string> = {
  odoo_sku: "Odoo SKU",
  sku: "SKU",
  product_name: "Product Name",
  collection: "Collection",
  series: "Series",
  core_material: "Core Material",
  film: "Film",
  color: "Color",
  pattern: "Pattern",
  thickness_mm: "Thickness",
  width_mm: "Width",
  length_mm: "Length",
  weight_per_m2: "Weight/M2",
  price: "Price",
  cost: "Cost",
  sqm_per_unit: "SQM",
  joint_type: "Joint",
  moq: "MOQ",
  description: "Description",
  product_type: "Type",
  variant_image: "Main Picture",
  cad_url: "CAD",
  usage_area: "พื้นที่แนะนำ",
  track_no: "# (Track No)",
};

function normalizeHeader(raw: unknown): string {
  if (raw === undefined || raw === null) return "";
  return String(raw)
    .replace(/\uFEFF/g, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseStr(val: unknown): string | null {
  if (val === undefined || val === null) return null;
  const str = String(val).trim();
  return str === "" ? null : str;
}

function parseNum(val: unknown): number | null {
  if (val === undefined || val === null || val === "") return null;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  const str = String(val).replace(/,/g, "").trim();
  if (str === "") return null;
  const num = parseFloat(str);
  return Number.isFinite(num) ? num : null;
}

function resolveHeaderMap(headerRow: unknown[]): {
  map: Partial<Record<FieldKey, number>>;
  mode: "header" | "legacy";
  skippedHeaders: string[];
} {
  const map: Partial<Record<FieldKey, number>> = {};
  const skippedHeaders: string[] = [];

  headerRow.forEach((cell, colIdx) => {
    const norm = normalizeHeader(cell);
    if (!norm) return;

    let matchedKey: FieldKey | null = null;
    for (const [fieldKey, aliases] of Object.entries(HEADER_ALIASES) as Array<[FieldKey, string[]]>) {
      if (aliases.includes(norm)) {
        matchedKey = fieldKey;
        break;
      }
    }

    if (matchedKey && map[matchedKey] === undefined) {
      map[matchedKey] = colIdx;
    } else if (!matchedKey) {
      skippedHeaders.push(String(cell).replace(/[\r\n]+/g, " ").trim());
    }
  });

  // Require at least SKU + Product Name from header detection; otherwise fallback to legacy 23-col order
  if (map.sku !== undefined && map.product_name !== undefined) {
    return { map, mode: "header", skippedHeaders };
  }

  const legacyMap: Partial<Record<FieldKey, number>> = {};
  LEGACY_23_COL_ORDER.forEach((k, idx) => {
    legacyMap[k] = idx;
  });
  return { map: legacyMap, mode: "legacy", skippedHeaders: [] };
}

function parseRawMatrix(matrix: unknown[][]): {
  rows: ParsedVariantRow[];
  detectedMap: Partial<Record<FieldKey, number>>;
  mappingMode: "header" | "legacy";
  skippedHeaders: string[];
  skippedInvalidCount: number;
  duplicateSkuCount: number;
} {
  if (!matrix || matrix.length < 2) {
    return {
      rows: [],
      detectedMap: {},
      mappingMode: "header",
      skippedHeaders: [],
      skippedInvalidCount: 0,
      duplicateSkuCount: 0,
    };
  }

  // Find header row (usually row 0, but tolerate blank leading rows)
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(matrix.length, 5); i++) {
    const row = matrix[i] || [];
    const hasSku = row.some((c) => HEADER_ALIASES.sku.includes(normalizeHeader(c)));
    const hasName = row.some((c) => HEADER_ALIASES.product_name.includes(normalizeHeader(c)));
    if (hasSku && hasName) {
      headerRowIdx = i;
      break;
    }
  }

  const { map, mode, skippedHeaders } = resolveHeaderMap(matrix[headerRowIdx] || []);
  const getCell = (row: unknown[], key: FieldKey) => {
    const idx = map[key];
    return idx === undefined ? undefined : row[idx];
  };

  const rows: ParsedVariantRow[] = [];
  const seenSkus = new Set<string>();
  let skippedInvalidCount = 0;
  let duplicateSkuCount = 0;

  for (let i = headerRowIdx + 1; i < matrix.length; i++) {
    const raw = matrix[i];
    if (!raw || raw.every((c) => c === undefined || c === null || String(c).trim() === "")) {
      continue;
    }

    const sku = parseStr(getCell(raw, "sku"));
    const productName = parseStr(getCell(raw, "product_name"));
    if (!sku || !productName) {
      skippedInvalidCount += 1;
      continue;
    }

    if (seenSkus.has(sku)) {
      duplicateSkuCount += 1;
    } else {
      seenSkus.add(sku);
    }

    rows.push({
      rowNumber: i + 1,
      odoo_sku: parseStr(getCell(raw, "odoo_sku")),
      sku,
      product_name: productName,
      collection: parseStr(getCell(raw, "collection")),
      series: parseStr(getCell(raw, "series")),
      core_material: parseStr(getCell(raw, "core_material")),
      film: parseStr(getCell(raw, "film")),
      color: parseStr(getCell(raw, "color")),
      pattern: parseStr(getCell(raw, "pattern")),
      thickness_mm: parseNum(getCell(raw, "thickness_mm")),
      width_mm: parseNum(getCell(raw, "width_mm")),
      length_mm: parseNum(getCell(raw, "length_mm")),
      weight_per_m2: parseNum(getCell(raw, "weight_per_m2")),
      price: parseNum(getCell(raw, "price")),
      cost: parseNum(getCell(raw, "cost")),
      sqm_per_unit: parseNum(getCell(raw, "sqm_per_unit")),
      joint_type: parseStr(getCell(raw, "joint_type")),
      moq: parseStr(getCell(raw, "moq")),
      description: parseStr(getCell(raw, "description")),
      product_type: parseStr(getCell(raw, "product_type")),
      variant_image: parseStr(getCell(raw, "variant_image")),
      cad_url: parseStr(getCell(raw, "cad_url")),
      usage_area: parseStr(getCell(raw, "usage_area")),
      track_no: parseStr(getCell(raw, "track_no")),
    });
  }

  return {
    rows,
    detectedMap: map,
    mappingMode: mode,
    skippedHeaders,
    skippedInvalidCount,
    duplicateSkuCount,
  };
}

export default function BulkImportPage() {
  const [parsedRows, setParsedRows] = useState<ParsedVariantRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [workbookRef, setWorkbookRef] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [detectedFields, setDetectedFields] = useState<FieldKey[]>([]);
  const [mappingMode, setMappingMode] = useState<"header" | "legacy">("header");
  const [skippedHeaders, setSkippedHeaders] = useState<string[]>([]);
  const [skippedInvalidCount, setSkippedInvalidCount] = useState<number>(0);
  const [duplicateSkuCount, setDuplicateSkuCount] = useState<number>(0);

  const [isUploading, setIsUploading] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | null; message: string }>({
    type: null,
    message: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyMatrix = (matrix: unknown[][]) => {
    const result = parseRawMatrix(matrix);
    setParsedRows(result.rows);
    setDetectedFields(Object.keys(result.detectedMap) as FieldKey[]);
    setMappingMode(result.mappingMode);
    setSkippedHeaders(result.skippedHeaders);
    setSkippedInvalidCount(result.skippedInvalidCount);
    setDuplicateSkuCount(result.duplicateSkuCount);

    if (result.rows.length === 0) {
      setStatus({
        type: "error",
        message: "ไม่พบแถวข้อมูลสินค้าที่มี SKU และ Product Name ในชีตที่เลือก",
      });
    } else {
      setStatus({ type: null, message: "" });
    }
  };

  const loadWorkbookSheet = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: "",
      raw: false,
    });
    setSelectedSheet(sheetName);
    applyMatrix(matrix);
  };

  const handleManualRevalidate = async () => {
    setIsRevalidating(true);
    const cacheResult = await revalidateWallcraftCache({ reason: "manual-import-page" });
    setStatus({
      type: cacheResult.ok ? "success" : "error",
      message: cacheResult.message,
    });
    setIsRevalidating(false);
  };

  const resetFile = () => {
    setParsedRows([]);
    setFileName("");
    setWorkbookRef(null);
    setSheetNames([]);
    setSelectedSheet("");
    setDetectedFields([]);
    setSkippedHeaders([]);
    setSkippedInvalidCount(0);
    setDuplicateSkuCount(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // 📂 จัดการไฟล์ (รองรับทั้ง .xlsx, .xls และ .csv)
  const handleFile = async (file: File | null) => {
    if (!file) return;
    setStatus({ type: null, message: "" });
    setFileName(file.name);

    const lower = file.name.toLowerCase();
    try {
      if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        setWorkbookRef(wb);
        setSheetNames(wb.SheetNames);
        if (wb.SheetNames.length > 0) {
          loadWorkbookSheet(wb, wb.SheetNames[0]);
        }
      } else {
        setWorkbookRef(null);
        setSheetNames([]);
        setSelectedSheet("");
        Papa.parse(file, {
          header: false,
          skipEmptyLines: true,
          complete: (results) => {
            applyMatrix((results.data || []) as unknown[][]);
          },
          error: (err) => {
            setStatus({ type: "error", message: `อ่านไฟล์ CSV ไม่สำเร็จ: ${err.message}` });
          },
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "อ่านไฟล์ไม่สำเร็จ";
      setStatus({ type: "error", message: `อ่านไฟล์ไม่สำเร็จ: ${msg}` });
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFile(e.dataTransfer.files[0]);
    }
  };

  const uniqueSkuCount = useMemo(() => new Set(parsedRows.map((r) => r.sku)).size, [parsedRows]);

  // 🚀 อัปโหลดเข้า Supabase
  const uploadToSupabase = async () => {
    if (parsedRows.length === 0) return;
    setIsUploading(true);
    setStatus({ type: null, message: "" });

    try {
      const groups: Record<
        string,
        {
          name: string;
          collection: string | null;
          image_url: string | null;
          variantsBySku: Map<string, Record<string, unknown>>;
        }
      > = {};

      // 1. จัดกลุ่มข้อมูล (และกัน SKU ซ้ำในไฟล์เดียวกันโดยยึดแถวล่าสุด)
      for (const row of parsedRows) {
        const key = `${row.product_name}|${row.collection || ""}`;
        if (!groups[key]) {
          groups[key] = {
            name: row.product_name,
            collection: row.collection,
            image_url: row.variant_image,
            variantsBySku: new Map(),
          };
        } else if (!groups[key].image_url && row.variant_image) {
          groups[key].image_url = row.variant_image;
        }

        groups[key].variantsBySku.set(row.sku, {
          odoo_sku: row.odoo_sku,
          sku: row.sku,
          series: row.series,
          core_material: row.core_material,
          film: row.film,
          color: row.color,
          pattern: row.pattern,
          thickness_mm: row.thickness_mm,
          width_mm: row.width_mm,
          length_mm: row.length_mm,
          weight_per_m2: row.weight_per_m2,
          price: row.price,
          cost: row.cost,
          sqm_per_unit: row.sqm_per_unit,
          joint_type: row.joint_type,
          moq: row.moq,
          description: row.description,
          product_type: row.product_type,
          variant_image: row.variant_image,
          cad_url: row.cad_url,
          usage_area: row.usage_area,
          track_no: row.track_no,
          qty_per_unit: null,
          weight_per_piece: null,
          tags: null,
        });
      }

      // 2. ส่งเข้า Database
      const productKeys = Object.keys(groups);
      let successGroupCount = 0;
      let successVariantCount = 0;
      const errors: string[] = [];
      const importedProductIds: Array<string | number> = [];
      const importedCollections = new Set<string>();

      for (const key of productKeys) {
        const group = groups[key];

        // Step A: Upsert Products (ตารางแม่)
        const { data: prodData, error: prodError } = await supabase
          .from("products")
          .upsert(
            {
              name: group.name,
              collection: group.collection,
              image_url: group.image_url,
            },
            {
              onConflict: "name,collection",
              ignoreDuplicates: false,
            }
          )
          .select("id")
          .single();

        if (prodError) {
          console.error(`❌ Error Product [${group.name}]:`, prodError.message);
          errors.push(`Product [${group.name}]: ${prodError.message}`);
          continue;
        }

        const productId = prodData.id;

        // Step B: Upsert Product Variants (แบ่ง batch ทีละ 200 กัน payload ใหญ่เกิน)
        const variantsPayload = Array.from(group.variantsBySku.values()).map((v) => ({
          ...v,
          product_id: productId,
        }));

        let groupFailed = false;
        const BATCH_SIZE = 200;
        for (let b = 0; b < variantsPayload.length; b += BATCH_SIZE) {
          const chunk = variantsPayload.slice(b, b + BATCH_SIZE);
          const { error: varError } = await supabase
            .from("product_variants")
            .upsert(chunk, {
              onConflict: "sku",
              ignoreDuplicates: false,
            });

          if (varError) {
            console.error(`❌ Error Variants [${group.name}]:`, varError.message);
            errors.push(`Variants [${group.name}]: ${varError.message}`);
            groupFailed = true;
            break;
          }
        }

        if (!groupFailed) {
          successGroupCount += 1;
          successVariantCount += variantsPayload.length;
          importedProductIds.push(productId);
          if (group.collection) {
            importedCollections.add(group.collection);
          }
        }
      }

      let cacheNote = "";
      if (successGroupCount > 0) {
        const cacheResult = await revalidateWallcraftCache({
          productIds: importedProductIds,
          collections: Array.from(importedCollections),
          reason: "import-products",
        });
        cacheNote = cacheResult.ok
          ? " • ล้างแคชหน้าเว็บอัตโนมัติเรียบร้อย"
          : ` • (หมายเหตุ: ${cacheResult.message})`;
      }

      if (errors.length > 0) {
        setStatus({
          type: "error",
          message: `นำเข้าได้ ${successGroupCount} กลุ่ม (${successVariantCount} SKU) แต่พบข้อผิดพลาด ${errors.length} รายการ: ${errors[0]}`,
        });
      } else {
        setStatus({
          type: "success",
          message: `นำเข้าสินค้าสำเร็จ ${successGroupCount} กลุ่ม (${successVariantCount} SKU ไม่ซ้ำ พร้อม Odoo SKU เรียบร้อย)${cacheNote}`,
        });
        resetFile();
      }
    } catch (error: unknown) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "ไม่ทราบสาเหตุ";
      setStatus({ type: "error", message: `เกิดข้อผิดพลาด: ${msg}` });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full space-y-6 text-slate-800 font-sans pb-16">
      {/* 🌟 Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <UploadCloud size={26} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800">นำเข้าสินค้าเข้าระบบ (Bulk Import)</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              อัปโหลดไฟล์ Excel (.xlsx / .xls) หรือ CSV — จับคู่คอลัมน์จากชื่อหัวตารางอัตโนมัติ (รองรับ Odoo SKU)
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
          <a
            href="/Product_Import_Template.xlsx"
            download="Product_Import_Template.xlsx"
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors border border-emerald-200 shadow-xs"
            title="ดาวน์โหลดไฟล์เทมเพลต Excel สำหรับกรอกข้อมูล"
          >
            <FileSpreadsheet size={16} /> เทมเพลต Excel (.xlsx)
          </a>
          <a
            href="/Product_Import_Template.csv"
            download="Product_Import_Template.csv"
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors border border-blue-200 shadow-xs"
            title="ดาวน์โหลดไฟล์เทมเพลต CSV สำหรับกรอกข้อมูล"
          >
            <FileText size={16} /> เทมเพลต CSV (.csv)
          </a>
          <button
            type="button"
            onClick={handleManualRevalidate}
            disabled={isRevalidating}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors border border-amber-200 shadow-xs disabled:opacity-60 cursor-pointer"
            title="สั่งล้างแคชหน้าเว็บ Wallcraft ทันที"
          >
            <RefreshCw size={15} className={isRevalidating ? "animate-spin" : ""} />
            {isRevalidating ? "กำลังล้างแคช..." : "ล้างแคชหน้าเว็บ"}
          </button>
          <Link
            href="/manage-products"
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-medium text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-xl transition-colors border border-slate-200"
          >
            <Package size={16} /> จัดการสินค้า
          </Link>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-medium text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-xl transition-colors border border-slate-200"
          >
            <ArrowLeft size={16} /> หน้าหลัก
          </Link>
        </div>
      </div>

      {/* 🌟 Template Download & Instructions Box */}
      <div className="bg-white border border-blue-100/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-emerald-50/50 rounded-xl border border-blue-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Download size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">รองรับไฟล์ Master Sheet Excel (.xlsx) และ CSV โดยตรง</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                จับคู่ตามชื่อหัวคอลัมน์อัตโนมัติ (ข้ามคอลัมน์รูป/ช่องว่างให้เอง ไม่ต้องจัดลำดับใหม่) รองรับ <strong className="text-slate-700">Odoo SKU</strong>, <strong className="text-slate-700">พื้นที่แนะนำ</strong> และ <strong className="text-slate-700">#</strong>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <a
              href="/Product_Import_Template.xlsx"
              download="Product_Import_Template.xlsx"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
            >
              <FileSpreadsheet size={16} /> ดาวน์โหลด Excel (.xlsx)
            </a>
            <a
              href="/Product_Import_Template.csv"
              download="Product_Import_Template.csv"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
            >
              <FileText size={16} /> ดาวน์โหลด CSV (.csv)
            </a>
          </div>
        </div>

        {/* รายการคอลัมน์ที่รองรับ */}
        <div>
          <h2 className="text-slate-700 font-bold text-xs uppercase tracking-wider mb-2.5 flex items-center gap-2">
            <Layers size={15} className="text-blue-600" />
            หัวคอลัมน์ที่ระบบจับคู่อัตโนมัติ (24 ฟิลด์):
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {(Object.keys(FIELD_LABELS) as FieldKey[]).map((key) => {
              const isRequired = key === "sku" || key === "product_name";
              const isNew = key === "odoo_sku";
              return (
                <div
                  key={key}
                  className={`border px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between gap-1.5 ${
                    isNew
                      ? "bg-rose-50/70 border-rose-200 text-rose-800 font-semibold"
                      : isRequired
                      ? "bg-blue-50/60 border-blue-200 text-blue-900 font-semibold"
                      : "bg-slate-50 border-slate-200/80 text-slate-600"
                  }`}
                >
                  <span className="truncate">{FIELD_LABELS[key]}</span>
                  {isRequired && <span className="text-[10px] font-bold text-rose-500 shrink-0">*</span>}
                  {isNew && (
                    <span className="text-[9px] font-bold bg-rose-600 text-white px-1.5 py-0.2 rounded shrink-0">
                      NEW
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 🌟 Dropzone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50/60 shadow-sm"
        }`}
      >
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          ref={fileInputRef}
          onChange={(e) => void handleFile(e.target.files ? e.target.files[0] : null)}
          className="hidden"
        />
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
          <UploadCloud size={32} />
        </div>
        <h3 className="text-lg font-bold text-slate-700">ลากไฟล์ Excel (.xlsx) หรือ CSV มาวางที่นี่</h3>
        <p className="text-slate-500 text-sm mt-1">หรือคลิกเพื่อเลือกไฟล์จากเครื่องของคุณ</p>
        <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
          <span className="inline-block text-xs bg-emerald-50 text-emerald-700 font-semibold px-3 py-1 rounded-full border border-emerald-200">
            .xlsx / .xls (เลือกชีตได้)
          </span>
          <span className="inline-block text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full border border-slate-200">
            .csv (UTF-8)
          </span>
        </div>
      </div>

      {/* Status Messages */}
      {status.message && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 ${
            status.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div
            className={`p-1 rounded-full ${
              status.type === "success" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
            }`}
          >
            {status.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          </div>
          <div className="font-medium text-sm mt-0.5">{status.message}</div>
          <button
            type="button"
            onClick={() => setStatus({ type: null, message: "" })}
            className="ml-auto text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 🌟 Preview Area */}
      {parsedRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 space-y-3 bg-white">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-slate-800 text-base">ตัวอย่างข้อมูล: {fileName}</h2>
                <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full text-xs font-bold">
                  {parsedRows.length} แถว ({uniqueSkuCount} SKU ไม่ซ้ำ)
                </span>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-bold">
                  {mappingMode === "header" ? "จับคู่ตามชื่อหัวคอลัมน์อัตโนมัติ" : "โหมดเรียงคอลัมน์เดิม"}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {workbookRef && sheetNames.length > 1 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-bold text-slate-500">ชีต:</span>
                    <select
                      value={selectedSheet}
                      onChange={(e) => loadWorkbookSheet(workbookRef, e.target.value)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700"
                    >
                      {sheetNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  type="button"
                  onClick={resetFile}
                  className="text-xs text-slate-500 hover:text-red-600 font-medium transition-colors cursor-pointer"
                >
                  ล้างไฟล์ที่เลือก
                </button>
              </div>
            </div>

            {/* Detected Column Chips + Warnings */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="font-bold text-slate-500 mr-1">คอลัมน์ที่พบ ({detectedFields.length}):</span>
              {detectedFields.map((f) => (
                <span
                  key={f}
                  className={`px-2 py-0.5 rounded-md border font-semibold ${
                    f === "odoo_sku"
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-emerald-50/70 text-emerald-800 border-emerald-200"
                  }`}
                >
                  ✓ {FIELD_LABELS[f]}
                </span>
              ))}
              {skippedHeaders.length > 0 && (
                <span className="px-2 py-0.5 rounded-md border bg-slate-100 text-slate-500 border-slate-200">
                  ข้ามหัวที่ไม่ใช้: {skippedHeaders.join(", ")}
                </span>
              )}
            </div>

            {(duplicateSkuCount > 0 || skippedInvalidCount > 0) && (
              <div className="flex flex-wrap gap-2 text-xs">
                {duplicateSkuCount > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-medium">
                    <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                    พบ SKU ซ้ำในไฟล์ {duplicateSkuCount} แถว — ระบบจะรวมและยึดข้อมูลแถวล่าสุดให้อัตโนมัติ (กัน error ตอนบันทึก)
                  </div>
                )}
                {skippedInvalidCount > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 font-medium">
                    ข้าม {skippedInvalidCount} แถวที่ไม่มี SKU หรือ Product Name
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="overflow-x-auto max-h-[420px]">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-50 shadow-sm">
                <tr className="text-slate-500 border-b border-slate-200 text-xs font-semibold uppercase">
                  <th className="py-3 px-3 whitespace-nowrap">Odoo SKU</th>
                  <th className="py-3 px-3 whitespace-nowrap">SKU</th>
                  <th className="py-3 px-3 whitespace-nowrap">Product Name</th>
                  <th className="py-3 px-3 whitespace-nowrap">Collection</th>
                  <th className="py-3 px-3 whitespace-nowrap">Color</th>
                  <th className="py-3 px-3 whitespace-nowrap">Price</th>
                  <th className="py-3 px-3 whitespace-nowrap">Size (T×W×L)</th>
                  <th className="py-3 px-3 whitespace-nowrap">Main Picture</th>
                  <th className="py-3 px-3 whitespace-nowrap"># (Track)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedRows.slice(0, 25).map((row, idx) => (
                  <tr key={`${row.sku}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 text-rose-700 font-mono text-xs whitespace-nowrap">
                      {row.odoo_sku || "-"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-800 font-semibold text-xs whitespace-nowrap">
                      {row.sku}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 text-xs whitespace-nowrap">
                      {row.product_name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 text-xs whitespace-nowrap">
                      {row.collection || "-"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 text-xs whitespace-nowrap">
                      {row.color || "-"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 font-mono text-xs whitespace-nowrap">
                      {row.price !== null ? row.price.toLocaleString() : "-"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 text-xs font-mono whitespace-nowrap">
                      {row.thickness_mm ?? "-"} / {row.width_mm ?? "-"} / {row.length_mm ?? "-"}
                    </td>
                    <td className="py-2.5 px-3 text-xs whitespace-nowrap">
                      {row.variant_image ? (
                        <span className="text-emerald-700 font-semibold">✓ มี URL</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 text-xs whitespace-nowrap">
                      {row.track_no || "-"}
                    </td>
                  </tr>
                ))}
                {parsedRows.length > 25 && (
                  <tr>
                    <td colSpan={9} className="py-4 text-center text-slate-400 text-xs bg-slate-50/50">
                      ...แสดงเฉพาะ 25 รายการแรก จากทั้งหมด {parsedRows.length} แถว ({uniqueSkuCount} SKU ไม่ซ้ำ)...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-5 border-t border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={uploadToSupabase}
              disabled={isUploading}
              className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer"
            >
              {isUploading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>กำลังประมวลผลและนำเข้า Database...</span>
                </>
              ) : (
                <>
                  <UploadCloud size={20} />
                  <span>ยืนยันและนำเข้า Database ({uniqueSkuCount} SKU)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

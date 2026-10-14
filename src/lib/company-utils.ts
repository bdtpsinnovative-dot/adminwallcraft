/**
 * Utilities for normalizing and consolidating company names dynamically
 * on dashboard and history views without altering the underlying database.
 */

// Common Thai to English business & real estate keywords
const THAI_TO_ENG_KEYWORDS: [RegExp, string][] = [
  // Major developers & retail brands
  [/เดอะ\s*มอลล์\s*กรุ๊ป|เดอะ\s*มอลล์/gi, 'the mall'],
  [/เซ็นทรัล\s*พัฒนา|เซ็นทรัล/gi, 'central'],
  [/แสนสิริ/gi, 'sansiri'],
  [/อนันดา/gi, 'ananda'],
  [/ศุภาลัย/gi, 'supalai'],
  [/พฤกษา/gi, 'pruksa'],
  [/สัมมากร/gi, 'sammakorn'],
  [/แลนด์\s*แอนด์\s*เฮ้าส์|แลนด์แอนด์เฮ้าส์/gi, 'land and houses'],
  [/สยามพิวรรธน์/gi, 'siam piwat'],
  [/เอสซี\s*แอสเสท/gi, 'sc asset'],
  [/เอสซีจี/gi, 'scg'],
  [/มารวย/gi, 'maruay'],
  [/โนเบิล/gi, 'noble'],
  [/สิงห์\s*เอสเตท/gi, 'singha estate'],
  [/ออริจิ้น/gi, 'origin'],
  [/บุญถาวร/gi, 'boonthavorn'],
  [/โฮมโปร/gi, 'homepro'],
  [/อินเด็กซ์/gi, 'index'],
  // Industry terminology
  [/โชว์รูม/gi, 'showroom'],
  [/สตูดิโอ/gi, 'studio'],
  [/ดีไซน์/gi, 'design'],
  [/กรุ๊ป/gi, 'group'],
  [/สถาปนิก|อาร์คิเทค/gi, 'architect'],
  [/อินทีเรีย|อินทิเรีย/gi, 'interior'],
  [/คอนสตรัคชั่น/gi, 'construction'],
  [/คอนซัลแทนท์|คอนซัลท์/gi, 'consultant'],
  [/พร็อพเพอร์ตี้|พรอพเพอร์ตี้/gi, 'property'],
  [/ดีเวลลอปเมนท์|ดีเวลลอปเม้นท์|เดเวลลอปเมนท์/gi, 'development'],
  [/เรียล\s*เอสเตท|เรียลเอสเตท/gi, 'real estate'],
  [/เอ็นจิเนียริ่ง|เอนจิเนียริ่ง/gi, 'engineering'],
  [/บิลท์อิน|บิวท์อิน|บิ้วอิน/gi, 'builtin']
];

export function normalizeCompanyName(rawName?: string | null): string {
  if (!rawName) return '';
  let str = rawName.trim().toLowerCase();

  // 1. Remove common Thai corporate prefixes
  str = str.replace(
    /^(บริษัท\s*จำกัด|บริษัท|บจก\.?|บ\.\s*จ\.\s*ก\.?|บ\.?|ห้างหุ้นส่วนจำกัด|หจก\.?|ห้างหุ้นส่วนสามัญ|หสม\.?|ร้าน|กลุ่ม)\s*/i,
    ''
  );

  // 2. Remove common Thai & English corporate suffixes
  str = str.replace(
    /\s*(จำกัด\s*\(มหาชน\)|จำกัด|\(จำกัด\)|\(มหาชน\)|co\.?,?\s*ltd\.?|ltd\.?|limited|corp\.?|corporation|inc\.?|llc\.?)\s*$/i,
    ''
  );

  // 3. Transliterate common Thai corporate / real estate keywords into English
  THAI_TO_ENG_KEYWORDS.forEach(([regex, en]) => {
    str = str.replace(regex, en);
  });

  // 4. Remove punctuation and special symbols
  str = str.replace(/[\.\,\-\_\(\)\[\]\{\}\'\"\/\\+\&\#\@\!]/g, ' ');

  // 4. Collapse multiple spaces
  str = str.replace(/\s+/g, ' ').trim();

  // Fallback to lowercase trimmed original if completely stripped
  if (!str) {
    str = rawName.trim().toLowerCase();
  }

  return str;
}

/**
 * Compares two names for the same company and returns the best formatted display name.
 * e.g., prefers "showroom BTV" over "showroom btv", or proper capitalization.
 */
export function chooseBestCompanyName(currentName: string, candidateName: string): string {
  if (!currentName) return candidateName;
  if (!candidateName) return currentName;

  const trimmedCurrent = currentName.trim();
  const trimmedCandidate = candidateName.trim();

  if (trimmedCurrent === trimmedCandidate) return trimmedCurrent;

  // Count uppercase letters (acronyms or proper names like BTV, Studio)
  const upperCurrent = (trimmedCurrent.match(/[A-Z]/g) || []).length;
  const upperCandidate = (trimmedCandidate.match(/[A-Z]/g) || []).length;

  if (upperCandidate > upperCurrent) {
    return trimmedCandidate;
  }
  if (upperCandidate < upperCurrent) {
    return trimmedCurrent;
  }

  // If tied, prefer the longer name (which often preserves useful context)
  return trimmedCandidate.length > trimmedCurrent.length ? trimmedCandidate : trimmedCurrent;
}

/**
 * Extracts a core keyword from normalized name to use with SQL ILIKE query
 */
export function getCoreCompanyKeyword(normalizedName: string): string {
  if (!normalizedName) return '';
  const parts = normalizedName.split(' ').filter(Boolean);
  return parts[0] || normalizedName;
}

export interface MappingGroup {
  id: string;
  targetName: string;
  companyIds: string[];
  aliasNames?: string[];
  isSuggested?: boolean;
}

export interface MappingConfig {
  version: number;
  updated_at: string;
  groups: MappingGroup[];
}

export interface ResolvedCompany {
  primaryId: string;
  targetName: string;
  groupKey: string;
  allIds: string[];
}

/**
 * Builds a fast lookup map from configured mapping groups
 */
export function buildMappingLookup(groups: MappingGroup[]): Map<string, MappingGroup> {
  const lookup = new Map<string, MappingGroup>();
  groups.forEach(g => {
    // Map each specific company ID in this group
    g.companyIds.forEach(id => {
      lookup.set(`id:${id}`, g);
    });
    // Map normalized target name
    const normTarget = normalizeCompanyName(g.targetName);
    if (normTarget) {
      lookup.set(`norm:${normTarget}`, g);
    }
    // Map each alias name
    (g.aliasNames || []).forEach(alias => {
      const normAlias = normalizeCompanyName(alias);
      if (normAlias) {
        lookup.set(`norm:${normAlias}`, g);
      }
    });
  });
  return lookup;
}

/**
 * Resolves a company's target name, group key, and all sister IDs
 */
export function resolveCompany(
  company: { id: string; name: string },
  customMap?: Map<string, MappingGroup>
): ResolvedCompany {
  const normKey = normalizeCompanyName(company.name);

  if (customMap) {
    const byId = customMap.get(`id:${company.id}`);
    if (byId) {
      return {
        primaryId: byId.companyIds[0] || company.id,
        targetName: byId.targetName,
        groupKey: byId.id,
        allIds: byId.companyIds
      };
    }

    const byNorm = customMap.get(`norm:${normKey}`);
    if (byNorm) {
      return {
        primaryId: byNorm.companyIds[0] || company.id,
        targetName: byNorm.targetName,
        groupKey: byNorm.id,
        allIds: byNorm.companyIds
      };
    }
  }

  return {
    primaryId: company.id,
    targetName: company.name.trim(),
    groupKey: normKey || company.name.trim().toLowerCase(),
    allIds: [company.id]
  };
}

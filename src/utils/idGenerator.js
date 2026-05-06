import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export const generateIdPaket = async (jenisPaket, singkatanAP) => {
  try {
    let prefix = '';

    if (jenisPaket === 'Single Year (SY)' || jenisPaket === 'SY') {
      prefix = 'SY';
    } else if (jenisPaket === 'Multi Year (MY)' || jenisPaket === 'MY') {
      prefix = 'MY';
    } else {
      prefix = 'SY'; // fallback default
    }

    // Fallback jika singkatanAP kosong
    const kodeAP = (singkatanAP && singkatanAP.trim() !== '')
      ? singkatanAP.trim().toUpperCase()
      : 'AP';

    const currentYear = new Date().getFullYear();
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const idPaket = `${prefix}.${currentYear}.${kodeAP}.${randomNum}`;

    const komitmenRef = collection(db, 'komitmen');
    const q = query(komitmenRef, where('idPaketMonitoring', '==', idPaket));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      console.log(`ID ${idPaket} sudah ada, regenerate...`);
      return generateIdPaket(jenisPaket, singkatanAP);
    }

    return idPaket;

  } catch (error) {
    throw error;
  }
};

export const parseExcelBoolean = (value) => {
  if (value === undefined || value === null || value === '') return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.toUpperCase().trim();
    return normalized === 'TRUE' || normalized === 'YES' || normalized === '1' || normalized === 'YA';
  }
  return false;
};

/**
 * Map nama bulan Indonesia & Inggris ke angka 2 digit.
 */
const MONTH_MAP = {
  // Indonesia
  januari: '01', februari: '02', maret: '03', april: '04',
  mei: '05', juni: '06', juli: '07', agustus: '08',
  september: '09', oktober: '10', november: '11', desember: '12',
  // English
  january: '01', february: '02', march: '03',
  may: '05', june: '06', july: '07', august: '08',
  october: '10', december: '12',
  // Abbreviations (English)
  jan: '01', feb: '02', mar: '03', apr: '04',
  jun: '06', jul: '07', aug: '08', sep: '09', oct: '10',
  nov: '11', dec: '12',
  // Abbreviations (Indonesia)
  agt: '08', okt: '10', des: '12',
};

/**
 * parseExcelDate — konversi berbagai format tanggal dari Excel ke YYYY-MM-DD.
 *
 * Format yang didukung:
 *   • Date object     — XLSX.js cellDates:true, pakai UTC methods
 *   • Serial number   — Excel epoch UTC math (misal: 46023 → 2026-01-01)
 *   • "YYYY-MM-DD"    — sudah ISO, langsung return
 *   • "DD MMMM YYYY"  — "01 November 2026" / "01 Januari 2026"
 *   • "DD/MM/YYYY"    — format Indonesia   (01/11/2026)
 *   • "M/D/YYYY"      — format US Excel    (11/1/2026)
 *   • "DD-MM-YYYY"    — format dengan dash
 *   • "YYYY/MM/DD"    — format ISO dengan slash
 *
 * Semua jalur pakai UTC untuk konsistensi lintas timezone (Indonesia, US, dll).
 */
export const parseExcelDate = (value) => {
  if (value === null || value === undefined || value === '') return '';

  // ── 1. Date object (XLSX.js cellDates:true → UTC midnight) ───────────────
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    // PENTING: gunakan UTC methods — XLSX.js membuat new Date(Date.UTC(...))
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // ── 2. Excel serial number ────────────────────────────────────────────────
  if (typeof value === 'number') {
    if (!isFinite(value) || value <= 0) return '';
    // Excel epoch: 30 Des 1899 UTC (kompensasi bug leap year 1900 di Excel)
    const MS_PER_DAY = 86400000;
    const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30); // Dec 30, 1899
    const utcMs = EXCEL_EPOCH_MS + Math.round(value) * MS_PER_DAY;
    const date = new Date(utcMs);
    if (isNaN(date.getTime())) return '';
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // ── 3. String ─────────────────────────────────────────────────────────────
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';

    // 3a. Sudah YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

    // 3b. "DD MMMM YYYY" atau "D MMMM YYYY"  →  "01 November 2026"
    const matchLong = trimmed.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/);
    if (matchLong) {
      const [, day, monthName, year] = matchLong;
      const month = MONTH_MAP[monthName.toLowerCase()];
      if (month) return `${year}-${month}-${day.padStart(2, '0')}`;
    }

    // 3c. Separator / atau - dengan tahun di akhir: DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY
    const matchSep = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (matchSep) {
      const [, p1s, p2s, year] = matchSep;
      const p1 = parseInt(p1s, 10);
      const p2 = parseInt(p2s, 10);
      // p1 > 12 pasti hari, p2 = bulan
      if (p1 > 12) return `${year}-${p2s.padStart(2, '0')}-${p1s.padStart(2, '0')}`;
      // p2 > 12 pasti hari, p1 = bulan (format US: M/D/YYYY)
      if (p2 > 12) return `${year}-${p1s.padStart(2, '0')}-${p2s.padStart(2, '0')}`;
      // Ambiguous → default DD/MM/YYYY (Indonesia)
      return `${year}-${p2s.padStart(2, '0')}-${p1s.padStart(2, '0')}`;
    }

    // 3d. Tahun di depan: YYYY/MM/DD
    const matchISO = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (matchISO) {
      const [, year, month, day] = matchISO;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // 3e. Fallback JS Date.parse — gunakan UTC untuk konsistensi
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getUTCFullYear();
      const m = String(parsed.getUTCMonth() + 1).padStart(2, '0');
      const d = String(parsed.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    return '';
  }

  return '';
};

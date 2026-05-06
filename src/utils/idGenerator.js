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
      throw new Error('Jenis paket tidak valid. Harus "Single Year (SY)" atau "Multi Year (MY)"');
    }
    
    if (!singkatanAP || singkatanAP.trim() === '') {
      throw new Error('Singkatan AP tidak boleh kosong');
    }
    
    const currentYear = new Date().getFullYear();
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const idPaket = `${prefix}.${currentYear}.${singkatanAP.toUpperCase()}.${randomNum}`;
    
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

export const parseExcelDate = (value) => {
  if (!value) return '';
  
  // Handle Date object
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  
  // Handle string format DD/MM/YYYY (dari Excel Indonesia)
  if (typeof value === 'string') {
    const trimmed = value.trim();
    
    // Format DD/MM/YYYY
    const ddmmyyyyRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const matchDDMMYYYY = trimmed.match(ddmmyyyyRegex);
    if (matchDDMMYYYY) {
      const [, day, month, year] = matchDDMMYYYY;
      return `${year}-${month}-${day}`; // Convert to YYYY-MM-DD
    }
    
    // Format YYYY-MM-DD (sudah benar)
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    
    // Try parsing as generic date string
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  // Handle Excel serial number
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return date.toISOString().split('T')[0];
  }
  
  return '';
};

/**
 * Validasi data import dari Excel.
 * Hanya Nama AP dan Nama Paket yang wajib diisi.
 * Field lain bersifat opsional dan akan diisi dengan nilai default saat import,
 * kemudian dapat dilengkapi melalui Edit di Tab Komitmen.
 */


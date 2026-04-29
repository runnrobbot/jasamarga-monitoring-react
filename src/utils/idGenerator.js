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

export const validateIdPaket = (idPaket) => {
  const regex = /^(SY|MY)\.\d{4}\.[A-Z]{2,10}\.\d{5}$/;
  return regex.test(idPaket);
};

export const parseIdPaket = (idPaket) => {
  if (!validateIdPaket(idPaket)) {
    return null;
  }
  
  const parts = idPaket.split('.');
  
  return {
    jenisPaket: parts[0] === 'SY' ? 'Single Year (SY)' : 'Multi Year (MY)',
    prefix: parts[0],
    tahun: parts[1],
    singkatanAP: parts[2],
    randomNum: parts[3]
  };
};

export const getSingkatanFromNamaAP = (namaAP, masterAPList) => {
  const ap = masterAPList.find(item => item.namaAP === namaAP);
  return ap ? ap.singkatanAP : null;
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
export const validateImportData = (data) => {
  const errors = [];
  
  if (!Array.isArray(data) || data.length === 0) {
    errors.push('Data import kosong atau tidak valid');
    return errors;
  }

  data.forEach((row, index) => {
    const rowNum = index + 2;

    // Wajib: Nama Paket dan Nama AP
    if (!row['Nama Paket'] || row['Nama Paket'].toString().trim() === '') {
      errors.push(`Baris ${rowNum}: Nama Paket wajib diisi`);
    }

    if (!row['Nama AP'] || row['Nama AP'].toString().trim() === '') {
      errors.push(`Baris ${rowNum}: Nama AP wajib diisi`);
    }

    // Opsional: jika PDN/TKDN/Import diisi, hanya boleh 1 yang TRUE
    const pdnValue = parseExcelBoolean(row['PDN']);
    const tkdnValue = parseExcelBoolean(row['TKDN']);
    const importValue = parseExcelBoolean(row['Import']);
    
    const checkboxCount = [pdnValue, tkdnValue, importValue].filter(v => v === true).length;
    
    if (checkboxCount > 1) {
      errors.push(`Baris ${rowNum}: Hanya boleh 1 checkbox yang TRUE (PDN, TKDN, atau Import)`);
    }

    // Opsional: nilai numerik jika diisi harus berupa angka
    const numericFields = [
      'Nilai Komitmen', 
      'Komitmen Keseluruhan', 
      'Nilai Rencana',
      'Nilai Tahun Berjalan PDN',
      'Nilai Keseluruhan PDN',
      'Nilai Tahun Berjalan TKDN',
      'Nilai Keseluruhan TKDN',
      'Nilai Tahun Berjalan Import',
      'Nilai Keseluruhan Import',
      'Target Nilai TKDN', 
      'Nilai Anggaran Belanja'
    ];
    
    numericFields.forEach(field => {
      if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
        const value = parseFloat(row[field]);
        if (isNaN(value)) {
          errors.push(`Baris ${rowNum}: ${field} harus berupa angka`);
        }
      }
    });

    // Opsional: format tanggal jika diisi harus valid
    const dateFields = ['Waktu Pemanfaatan Dari', 'Waktu Pemanfaatan Sampai'];  
    dateFields.forEach(field => {
      if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
        const parsedDate = parseExcelDate(row[field]);
        if (!parsedDate || parsedDate === '') {
          errors.push(`Baris ${rowNum}: ${field} format tidak valid. Gunakan DD/MM/YYYY (contoh: 02/02/2028)`);
        }
      }
    });

    // Opsional: Bulan Rencana jika diisi harus 1-12
    if (row['Bulan Rencana']) {
      const bulanValue = parseInt(row['Bulan Rencana']);
      if (isNaN(bulanValue) || bulanValue < 1 || bulanValue > 12) {
        errors.push(`Baris ${rowNum}: Bulan Rencana harus angka 1-12 (1=Januari, 12=Desember)`);
      }
    }
  });

  return errors;
};

export default {
  generateIdPaket,
  validateIdPaket,
  parseIdPaket,
  getSingkatanFromNamaAP,
  validateImportData,
  parseExcelBoolean,
  parseExcelDate
};
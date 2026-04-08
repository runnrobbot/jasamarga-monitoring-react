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

export const validateImportData = (data) => {
  const errors = [];
  
  if (!Array.isArray(data) || data.length === 0) {
    errors.push('Data import kosong atau tidak valid');
    return errors;
  }

  const requiredFields = [
    'Jenis Paket',
    'Nama AP',
    'Nama Paket',
    'Jenis Anggaran',
    'Jenis Pengadaan',
    'Metode Pemilihan',
    'Status PaDi',
    'Nilai Komitmen',
    'Komitmen Keseluruhan',
    'Waktu Pemanfaatan Dari',
    'Waktu Pemanfaatan Sampai'
  ];

  const validJenisPaket = ['Single Year (SY)', 'Multi Year (MY)', 'SY', 'MY'];
  const validJenisAnggaran = ['Opex', 'Capex'];
  const validJenisPengadaan = ['Barang', 'Jasa Konsultasi', 'Jasa Lainnya', 'Pekerjaan Konstruksi'];
  const validMetodePemilihan = [
    'Tender/Seleksi Umum',
    'Tender/Seleksi Terbatas',
    'Penunjukan Langsung',
    'Pengadaan Langsung',
    'Penetapan Langsung'
  ];
  const validStatusPadi = ['PaDi', 'Non PaDi'];
  const validStatus = ['active', 'inactive'];

  data.forEach((row, index) => {
    const rowNum = index + 2;

    requiredFields.forEach(field => {
      if (!row[field] || row[field].toString().trim() === '') {
        errors.push(`Baris ${rowNum}: ${field} wajib diisi`);
      }
    });

    if (row['PDN'] === undefined || row['PDN'] === null || row['PDN'] === '') {
      errors.push(`Baris ${rowNum}: PDN wajib diisi (TRUE atau FALSE)`);
    }
    
    if (row['TKDN'] === undefined || row['TKDN'] === null || row['TKDN'] === '') {
      errors.push(`Baris ${rowNum}: TKDN wajib diisi (TRUE atau FALSE)`);
    }
    
    if (row['Import'] === undefined || row['Import'] === null || row['Import'] === '') {
      errors.push(`Baris ${rowNum}: Import wajib diisi (TRUE atau FALSE)`);
    }

    ['PDN', 'TKDN', 'Import'].forEach(field => {
      if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
        const val = row[field].toString().toUpperCase();
        if (val !== 'TRUE' && val !== 'FALSE') {
          errors.push(`Baris ${rowNum}: ${field} harus TRUE atau FALSE`);
        }
      }
    });

    const pdnValue = parseExcelBoolean(row['PDN']);
    const tkdnValue = parseExcelBoolean(row['TKDN']);
    const importValue = parseExcelBoolean(row['Import']);
    
    const checkboxCount = [pdnValue, tkdnValue, importValue].filter(v => v === true).length;
    
    if (checkboxCount === 0) {
      errors.push(`Baris ${rowNum}: Minimal 1 checkbox harus TRUE (PDN, TKDN, atau Import)`);
    }
    
    if (checkboxCount > 1) {
      errors.push(`Baris ${rowNum}: Hanya boleh 1 checkbox yang TRUE`);
    }

    if (pdnValue === true) {
      if (!row['Nilai Tahun Berjalan PDN'] || parseFloat(row['Nilai Tahun Berjalan PDN']) <= 0) {
        errors.push(`Baris ${rowNum}: Nilai Tahun Berjalan PDN wajib diisi karena PDN = TRUE`);
      }
      if (!row['Nilai Keseluruhan PDN'] || parseFloat(row['Nilai Keseluruhan PDN']) <= 0) {
        errors.push(`Baris ${rowNum}: Nilai Keseluruhan PDN wajib diisi karena PDN = TRUE`);
      }
    }

    if (tkdnValue === true) {
      if (!row['Nilai Tahun Berjalan TKDN'] || parseFloat(row['Nilai Tahun Berjalan TKDN']) <= 0) {
        errors.push(`Baris ${rowNum}: Nilai Tahun Berjalan TKDN wajib diisi karena TKDN = TRUE`);
      }
      if (!row['Nilai Keseluruhan TKDN'] || parseFloat(row['Nilai Keseluruhan TKDN']) <= 0) {
        errors.push(`Baris ${rowNum}: Nilai Keseluruhan TKDN wajib diisi karena TKDN = TRUE`);
      }
    }

    if (importValue === true) {
      if (!row['Nilai Tahun Berjalan Import'] || parseFloat(row['Nilai Tahun Berjalan Import']) <= 0) {
        errors.push(`Baris ${rowNum}: Nilai Tahun Berjalan Import wajib diisi karena Import = TRUE`);
      }
      if (!row['Nilai Keseluruhan Import'] || parseFloat(row['Nilai Keseluruhan Import']) <= 0) {
        errors.push(`Baris ${rowNum}: Nilai Keseluruhan Import wajib diisi karena Import = TRUE`);
      }
    }

    const hasNilaiRencana = row['Nilai Rencana'] && parseFloat(row['Nilai Rencana']) > 0;
    const hasTahunRencana = row['Tahun Rencana'] && row['Tahun Rencana'].toString().trim() !== '';

    const isMY = row['Jenis Paket'] === 'Multi Year (MY)' || row['Jenis Paket'] === 'MY';
    
    if (hasNilaiRencana && isMY && !hasTahunRencana) {
      errors.push(`Baris ${rowNum}: Tahun Rencana wajib diisi untuk Multi Year jika ada Nilai Rencana`);
    }

    if (row['Jenis Paket'] && !validJenisPaket.includes(row['Jenis Paket'])) {
      errors.push(`Baris ${rowNum}: Jenis Paket harus "Single Year (SY)" atau "Multi Year (MY)"`);
    }

    if (row['Jenis Anggaran'] && !validJenisAnggaran.includes(row['Jenis Anggaran'])) {
      errors.push(`Baris ${rowNum}: Jenis Anggaran harus "Opex" atau "Capex"`);
    }

    if (row['Jenis Pengadaan'] && !validJenisPengadaan.includes(row['Jenis Pengadaan'])) {
      errors.push(`Baris ${rowNum}: Jenis Pengadaan tidak valid`);
    }

    if (row['Metode Pemilihan'] && !validMetodePemilihan.includes(row['Metode Pemilihan'])) {
      errors.push(`Baris ${rowNum}: Metode Pemilihan tidak valid`);
    }

    if (row['Status PaDi'] && !validStatusPadi.includes(row['Status PaDi'])) {
      errors.push(`Baris ${rowNum}: Status PaDi harus "PaDi" atau "Non PaDi"`);
    }

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
      if (row[field]) {
        const value = parseFloat(row[field]);
        if (isNaN(value)) {
          errors.push(`Baris ${rowNum}: ${field} harus berupa angka`);
        } else if ((field === 'Nilai Komitmen' || field === 'Komitmen Keseluruhan') && value <= 0) {
          errors.push(`Baris ${rowNum}: ${field} harus lebih besar dari 0`);
        }
      }
    });

    const dateFields = ['Waktu Pemanfaatan Dari', 'Waktu Pemanfaatan Sampai'];  
      dateFields.forEach(field => {
        if (row[field]) {
          const originalValue = row[field];
          
          // Coba parse dulu
          const parsedDate = parseExcelDate(originalValue);
          
          // Jika hasil parse kosong atau invalid, beri error
          if (!parsedDate || parsedDate === '') {
            errors.push(`Baris ${rowNum}: ${field} format tidak valid. Gunakan DD/MM/YYYY (contoh: 02/02/2028)`);
            return;
          }
          
          // Validasi apakah hasil parse adalah tanggal yang valid
          const [year, month, day] = parsedDate.split('-').map(Number);
          const date = new Date(year, month - 1, day);
          
          if (
            date.getFullYear() !== year ||
            date.getMonth() !== month - 1 ||
            date.getDate() !== day
          ) {
            errors.push(`Baris ${rowNum}: ${field} tanggal tidak valid`);
          }
        }
      });

    if (row['Bulan Rencana']) {
      const bulanValue = parseInt(row['Bulan Rencana']);
      
      if (isNaN(bulanValue) || bulanValue < 1 || bulanValue > 12) {
        errors.push(`Baris ${rowNum}: Bulan Rencana harus angka 1-12 (1=Januari, 12=Desember)`);
      }
    }

    if (row['Status'] && !validStatus.includes(row['Status'])) {
      errors.push(`Baris ${rowNum}: Status harus "active" atau "inactive"`);
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
import { useState, useEffect } from 'react';
import { formatRupiahInput, parseRupiahInput } from '../utils/rupiahUtils';
import { toast } from 'react-toastify';

const INITIAL_FORM_DATA = {
  idPaketMonitoring: '',
  jenisPaket: 'Single Year (SY)',
  idRUP: '',
  namaAP: '',
  namaPaket: '',
  jenisAnggaran: 'Opex',
  jenisPengadaan: 'Barang',
  usulanMetodePemilihan: 'Tender/Seleksi Umum',
  statusPadi: 'Non PaDi',
  nilaiKomitmen: '',
  komitmenKeseluruhan: '',
  waktuPemanfaatanDari: '',
  waktuPemanfaatanSampai: '',
  nilaiTahunBerjalanPDN: '',
  nilaiKeseluruhanPDN: '',
  nilaiTahunBerjalanTKDN: '',
  nilaiKeseluruhanTKDN: '',
  nilaiTahunBerjalanImport: '',
  nilaiKeseluruhanImport: '',
  pdnCheckbox: false,
  tkdnCheckbox: false,
  importCheckbox: false,
  targetNilaiTKDN: '',
  nilaiAnggaranBelanja: '',
  nilaiKontrakKeseluruhan: '',
  namaPenyedia: '',
  kualifikasiPenyedia: 'UMKM',
  nilaiPDN: '',
  nilaiTKDN: '',
  nilaiImpor: '',
  namaPengadaanRealisasi: '',
  metodePemilihanRealisasi: '',
  progres: '',
  sisaPembayaran: '',
  catatanKomitmen: '',
  keterangan: '',
  status: 'active',
  approvalStatus: 'draft',
  approvedBy: '',
  approvedAt: null,
  approvalNote: '',
  isActive: true,
  idUser: '',
};

const EMPTY_REALISASI_ROW = () => ({
  id: Date.now(),
  tahunRealisasi: '',
  bulanRealisasi: '',
  realisasi: '',
  nomorInvoice: '',
  tanggalInvoice: '',
  dokumen: null,
});

const EMPTY_RENCANA_ROW = () => ({
  id: Date.now(),
  tahunRencana: '',
  nilaiRencana: '',
  bulanRencana: '',
  keterangan: '',
});

/**
 * Hook untuk mengelola state dan handler form Komitmen.
 * Digunakan bersama oleh AdminKomitmen dan PICKomitmen.
 * @param {Object} options
 * @param {string} [options.defaultNamaAP=''] - Nama AP default (untuk PIC)
 */
const useKomitmenForm = ({ defaultNamaAP = '' } = {}) => {
  const [formData, setFormData] = useState({
    ...INITIAL_FORM_DATA,
    namaAP: defaultNamaAP,
  });
  const [realisasiRows, setRealisasiRows] = useState([EMPTY_REALISASI_ROW()]);
  const [rencanaRows, setRencanaRows] = useState([EMPTY_RENCANA_ROW()]);
  const [isAddingNewRealisasi, setIsAddingNewRealisasi] = useState(false);

  const resetForm = (namaAP = defaultNamaAP) => {
    setFormData({ ...INITIAL_FORM_DATA, namaAP });
    setRealisasiRows([EMPTY_REALISASI_ROW()]);
    setRencanaRows([EMPTY_RENCANA_ROW()]);
    setIsAddingNewRealisasi(false);
  };

  // Sinkronisasi namaAP default ketika berubah dari luar (misal userAP baru di-load)
  useEffect(() => {
    if (defaultNamaAP) {
      setFormData(prev => ({ ...prev, namaAP: prev.namaAP || defaultNamaAP }));
    }
  }, [defaultNamaAP]);

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === 'pdnCheckbox' || name === 'tkdnCheckbox' || name === 'importCheckbox') {
      if (checked) {
        setFormData(prev => ({
          ...prev,
          pdnCheckbox: name === 'pdnCheckbox',
          tkdnCheckbox: name === 'tkdnCheckbox',
          importCheckbox: name === 'importCheckbox',
        }));
        const label = name === 'pdnCheckbox' ? 'PDN' : name === 'tkdnCheckbox' ? 'TKDN' : 'Import';
        toast.info(`${label} dipilih. Checkbox lain di-uncheck.`);
      } else {
        setFormData(prev => ({ ...prev, [name]: checked }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }));
    }
  };

  const handleRupiahChange = (e, fieldName) => {
    const formattedValue = formatRupiahInput(e.target.value);
    setFormData(prev => ({ ...prev, [fieldName]: formattedValue }));
  };

  // ── Realisasi rows handlers ──────────────────────────────────────────────
  const handleRealisasiChange = (index, field, value) => {
    const newRows = [...realisasiRows];
    newRows[index][field] = value;

    if (field === 'tanggalInvoice' && value) {
      const d = new Date(value);
      if (!isNaN(d)) {
        newRows[index].tahunRealisasi = d.getFullYear().toString();
        newRows[index].bulanRealisasi = (d.getMonth() + 1).toString();
      }
    }
    setRealisasiRows(newRows);
  };

  const handleRealisasiRupiahChange = (index, fieldName, value) => {
    const newRows = [...realisasiRows];
    newRows[index][fieldName] = formatRupiahInput(value);
    setRealisasiRows(newRows);
  };

  const addRealisasiRow = () => {
    setRealisasiRows(prev => [
      ...prev,
      { ...EMPTY_REALISASI_ROW(), id: Date.now() },
    ]);
    toast.info('Baris realisasi baru ditambahkan');
  };

  const removeRealisasiRow = (index) => {
    if (realisasiRows.length === 1) {
      toast.warning('Minimal harus ada 1 baris realisasi');
      return;
    }
    setRealisasiRows(prev => prev.filter((_, i) => i !== index));
    toast.info('Baris realisasi dihapus');
  };

  // ── Rencana rows handlers ────────────────────────────────────────────────
  const handleRencanaChange = (index, field, value) => {
    const newRows = [...rencanaRows];
    newRows[index][field] = value;
    setRencanaRows(newRows);
  };

  const handleRencanaRupiahChange = (index, value) => {
    const newRows = [...rencanaRows];
    newRows[index].nilaiRencana = formatRupiahInput(value);
    setRencanaRows(newRows);
  };

  const addRencanaRow = () => {
    setRencanaRows(prev => [
      ...prev,
      { ...EMPTY_RENCANA_ROW(), id: Date.now() },
    ]);
    toast.info('Baris rencana baru ditambahkan');
  };

  const removeRencanaRow = (index) => {
    if (rencanaRows.length === 1) {
      toast.warning('Minimal harus ada 1 baris rencana');
      return;
    }
    setRencanaRows(prev => prev.filter((_, i) => i !== index));
    toast.info('Baris rencana dihapus');
  };

  // ── Load existing komitmen into form (edit mode) ─────────────────────────
  const loadKomitmenToForm = (komitmen) => {
    setFormData({
      idPaketMonitoring: komitmen.idPaketMonitoring || '',
      jenisPaket: komitmen.jenisPaket || 'Single Year (SY)',
      idRUP: komitmen.idRUP || '',
      namaAP: komitmen.namaAP || '',
      namaPaket: komitmen.namaPaket || '',
      jenisAnggaran: komitmen.jenisAnggaran || 'Opex',
      jenisPengadaan: komitmen.jenisPengadaan || 'Barang',
      usulanMetodePemilihan: komitmen.usulanMetodePemilihan || 'Tender/Seleksi Umum',
      statusPadi: komitmen.statusPadi || 'Non PaDi',
      nilaiKomitmen: formatRupiahInput(komitmen.nilaiKomitmen?.toString() || ''),
      komitmenKeseluruhan: formatRupiahInput(komitmen.komitmenKeseluruhan?.toString() || ''),
      waktuPemanfaatanDari: komitmen.waktuPemanfaatanDari || '',
      waktuPemanfaatanSampai: komitmen.waktuPemanfaatanSampai || '',
      pdnCheckbox: komitmen.pdnCheckbox || false,
      tkdnCheckbox: komitmen.tkdnCheckbox || false,
      importCheckbox: komitmen.importCheckbox || false,
      targetNilaiTKDN: formatRupiahInput(komitmen.targetNilaiTKDN?.toString() || ''),
      nilaiAnggaranBelanja: formatRupiahInput(komitmen.nilaiAnggaranBelanja?.toString() || ''),
      nilaiKontrakKeseluruhan: formatRupiahInput(komitmen.nilaiKontrakKeseluruhan?.toString() || ''),
      namaPenyedia: komitmen.namaPenyedia || '',
      kualifikasiPenyedia: komitmen.kualifikasiPenyedia || 'UMKM',
      nilaiPDN: formatRupiahInput(komitmen.nilaiPDN?.toString() || ''),
      nilaiTKDN: formatRupiahInput(komitmen.nilaiTKDN?.toString() || ''),
      nilaiImpor: formatRupiahInput(komitmen.nilaiImpor?.toString() || ''),
      nilaiTahunBerjalanPDN: formatRupiahInput(komitmen.nilaiTahunBerjalanPDN?.toString() || '0'),
      nilaiKeseluruhanPDN: formatRupiahInput(komitmen.nilaiKeseluruhanPDN?.toString() || '0'),
      nilaiTahunBerjalanTKDN: formatRupiahInput(komitmen.nilaiTahunBerjalanTKDN?.toString() || '0'),
      nilaiKeseluruhanTKDN: formatRupiahInput(komitmen.nilaiKeseluruhanTKDN?.toString() || '0'),
      nilaiTahunBerjalanImport: formatRupiahInput(komitmen.nilaiTahunBerjalanImport?.toString() || '0'),
      nilaiKeseluruhanImport: formatRupiahInput(komitmen.nilaiKeseluruhanImport?.toString() || '0'),
      namaPengadaanRealisasi: komitmen.namaPengadaanRealisasi || '',
      metodePemilihanRealisasi: komitmen.metodePemilihanRealisasi || '',
      progres: komitmen.progres || '',
      sisaPembayaran: formatRupiahInput(komitmen.sisaPembayaran?.toString() || ''),
      catatanKomitmen: komitmen.catatanKomitmen || '',
      keterangan: komitmen.keterangan || '',
      status: komitmen.status || 'active',
      approvalStatus: komitmen.approvalStatus || 'draft',
      approvedBy: komitmen.approvedBy || '',
      approvedAt: komitmen.approvedAt || null,
      approvalNote: komitmen.approvalNote || '',
      isActive: komitmen.isActive !== undefined ? komitmen.isActive : true,
      idUser: komitmen.idUser || '',
    });

    if (komitmen.realisasiDetail && komitmen.realisasiDetail.length > 0) {
      setRealisasiRows(komitmen.realisasiDetail.map(detail => ({
        id: Date.now() + Math.random(),
        tahunRealisasi: detail.tahunRealisasi || '',
        bulanRealisasi: detail.bulanRealisasi || '',
        realisasi: formatRupiahInput(detail.realisasi?.toString() || ''),
        nomorInvoice: detail.nomorInvoice || '',
        tanggalInvoice: detail.tanggalInvoice || '',
        dokumen: detail.dokumen || null,
        namaPenyedia: detail.namaPenyedia || '',
      })));
    } else {
      setRealisasiRows([EMPTY_REALISASI_ROW()]);
    }

    if (komitmen.rencanaDetail && komitmen.rencanaDetail.length > 0) {
      setRencanaRows(komitmen.rencanaDetail.map(detail => ({
        id: Date.now() + Math.random(),
        tahunRencana: detail.tahunRencana || '',
        nilaiRencana: formatRupiahInput(detail.nilaiRencana?.toString() || ''),
        bulanRencana: detail.bulanRencana || '',
        keterangan: detail.keterangan || '',
      })));
    } else {
      setRencanaRows([EMPTY_RENCANA_ROW()]);
    }
  };

  const handleNewRealisasi = (formDataRef) => {
    setFormData(prev => ({
      ...prev,
      namaPenyedia: '',
      kualifikasiPenyedia: 'UMKM',
      nilaiPDN: '',
      nilaiTKDN: '',
      nilaiImpor: '',
      namaPengadaanRealisasi: '',
      metodePemilihanRealisasi: formDataRef.usulanMetodePemilihan,
      progres: '0',
      sisaPembayaran: formDataRef.jenisPaket === 'Multi Year (MY)'
        ? formDataRef.komitmenKeseluruhan
        : formDataRef.nilaiKomitmen,
      keterangan: '',
    }));
    setRealisasiRows([{ ...EMPTY_REALISASI_ROW(), id: Date.now() }]);
    setIsAddingNewRealisasi(true);
    toast.info('Mode: Tambah Realisasi Baru. Field realisasi telah di-reset.');
  };

  const handleCancelNewRealisasi = (selectedKomitmen) => {
    setIsAddingNewRealisasi(false);

    if (selectedKomitmen) {
      if (selectedKomitmen.realisasiDetail && selectedKomitmen.realisasiDetail.length > 0) {
        setRealisasiRows(selectedKomitmen.realisasiDetail.map(detail => ({
          id: Date.now() + Math.random(),
          tahunRealisasi: detail.tahunRealisasi || '',
          bulanRealisasi: detail.bulanRealisasi || '',
          realisasi: formatRupiahInput(detail.realisasi?.toString() || ''),
          nomorInvoice: detail.nomorInvoice || '',
          tanggalInvoice: detail.tanggalInvoice || '',
          dokumen: detail.dokumen || null,
        })));
      }

      setFormData(prev => ({
        ...prev,
        namaPenyedia: selectedKomitmen.namaPenyedia || '',
        kualifikasiPenyedia: selectedKomitmen.kualifikasiPenyedia || 'UMKM',
        nilaiPDN: formatRupiahInput(selectedKomitmen.nilaiPDN?.toString() || ''),
        nilaiTKDN: formatRupiahInput(selectedKomitmen.nilaiTKDN?.toString() || ''),
        nilaiImpor: formatRupiahInput(selectedKomitmen.nilaiImpor?.toString() || ''),
        namaPengadaanRealisasi: selectedKomitmen.namaPengadaanRealisasi || '',
        metodePemilihanRealisasi: selectedKomitmen.metodePemilihanRealisasi || '',
        progres: selectedKomitmen.progres || '',
        sisaPembayaran: formatRupiahInput(selectedKomitmen.sisaPembayaran?.toString() || ''),
        keterangan: selectedKomitmen.keterangan || '',
      }));
    }
    toast.info('Mode: Edit Realisasi Existing');
  };

  return {
    formData,
    setFormData,
    realisasiRows,
    setRealisasiRows,
    rencanaRows,
    setRencanaRows,
    isAddingNewRealisasi,
    setIsAddingNewRealisasi,
    resetForm,
    handleFormChange,
    handleRupiahChange,
    handleRealisasiChange,
    handleRealisasiRupiahChange,
    addRealisasiRow,
    removeRealisasiRow,
    handleRencanaChange,
    handleRencanaRupiahChange,
    addRencanaRow,
    removeRencanaRow,
    loadKomitmenToForm,
    handleNewRealisasi,
    handleCancelNewRealisasi,
  };
};

export default useKomitmenForm;

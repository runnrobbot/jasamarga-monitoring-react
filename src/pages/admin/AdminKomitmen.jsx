import { useState, useEffect, useRef } from 'react';
import {
  Container, Card, Button, Table, Modal, Form, Badge, Spinner,
  InputGroup, Alert, Row, Col
} from 'react-bootstrap';
import {
  collection, getDocs, query, orderBy, deleteDoc, doc,
  writeBatch, addDoc, updateDoc, where, onSnapshot,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import NavigationBar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import {
  FaEye, FaTrash, FaFileExport, FaFileImport, FaSearch,
  FaDownload, FaPlus, FaEdit, FaCheckCircle, FaTimesCircle, FaUndo
} from 'react-icons/fa';
import { toast, ToastContainer, Slide } from 'react-toastify';
import * as XLSX from 'xlsx';
import 'react-toastify/dist/ReactToastify.css';
import { addNotification } from '../../utils/notificationService';
import { generateIdPaket, parseExcelBoolean, parseExcelDate } from '../../utils/idGenerator';
import { parseRupiahInput, formatRupiahInput, formatCurrency } from '../../utils/rupiahUtils';
import ImportWizardModal from '../../components/ImportWizardModal';
import KomitmenFormModal from '../../components/komitmen/KomitmenFormModal';
import KomitmenDetailModal from '../../components/komitmen/KomitmenDetailModal';
import useKomitmenForm from '../../hooks/useKomitmenForm';

const AdminKomitmen = () => {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [komitmenList, setKomitmenList] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [masterAPList, setMasterAPList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedKomitmen, setSelectedKomitmen] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterApprovalStatus, setFilterApprovalStatus] = useState('all');
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardItems, setWizardItems] = useState([]);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedApprovalItem, setSelectedApprovalItem] = useState(null);
  const [approvalAction, setApprovalAction] = useState('approve');
  const [approvalNote, setApprovalNote] = useState('');
  const [showApproveRevisiModal, setShowApproveRevisiModal] = useState(false);
  const [selectedRevisiItem, setSelectedRevisiItem] = useState(null);
  const [approveRevisiNote, setApproveRevisiNote] = useState('');
  const [submittingRevisi, setSubmittingRevisi] = useState(false);

  const {
    formData, setFormData,
    realisasiRows, setRealisasiRows,
    rencanaRows, setRencanaRows,
    isAddingNewRealisasi, setIsAddingNewRealisasi,
    resetForm,
    handleFormChange, handleRupiahChange,
    handleRealisasiChange, handleRealisasiRupiahChange,
    addRealisasiRow, removeRealisasiRow,
    handleRencanaChange, handleRencanaRupiahChange,
    addRencanaRow, removeRencanaRow,
    loadKomitmenToForm,
  } = useKomitmenForm();

  useEffect(() => {
    fetchMasterAP();
    const unsubscribe = fetchKomitmen();
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  useEffect(() => { filterData(); }, [searchTerm, filterApprovalStatus, komitmenList]);

  useEffect(() => {
    if (editMode || realisasiRows.some(row => parseRupiahInput(row.realisasi) > 0)) {
      const totalRealisasi = realisasiRows.reduce((sum, row) => sum + parseRupiahInput(row.realisasi), 0);
      if (formData.pdnCheckbox && totalRealisasi > 0) {
        setFormData(prev => ({ ...prev, nilaiPDN: formatRupiahInput(totalRealisasi.toString()), nilaiTKDN: '0', nilaiImpor: '0' }));
      } else if (formData.tkdnCheckbox && totalRealisasi > 0) {
        setFormData(prev => ({ ...prev, nilaiPDN: '0', nilaiTKDN: formatRupiahInput(totalRealisasi.toString()), nilaiImpor: '0' }));
      } else if (formData.importCheckbox && totalRealisasi > 0) {
        setFormData(prev => ({ ...prev, nilaiPDN: '0', nilaiTKDN: '0', nilaiImpor: formatRupiahInput(totalRealisasi.toString()) }));
      }
    }
  }, [realisasiRows, formData.pdnCheckbox, formData.tkdnCheckbox, formData.importCheckbox, editMode]);

  const fetchMasterAP = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'masterAP'));
      setMasterAPList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(ap => ap.isActive));
    } catch { toast.error('Gagal memuat Master AP'); }
  };

  const fetchKomitmen = () => {
    setLoading(true);
    const q = query(collection(db, 'komitmen'), orderBy('createdAt', 'desc'));
    return onSnapshot(q,
      (snapshot) => {
        setKomitmenList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (error) => { console.error(error); toast.error('Gagal memuat data komitmen'); setLoading(false); }
    );
  };

  const filterData = () => {
    let filtered = [...komitmenList];
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.namaPaket?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.namaAP?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.idPaketMonitoring?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filterApprovalStatus !== 'all') {
      if (filterApprovalStatus === 'selesai') {
        filtered = filtered.filter(item => item.status === 'selesai');
      } else {
        filtered = filtered.filter(item => item.approvalStatus === filterApprovalStatus);
      }
    }
    setFilteredList(filtered);
  };

  const handleCloseFormModal = () => {
    setShowFormModal(false);
    setEditMode(false);
    setSelectedKomitmen(null);
    setIsAddingNewRealisasi(false);
    resetForm();
  };

  const handleEdit = (komitmen) => {
    loadKomitmenToForm(komitmen);
    setSelectedKomitmen(komitmen);
    setEditMode(true);
    setShowFormModal(true);
  };

  const handleNewRealisasi = () => {
    setFormData(prev => ({
      ...prev,
      namaPenyedia: '', kualifikasiPenyedia: 'UMKM',
      nilaiPDN: '', nilaiTKDN: '', nilaiImpor: '',
      namaPengadaanRealisasi: '',
      metodePemilihanRealisasi: formData.usulanMetodePemilihan,
      progres: '0',
      sisaPembayaran: formData.jenisPaket === 'Multi Year (MY)' ? formData.komitmenKeseluruhan : formData.nilaiKomitmen,
      keterangan: '',
    }));
    setRealisasiRows([{ id: Date.now(), tahunRealisasi: '', bulanRealisasi: '', realisasi: '', nomorInvoice: '', tanggalInvoice: '', dokumen: null }]);
    setIsAddingNewRealisasi(true);
    toast.info('Mode: Tambah Realisasi Baru. Field realisasi telah di-reset.');
  };

  const handleCancelNewRealisasi = () => {
    setIsAddingNewRealisasi(false);
    if (selectedKomitmen) {
      if (selectedKomitmen.realisasiDetail?.length > 0) {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const checkboxCount = [formData.pdnCheckbox, formData.tkdnCheckbox, formData.importCheckbox].filter(Boolean).length;
      if (checkboxCount > 1) { toast.error('Hanya boleh memilih 1 checkbox (PDN, TKDN, atau Import)'); setLoading(false); return; }
      if (!formData.namaPaket || !formData.namaAP) { toast.error('Mohon lengkapi field wajib: Nama Paket dan Nama AP'); setLoading(false); return; }
      const totalRencana = rencanaRows.reduce((sum, row) => sum + parseRupiahInput(row.nilaiRencana), 0);
      const refKomitmen = parseRupiahInput(formData.komitmenKeseluruhan) > 0 ? parseRupiahInput(formData.komitmenKeseluruhan) : parseRupiahInput(formData.nilaiKomitmen);
      if (totalRencana > refKomitmen && refKomitmen > 0) { toast.error(`Total Rencana melebihi Komitmen sebesar ${formatCurrency(totalRencana - refKomitmen)}. Kurangi nilai rencana.`, { autoClose: 8000 }); setLoading(false); return; }
      if (formData.pdnCheckbox && (!formData.nilaiTahunBerjalanPDN || !formData.nilaiKeseluruhanPDN)) { toast.error('Nilai Tahun Berjalan PDN dan Nilai Keseluruhan PDN wajib diisi'); setLoading(false); return; }
      if (formData.tkdnCheckbox && (!formData.nilaiTahunBerjalanTKDN || !formData.nilaiKeseluruhanTKDN)) { toast.error('Nilai Tahun Berjalan TKDN dan Nilai Keseluruhan TKDN wajib diisi'); setLoading(false); return; }
      if (formData.importCheckbox && (!formData.nilaiTahunBerjalanImport || !formData.nilaiKeseluruhanImport)) { toast.error('Nilai Tahun Berjalan Import dan Nilai Keseluruhan Import wajib diisi'); setLoading(false); return; }
      const hasRealisasiData = realisasiRows.some(row => row.realisasi && parseRupiahInput(row.realisasi) > 0);
      if (hasRealisasiData) {
        for (let i = 0; i < realisasiRows.length; i++) {
          const row = realisasiRows[i];
          if (row.realisasi && parseRupiahInput(row.realisasi) > 0 && (!row.bulanRealisasi || !row.nomorInvoice)) {
            toast.error(`Baris realisasi ${i + 1}: Bulan dan Nomor Invoice wajib diisi`); setLoading(false); return;
          }
        }
        if (!editMode && !formData.namaPenyedia) { toast.error('Nama Penyedia wajib diisi di Tab Realisasi'); setLoading(false); return; }
        if (!editMode && !formData.nilaiKontrakKeseluruhan) { toast.error('Nilai Kontrak Keseluruhan wajib diisi di Tab Realisasi'); setLoading(false); return; }
      }
      const selectedAP = masterAPList.find(ap => ap.namaAP === formData.namaAP);
      if (!selectedAP) { toast.error('AP tidak ditemukan di Master Data'); setLoading(false); return; }
      let idPaket = formData.idPaketMonitoring;
      if (!editMode || !idPaket) idPaket = await generateIdPaket(formData.jenisPaket, selectedAP.singkatanAP);
      const totalRealisasi = realisasiRows.reduce((sum, row) => sum + parseRupiahInput(row.realisasi), 0);
      const dataToSave = {
        idPaketMonitoring: idPaket, jenisPaket: formData.jenisPaket, idRUP: formData.idRUP,
        namaAP: formData.namaAP, namaPaket: formData.namaPaket, jenisAnggaran: formData.jenisAnggaran,
        jenisPengadaan: formData.jenisPengadaan, usulanMetodePemilihan: formData.usulanMetodePemilihan,
        statusPadi: formData.statusPadi, nilaiKomitmen: parseRupiahInput(formData.nilaiKomitmen),
        komitmenKeseluruhan: parseRupiahInput(formData.komitmenKeseluruhan),
        waktuPemanfaatanDari: formData.waktuPemanfaatanDari, waktuPemanfaatanSampai: formData.waktuPemanfaatanSampai,
        rencanaDetail: rencanaRows.map(row => ({ tahunRencana: row.tahunRencana || '', nilaiRencana: parseRupiahInput(row.nilaiRencana), bulanRencana: row.bulanRencana, keterangan: row.keterangan })),
        pdnCheckbox: formData.pdnCheckbox, tkdnCheckbox: formData.tkdnCheckbox, importCheckbox: formData.importCheckbox,
        targetNilaiTKDN: parseRupiahInput(formData.targetNilaiTKDN), nilaiAnggaranBelanja: parseRupiahInput(formData.nilaiAnggaranBelanja),
        realisasi: totalRealisasi,
        realisasiDetail: realisasiRows.map(row => ({ tahunRealisasi: row.tahunRealisasi, bulanRealisasi: row.bulanRealisasi, realisasi: parseRupiahInput(row.realisasi), nomorInvoice: row.nomorInvoice, tanggalInvoice: row.tanggalInvoice, dokumen: row.dokumen, namaPenyedia: row.namaPenyedia || formData.namaPenyedia })),
        nilaiKontrakKeseluruhan: parseRupiahInput(formData.nilaiKontrakKeseluruhan),
        namaPenyedia: formData.namaPenyedia, kualifikasiPenyedia: formData.kualifikasiPenyedia,
        nilaiPDN: parseRupiahInput(formData.nilaiPDN), nilaiTKDN: parseRupiahInput(formData.nilaiTKDN), nilaiImpor: parseRupiahInput(formData.nilaiImpor),
        nilaiTahunBerjalanPDN: parseRupiahInput(formData.nilaiTahunBerjalanPDN), nilaiKeseluruhanPDN: parseRupiahInput(formData.nilaiKeseluruhanPDN),
        nilaiTahunBerjalanTKDN: parseRupiahInput(formData.nilaiTahunBerjalanTKDN), nilaiKeseluruhanTKDN: parseRupiahInput(formData.nilaiKeseluruhanTKDN),
        nilaiTahunBerjalanImport: parseRupiahInput(formData.nilaiTahunBerjalanImport), nilaiKeseluruhanImport: parseRupiahInput(formData.nilaiKeseluruhanImport),
        namaPengadaanRealisasi: formData.namaPengadaanRealisasi, metodePemilihanRealisasi: formData.metodePemilihanRealisasi,
        progres: formData.progres, sisaPembayaran: parseRupiahInput(formData.sisaPembayaran),
        catatanKomitmen: formData.catatanKomitmen, keterangan: formData.keterangan,
        status: formData.status, isActive: formData.isActive, idUser: user?.uid || '',
        updatedAt: new Date(), updatedBy: user?.email || user?.displayName || ''
      };
      if (!editMode) { dataToSave.createdAt = new Date(); dataToSave.createdBy = user?.email || user?.displayName || ''; }
      Object.keys(dataToSave).forEach(key => { if (dataToSave[key] === undefined) delete dataToSave[key]; });
      if (editMode && selectedKomitmen?.id) {
        if (isAddingNewRealisasi) {
          const existingRealisasi = selectedKomitmen.realisasiDetail || [];
          const newRealisasiDetail = [
            ...existingRealisasi.map(row => ({ ...row, namaPenyedia: row.namaPenyedia || selectedKomitmen.namaPenyedia || '' })),
            ...realisasiRows.map(row => ({ tahunRealisasi: row.tahunRealisasi, bulanRealisasi: row.bulanRealisasi, realisasi: parseRupiahInput(row.realisasi), nomorInvoice: row.nomorInvoice, tanggalInvoice: row.tanggalInvoice, dokumen: row.dokumen ? row.dokumen.name : null, namaPengadaanRealisasi: formData.namaPengadaanRealisasi, metodePemilihanRealisasi: formData.metodePemilihanRealisasi, kualifikasiPenyedia: formData.kualifikasiPenyedia, namaPenyedia: formData.namaPenyedia }))
          ];
          const totalRealisasiBaru = newRealisasiDetail.reduce((sum, d) => sum + (d.realisasi || 0), 0);
          const isMY = formData.jenisPaket === 'Multi Year (MY)';
          const nilaiKontrakValue = parseRupiahInput(formData.nilaiKontrakKeseluruhan);
          const nilaiReferensi = isMY ? (nilaiKontrakValue > 0 ? nilaiKontrakValue : parseRupiahInput(formData.komitmenKeseluruhan)) : (nilaiKontrakValue > 0 ? nilaiKontrakValue : parseRupiahInput(formData.nilaiKomitmen));
          const progressBaru = nilaiReferensi > 0 ? ((totalRealisasiBaru / nilaiReferensi) * 100).toFixed(2) : '0';
          const updateData = {
            realisasiDetail: newRealisasiDetail, realisasi: totalRealisasiBaru,
            progres: Math.min(parseFloat(progressBaru), 100).toString(), sisaPembayaran: nilaiReferensi - totalRealisasiBaru,
            nilaiKontrakKeseluruhan: parseRupiahInput(formData.nilaiKontrakKeseluruhan),
            nilaiPDN: parseRupiahInput(formData.nilaiPDN), nilaiTKDN: parseRupiahInput(formData.nilaiTKDN), nilaiImpor: parseRupiahInput(formData.nilaiImpor),
            keterangan: formData.keterangan, updatedAt: new Date(), updatedBy: user?.email || '',
            needRealisasi: false, namaPenyedia: formData.namaPenyedia, kualifikasiPenyedia: formData.kualifikasiPenyedia,
            namaPengadaanRealisasi: formData.namaPengadaanRealisasi, metodePemilihanRealisasi: formData.metodePemilihanRealisasi
          };
          Object.keys(updateData).forEach(key => { if (updateData[key] === undefined) delete updateData[key]; });
          await updateDoc(doc(db, 'komitmen', selectedKomitmen.id), updateData);
          toast.success('Realisasi baru berhasil ditambahkan!');
          setIsAddingNewRealisasi(false);
          setKomitmenList(prev => prev.map(k => k.id === selectedKomitmen.id ? { ...k, ...updateData } : k));
        } else {
          if (selectedKomitmen?.needRealisasi) dataToSave.needRealisasi = false;
          await updateDoc(doc(db, 'komitmen', selectedKomitmen.id), dataToSave);
          toast.success('Data berhasil diupdate');
          setKomitmenList(prev => prev.map(k => k.id === selectedKomitmen.id ? { ...k, ...dataToSave } : k));
        }
        try { await addNotification(user?.uid || '', 'info', 'Komitmen Diupdate', `Komitmen "${formData.namaPaket}" telah diupdate`, { komitmenId: selectedKomitmen.id, action: 'update' }); } catch { }
      } else {
        const docRef = await addDoc(collection(db, 'komitmen'), dataToSave);
        toast.success('Data berhasil disimpan');
        setKomitmenList(prev => [{ id: docRef.id, ...dataToSave }, ...prev]);
        try { await addNotification(user?.uid || '', 'success', 'Komitmen Baru', `Komitmen "${formData.namaPaket}" telah ditambahkan`, { action: 'create' }); } catch { }
      }
      handleCloseFormModal();
    } catch (error) { toast.error('Terjadi kesalahan saat menyimpan data: ' + error.message); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus data ini?')) return;
    try {
      await deleteDoc(doc(db, 'komitmen', id));
      toast.success('Data berhasil dihapus');
      setKomitmenList(prev => prev.filter(k => k.id !== id));
      await addNotification(user?.uid || '', 'warning', 'Komitmen Dihapus', 'Data komitmen telah dihapus', { komitmenId: id, action: 'delete' });
    } catch { toast.error('Gagal menghapus data'); }
  };

  const handleExport = () => {
    const dataToExport = filteredList.map(item => ({
      'ID Paket': item.idPaketMonitoring, 'Jenis Paket': item.jenisPaket, 'ID RUP': item.idRUP || '',
      'Nama AP': item.namaAP, 'Nama Paket': item.namaPaket, 'Jenis Anggaran': item.jenisAnggaran,
      'Jenis Pengadaan': item.jenisPengadaan, 'Metode Pemilihan': item.usulanMetodePemilihan,
      'Status PaDi': item.statusPadi, 'Nilai Komitmen': item.nilaiKomitmen, 'Komitmen Keseluruhan': item.komitmenKeseluruhan,
      'Waktu Pemanfaatan Dari': item.waktuPemanfaatanDari, 'Waktu Pemanfaatan Sampai': item.waktuPemanfaatanSampai,
      'Tahun Rencana': item.rencanaDetail?.[0]?.tahunRencana || '', 'Nilai Rencana': item.rencanaDetail?.[0]?.nilaiRencana || '',
      'Bulan Rencana': item.rencanaDetail?.[0]?.bulanRencana || '', 'Keterangan Rencana': item.rencanaDetail?.[0]?.keterangan || '',
      'PDN': item.pdnCheckbox ? 'TRUE' : 'FALSE', 'TKDN': item.tkdnCheckbox ? 'TRUE' : 'FALSE', 'Import': item.importCheckbox ? 'TRUE' : 'FALSE',
      'Nilai Tahun Berjalan PDN': item.nilaiTahunBerjalanPDN || 0, 'Nilai Keseluruhan PDN': item.nilaiKeseluruhanPDN || 0,
      'Nilai Tahun Berjalan TKDN': item.nilaiTahunBerjalanTKDN || 0, 'Nilai Keseluruhan TKDN': item.nilaiKeseluruhanTKDN || 0,
      'Nilai Tahun Berjalan Import': item.nilaiTahunBerjalanImport || 0, 'Nilai Keseluruhan Import': item.nilaiKeseluruhanImport || 0,
      'Target Nilai TKDN': item.targetNilaiTKDN || 0, 'Nilai Anggaran Belanja': item.nilaiAnggaranBelanja || 0,
      'Catatan Komitmen': item.catatanKomitmen || '', 'Realisasi': item.realisasi,
      'Nilai Kontrak': item.nilaiKontrakKeseluruhan || 0, 'Nama Penyedia': item.namaPenyedia, 'Status': item.status
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Komitmen');
    XLSX.writeFile(wb, `Export_Komitmen_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Data berhasil diexport');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const errors = [];
        data.forEach((item, i) => {
          const rowNum = i + 2;
          if (!item['Nama Paket']?.toString().trim()) errors.push(`Baris ${rowNum}: Nama Paket wajib diisi`);
          if (!item['Nama AP']?.toString().trim()) errors.push(`Baris ${rowNum}: Nama AP wajib diisi`);
          const parseCheckbox = (v) => typeof v === 'boolean' ? v : typeof v === 'string' ? ['TRUE','YA','YES','1'].includes(v.trim().toUpperCase()) : v === 1;
          const count = [parseCheckbox(item['PDN']), parseCheckbox(item['TKDN']), parseCheckbox(item['Import'])].filter(Boolean).length;
          if (count > 1) errors.push(`Baris ${rowNum}: Hanya boleh memilih 1 checkbox`);
        });
        setImportErrors(errors); setImportPreview(data); setShowImportModal(true);
      } catch { toast.error('Gagal membaca file Excel'); }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleImportConfirm = async () => {
    try {
      const duplicates = [];
      for (const item of importPreview) {
        const snap = await getDocs(query(collection(db, 'komitmen'), where('namaPaket', '==', item['Nama Paket'])));
        if (!snap.empty) duplicates.push(item['Nama Paket']);
      }
      if (duplicates.length > 0) { toast.error(`Import dibatalkan! Ditemukan ${duplicates.length} duplikasi`, { autoClose: 15000 }); return; }
      setImporting(true);
      const validMetode = ['Tender/Seleksi Umum','Tender/Seleksi Terbatas','Penunjukan Langsung','Pengadaan Langsung','Penetapan Langsung'];
      const dataReadyToImport = [];
      for (const item of importPreview) {
        const selectedAP = masterAPList.find(ap => ap.namaAP === item['Nama AP']);
        if (!selectedAP) continue;
        const resolvedJenisPaket = ['Single Year (SY)','Multi Year (MY)'].includes(item['Jenis Paket']) ? item['Jenis Paket'] : 'Single Year (SY)';
        let idPaket = item['ID Paket Monitoring'];
        if (!idPaket?.trim()) idPaket = await generateIdPaket(resolvedJenisPaket, selectedAP.singkatanAP);
        dataReadyToImport.push({
          idPaketMonitoring: idPaket, jenisPaket: resolvedJenisPaket, idRUP: item['ID RUP'] || '',
          namaAP: item['Nama AP'], namaPaket: item['Nama Paket'],
          jenisAnggaran: ['Opex','Capex'].includes(item['Jenis Anggaran']) ? item['Jenis Anggaran'] : 'Opex',
          jenisPengadaan: ['Barang','Jasa Konsultansi','Jasa Lainnya','Pekerjaan Konstruksi'].includes(item['Jenis Pengadaan']) ? item['Jenis Pengadaan'] : 'Barang',
          usulanMetodePemilihan: validMetode.includes(item['Metode Pemilihan']) ? item['Metode Pemilihan'] : 'Tender/Seleksi Umum',
          statusPadi: item['Status PaDi'] || 'Non PaDi',
          nilaiKomitmen: parseFloat(item['Nilai Komitmen']) || 0, komitmenKeseluruhan: parseFloat(item['Komitmen Keseluruhan']) || 0,
          waktuPemanfaatanDari: parseExcelDate(item['Waktu Pemanfaatan Dari']) || '',
          waktuPemanfaatanSampai: parseExcelDate(item['Waktu Pemanfaatan Sampai']) || '',
          rencanaDetail: item['Nilai Rencana'] && parseFloat(item['Nilai Rencana']) > 0 ? [{ tahunRencana: item['Tahun Rencana'] || '', nilaiRencana: parseFloat(item['Nilai Rencana']) || 0, bulanRencana: item['Bulan Rencana'] || '', keterangan: item['Keterangan Rencana'] || '' }] : [],
          pdnCheckbox: parseExcelBoolean(item['PDN']), tkdnCheckbox: parseExcelBoolean(item['TKDN']), importCheckbox: parseExcelBoolean(item['Import']),
          nilaiTahunBerjalanPDN: parseFloat(item['Nilai Tahun Berjalan PDN']) || 0, nilaiKeseluruhanPDN: parseFloat(item['Nilai Keseluruhan PDN']) || 0,
          nilaiTahunBerjalanTKDN: parseFloat(item['Nilai Tahun Berjalan TKDN']) || 0, nilaiKeseluruhanTKDN: parseFloat(item['Nilai Keseluruhan TKDN']) || 0,
          nilaiTahunBerjalanImport: parseFloat(item['Nilai Tahun Berjalan Import']) || 0, nilaiKeseluruhanImport: parseFloat(item['Nilai Keseluruhan Import']) || 0,
          targetNilaiTKDN: parseFloat(item['Target Nilai TKDN']) || 0, nilaiAnggaranBelanja: parseFloat(item['Nilai Anggaran Belanja']) || 0,
          realisasi: 0, realisasiDetail: [], nilaiKontrakKeseluruhan: 0,
          namaPenyedia: '', kualifikasiPenyedia: 'UMKM', nilaiPDN: 0, nilaiTKDN: 0, nilaiImpor: 0,
          namaPengadaanRealisasi: '', metodePemilihanRealisasi: validMetode.includes(item['Metode Pemilihan']) ? item['Metode Pemilihan'] : '',
          progres: '0', sisaPembayaran: parseFloat(item['Nilai Komitmen']) || 0,
          catatanKomitmen: item['Catatan Komitmen'] || '', keterangan: '',
          approvalStatus: 'draft', status: item['Status'] || 'active', isActive: item['Status'] !== 'inactive',
          idUser: user?.uid || '', createdAt: new Date(), createdBy: user?.email || 'Import',
          updatedAt: new Date(), updatedBy: user?.email || 'Import', needRealisasi: true
        });
      }
      const batch = writeBatch(db);
      const savedIds = [];
      for (const dataItem of dataReadyToImport) {
        const docRef = doc(collection(db, 'komitmen'));
        batch.set(docRef, dataItem);
        savedIds.push({ id: docRef.id, ...dataItem });
      }
      await batch.commit();
      setShowImportModal(false); setImportPreview([]); setImportErrors([]);
      try { await addNotification(user?.uid || '', 'success', 'Import Data', `Berhasil import ${dataReadyToImport.length} data komitmen.`, { action: 'import', count: dataReadyToImport.length }); } catch { }
      setWizardItems(savedIds); setShowWizard(true);
    } catch (error) { toast.error('Gagal import data'); }
    finally { setImporting(false); }
  };

  const handleOpenApproval = (item, action) => { setSelectedApprovalItem(item); setApprovalAction(action); setApprovalNote(''); setShowApprovalModal(true); };

  const handleApprove = async () => {
    if (!selectedApprovalItem) return;
    setLoading(true);
    try {
      const approveData = { approvalStatus: 'approved', approvedBy: user?.email || 'Admin', approvedAt: new Date(), approvalNote: approvalNote || 'Disetujui oleh admin', status: 'active', updatedAt: new Date(), updatedBy: user?.email || '' };
      await updateDoc(doc(db, 'komitmen', selectedApprovalItem.id), approveData);
      toast.dismiss(); await new Promise(r => setTimeout(r, 100));
      toast.success(`Komitmen ${selectedApprovalItem.idPaketMonitoring} berhasil disetujui!`);
      try { await addNotification(selectedApprovalItem.idUser, 'success', 'Komitmen Disetujui', `Komitmen "${selectedApprovalItem.namaPaket}" telah disetujui`, { komitmenId: selectedApprovalItem.id, action: 'approved' }); } catch { }
      setShowApprovalModal(false); setSelectedApprovalItem(null); setApprovalNote('');
      setKomitmenList(prev => prev.map(k => k.id === selectedApprovalItem.id ? { ...k, ...approveData } : k));
    } catch (error) { toast.error('Gagal menyetujui komitmen: ' + error.message); }
    finally { setLoading(false); }
  };

  const handleReject = async () => {
    if (!selectedApprovalItem) return;
    if (!approvalNote?.trim()) { toast.error('Alasan penolakan wajib diisi'); return; }
    setLoading(true);
    try {
      const rejectData = { approvalStatus: 'rejected', approvedBy: user?.email || 'Admin', approvedAt: new Date(), approvalNote, rejectedBy: user?.email || 'Admin', rejectedAt: new Date(), updatedAt: new Date(), updatedBy: user?.email || '' };
      await updateDoc(doc(db, 'komitmen', selectedApprovalItem.id), rejectData);
      toast.dismiss(); await new Promise(r => setTimeout(r, 100));
      toast.success(`Komitmen ${selectedApprovalItem.idPaketMonitoring} ditolak.`);
      try { await addNotification(selectedApprovalItem.idUser, 'warning', 'Komitmen Ditolak', `Komitmen "${selectedApprovalItem.namaPaket}" ditolak.`, { komitmenId: selectedApprovalItem.id, action: 'rejected', reason: approvalNote }); } catch { }
      setShowApprovalModal(false); setSelectedApprovalItem(null); setApprovalNote('');
      setKomitmenList(prev => prev.map(k => k.id === selectedApprovalItem.id ? { ...k, ...rejectData } : k));
    } catch (error) { toast.error('Gagal menolak komitmen: ' + error.message); }
    finally { setLoading(false); }
  };

  const handleMarkAsCompleted = async (item) => {
    if (!window.confirm(`Apakah Anda yakin ingin menandai paket "${item.namaPaket}" sebagai SELESAI?`)) return;
    try {
      setLoading(true);
      const completedData = { status: 'selesai', completedBy: user.email, completedAt: new Date(), updatedAt: new Date(), updatedBy: user?.email || '' };
      await updateDoc(doc(db, 'komitmen', item.id), completedData);
      if (item.idUser) await addNotification(item.idUser, 'success', 'Komitmen Selesai', `Paket "${item.namaPaket}" telah ditandai sebagai SELESAI.`, { komitmenId: item.id, action: 'completed' });
      toast.success('Komitmen berhasil ditandai sebagai SELESAI');
      setKomitmenList(prev => prev.map(k => k.id === item.id ? { ...k, ...completedData } : k));
    } catch { toast.error('Gagal menandai komitmen sebagai selesai'); }
    finally { setLoading(false); }
  };

  const handleOpenApproveRevisi = (item) => { setSelectedRevisiItem(item); setApproveRevisiNote(''); setShowApproveRevisiModal(true); };

  const handleApproveRevisi = async () => {
    if (!selectedRevisiItem) return;
    setSubmittingRevisi(true);
    try {
      const updateData = { approvalStatus: 'rejected', approvalNote: approveRevisiNote.trim() || `Revisi disetujui.`, rejectedBy: user?.email || 'Admin', rejectedAt: new Date(), revisiApprovedBy: user?.email || 'Admin', revisiApprovedAt: new Date(), updatedAt: new Date(), updatedBy: user?.email || '' };
      await updateDoc(doc(db, 'komitmen', selectedRevisiItem.id), updateData);
      toast.success(`Request revisi disetujui. PIC dapat mengedit komitmen "${selectedRevisiItem.namaPaket}".`);
      try { await addNotification(selectedRevisiItem.idUser, 'warning', 'Request Revisi Disetujui', `Request revisi untuk komitmen "${selectedRevisiItem.namaPaket}" disetujui.`, { komitmenId: selectedRevisiItem.id, action: 'revision_approved' }); } catch { }
      setKomitmenList(prev => prev.map(k => k.id === selectedRevisiItem.id ? { ...k, ...updateData } : k));
      setShowApproveRevisiModal(false); setSelectedRevisiItem(null);
    } catch { toast.error('Gagal memproses request revisi'); }
    finally { setSubmittingRevisi(false); }
  };

  const handleRejectRevisi = async () => {
    if (!selectedRevisiItem) return;
    if (!approveRevisiNote.trim()) { toast.error('Alasan penolakan revisi wajib diisi'); return; }
    setSubmittingRevisi(true);
    try {
      const updateData = { approvalStatus: 'approved', revisiRejectedNote: approveRevisiNote.trim(), revisiRejectedBy: user?.email || 'Admin', revisiRejectedAt: new Date(), revisiNote: '', updatedAt: new Date(), updatedBy: user?.email || '' };
      await updateDoc(doc(db, 'komitmen', selectedRevisiItem.id), updateData);
      toast.success('Request revisi ditolak. Status komitmen kembali ke Approved.');
      try { await addNotification(selectedRevisiItem.idUser, 'info', 'Request Revisi Ditolak', `Request revisi untuk komitmen "${selectedRevisiItem.namaPaket}" ditolak.`, { komitmenId: selectedRevisiItem.id, action: 'revision_rejected', reason: approveRevisiNote.trim() }); } catch { }
      setKomitmenList(prev => prev.map(k => k.id === selectedRevisiItem.id ? { ...k, ...updateData } : k));
      setShowApproveRevisiModal(false); setSelectedRevisiItem(null);
    } catch { toast.error('Gagal menolak request revisi'); }
    finally { setSubmittingRevisi(false); }
  };

  const renderApprovalBadge = (item) => {
    if (item.status === 'selesai') return <Badge bg="dark">Selesai</Badge>;
    switch (item.approvalStatus) {
      case 'approved': return <Badge bg="success">Approved</Badge>;
      case 'rejected': return <Badge bg="danger">Rejected</Badge>;
      case 'revision_requested': return <Badge bg="warning" className="text-dark">Request Revisi</Badge>;
      default: return <Badge bg="secondary">Pending</Badge>;
    }
  };

  return (
    <>
      <NavigationBar />
      <div className="d-flex">
        <Sidebar />
        <Container fluid style={{ marginLeft: '250px', paddingTop: '100px', paddingLeft: '1.5rem', paddingRight: '1.5rem', paddingBottom: '1.5rem', minHeight: '100vh' }}>
          <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover limit={3} transition={Slide} />
          <Card className="shadow-sm mb-4">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h2 className="fw-bold mb-1">Manajemen Komitmen</h2>
                  <p className="text-muted mb-0">Kelola semua data komitmen dan realisasi</p>
                </div>
                <div className="d-flex gap-2">
                  <Button variant="success" size="sm" onClick={() => setShowFormModal(true)}><FaPlus className="me-1" /> Tambah Komitmen</Button>
                  <Button variant="primary" size="sm" onClick={handleExport}><FaFileExport className="me-1" /> Export Excel</Button>
                  <Button variant="info" size="sm" onClick={() => { const link = document.createElement('a'); link.href = '/templates/Template_Import_Komitmen_Awal.xlsx'; link.download = 'Template_Import_Komitmen_Awal.xlsx'; document.body.appendChild(link); link.click(); document.body.removeChild(link); toast.success('Template berhasil didownload!'); }}><FaDownload className="me-1" /> Download Template</Button>
                  <Button variant="warning" size="sm" onClick={() => fileInputRef.current?.click()}><FaFileImport className="me-1" /> Import Excel</Button>
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} style={{ display: 'none' }} />
                </div>
              </div>
              <Row className="mb-3">
                <Col md={6}>
                  <InputGroup>
                    <InputGroup.Text><FaSearch /></InputGroup.Text>
                    <Form.Control placeholder="Cari berdasarkan Nama Paket, AP, atau ID Paket..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </InputGroup>
                </Col>
                <Col md={3}>
                  <Form.Select value={filterApprovalStatus} onChange={(e) => setFilterApprovalStatus(e.target.value)}>
                    <option value="all">Semua Status</option>
                    <option value="draft">Pending Approval</option>
                    <option value="approved">Approved</option>
                    <option value="revision_requested">Request Revisi</option>
                    <option value="rejected">Rejected</option>
                    <option value="selesai">Selesai</option>
                  </Form.Select>
                </Col>
              </Row>
              {loading ? (
                <div className="text-center py-5"><Spinner animation="border" variant="primary" /><p className="mt-2">Loading data...</p></div>
              ) : (
                <div className="table-responsive">
                  <Table striped bordered hover>
                    <thead className="table-dark">
                      <tr>
                        <th>#</th><th>ID Paket</th><th>Nama Paket</th><th>Nama AP</th><th>Jenis</th>
                        <th>Komitmen Keseluruhan</th><th>Komitmen Tahun Berjalan</th>
                        <th>Total Rencana</th><th>Nilai Kontrak</th><th>Realisasi</th><th>Status</th><th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredList.length === 0 ? (
                        <tr><td colSpan="12" className="text-center">Tidak ada data</td></tr>
                      ) : filteredList.map((item, index) => (
                        <tr key={item.id}>
                          <td>{index + 1}</td>
                          <td><small className="font-monospace">{item.idPaketMonitoring}</small></td>
                          <td>{item.namaPaket}</td>
                          <td><small>{item.namaAP}</small></td>
                          <td><Badge bg="info">{item.jenisPaket}</Badge></td>
                          <td>{item.jenisPaket === 'Multi Year (MY)' ? <span className="text-primary fw-bold">{formatCurrency(item.komitmenKeseluruhan)}</span> : <span className="text-success fw-bold">{formatCurrency(item.nilaiKomitmen)}</span>}</td>
                          <td>{formatCurrency(item.nilaiKomitmen)}</td>
                          <td>{formatCurrency((item.rencanaDetail || []).reduce((sum, d) => sum + (d.nilaiRencana || 0), 0))}</td>
                          <td>{item.nilaiKontrakKeseluruhan > 0 ? <span className="text-info fw-bold">{formatCurrency(item.nilaiKontrakKeseluruhan)}</span> : <span className="text-muted">-</span>}</td>
                          <td><span className="text-success fw-bold">{formatCurrency(item.realisasi)}</span></td>
                          <td>{renderApprovalBadge(item)}</td>
                          <td>
                            <div className="d-flex flex-wrap gap-1">
                              <Button variant="info" size="sm" onClick={() => { setSelectedKomitmen(item); setShowDetailModal(true); }} title="Lihat Detail"><FaEye /></Button>
                              <Button variant="warning" size="sm" onClick={() => handleEdit(item)} title="Edit"><FaEdit /></Button>
                              <Button variant="danger" size="sm" onClick={() => handleDelete(item.id)} title="Hapus"><FaTrash /></Button>
                              {item.approvalStatus === 'draft' && item.status !== 'selesai' && (<><Button variant="success" size="sm" onClick={() => handleOpenApproval(item, 'approve')} title="Approve"><FaCheckCircle /></Button><Button variant="danger" size="sm" onClick={() => handleOpenApproval(item, 'reject')} title="Reject"><FaTimesCircle /></Button></>)}
                              {item.approvalStatus === 'approved' && item.status !== 'selesai' && (<Button variant="dark" size="sm" onClick={() => handleMarkAsCompleted(item)}>Selesai</Button>)}
                              {item.approvalStatus === 'revision_requested' && (<Button variant="warning" size="sm" onClick={() => handleOpenApproveRevisi(item)}><FaUndo className="me-1" /> Proses Revisi</Button>)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Container>
      </div>

      <Modal show={showImportModal} onHide={() => setShowImportModal(false)} size="xl" centered>
        <Modal.Header closeButton><Modal.Title>Preview Import Data</Modal.Title></Modal.Header>
        <Modal.Body style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {importErrors.length > 0 && (<Alert variant="danger"><strong>Ditemukan {importErrors.length} error:</strong><ul className="mb-0 mt-2">{importErrors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}{importErrors.length > 10 && <li>... dan {importErrors.length - 10} error lainnya</li>}</ul></Alert>)}
          <Alert variant="info"><strong>Total data:</strong> {importPreview.length} baris akan diimport<br /><small className="text-muted">ℹ️ Field yang belum terisi dapat dilengkapi melalui Edit (opsional).</small></Alert>
          <div className="table-responsive">
            <Table striped bordered hover size="sm">
              <thead><tr><th>#</th><th>ID Paket</th><th>Nama Paket</th><th>AP</th><th>Komitmen</th><th>Jenis</th></tr></thead>
              <tbody>
                {importPreview.slice(0, 20).map((item, i) => (<tr key={i}><td>{i + 1}</td><td><small>{item['ID Paket Monitoring'] || 'Auto'}</small></td><td>{item['Nama Paket']}</td><td><small>{item['Nama AP']}</small></td><td>{formatCurrency(item['Nilai Komitmen'])}</td><td><small>{item['Jenis Paket']}</small></td></tr>))}
                {importPreview.length > 20 && <tr><td colSpan="6" className="text-center text-muted">... dan {importPreview.length - 20} baris lainnya</td></tr>}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowImportModal(false)}>Batal</Button>
          <Button variant="primary" onClick={handleImportConfirm} disabled={importing || importErrors.length > 0}>{importing ? <><Spinner animation="border" size="sm" className="me-2" />Importing...</> : <>Import {importPreview.length} Data</>}</Button>
        </Modal.Footer>
      </Modal>

      <KomitmenFormModal
        show={showFormModal} onHide={handleCloseFormModal} editMode={editMode}
        isAddingNewRealisasi={isAddingNewRealisasi} loading={loading}
        formData={formData} setFormData={setFormData}
        realisasiRows={realisasiRows} rencanaRows={rencanaRows}
        masterAPList={masterAPList} role="admin"
        handleSubmit={handleSubmit} handleFormChange={handleFormChange} handleRupiahChange={handleRupiahChange}
        handleRealisasiChange={handleRealisasiChange} handleRealisasiRupiahChange={handleRealisasiRupiahChange}
        addRealisasiRow={addRealisasiRow} removeRealisasiRow={removeRealisasiRow}
        handleRencanaChange={handleRencanaChange} handleRencanaRupiahChange={handleRencanaRupiahChange}
        addRencanaRow={addRencanaRow} removeRencanaRow={removeRencanaRow}
        handleNewRealisasi={handleNewRealisasi} handleCancelNewRealisasi={handleCancelNewRealisasi}
        selectedKomitmen={selectedKomitmen}
      />

      <KomitmenDetailModal show={showDetailModal} onHide={() => setShowDetailModal(false)} selectedKomitmen={selectedKomitmen} />

      <Modal show={showApprovalModal} onHide={() => setShowApprovalModal(false)} centered key={selectedApprovalItem?.id || 'approval-modal'}>
        <Modal.Header closeButton><Modal.Title>{approvalAction === 'approve' ? 'Approve Komitmen' : 'Reject Komitmen'}</Modal.Title></Modal.Header>
        <Modal.Body>
          {selectedApprovalItem && (<div><p><strong>ID Paket:</strong> {selectedApprovalItem.idPaketMonitoring}</p><p><strong>Nama Paket:</strong> {selectedApprovalItem.namaPaket}</p><p><strong>Komitmen Tahun Berjalan:</strong> {formatCurrency(selectedApprovalItem.nilaiKomitmen)}</p><hr /><Form.Group className="mb-3"><Form.Label>{approvalAction === 'approve' ? 'Catatan Approval (Opsional)' : 'Alasan Penolakan *'}</Form.Label><Form.Control as="textarea" rows={3} value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)} placeholder={approvalAction === 'approve' ? 'Tambahkan catatan jika diperlukan...' : 'Jelaskan alasan penolakan...'} required={approvalAction === 'reject'} /></Form.Group>{approvalAction === 'reject' && (<Alert variant="warning"><strong>Perhatian:</strong> Komitmen yang ditolak akan dikembalikan ke PIC untuk diperbaiki.</Alert>)}</div>)}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowApprovalModal(false)}>Batal</Button>
          {approvalAction === 'approve' ? <Button variant="success" onClick={handleApprove} disabled={loading}>{loading ? <Spinner animation="border" size="sm" /> : <><FaCheckCircle className="me-1" /> Approve</>}</Button> : <Button variant="danger" onClick={handleReject} disabled={loading}>{loading ? <Spinner animation="border" size="sm" /> : <><FaTimesCircle className="me-1" /> Reject</>}</Button>}
        </Modal.Footer>
      </Modal>

      <Modal show={showApproveRevisiModal} onHide={() => setShowApproveRevisiModal(false)} centered>
        <Modal.Header closeButton className="bg-warning"><Modal.Title><FaUndo className="me-2" />Proses Request Revisi dari PIC</Modal.Title></Modal.Header>
        <Modal.Body>
          {selectedRevisiItem && (<><Alert variant="info" className="mb-3"><strong>Paket:</strong> {selectedRevisiItem.namaPaket}<br /><strong>ID:</strong> <span className="font-monospace">{selectedRevisiItem.idPaketMonitoring}</span><br /><strong>AP:</strong> {selectedRevisiItem.namaAP}</Alert><Alert variant="warning" className="mb-3"><strong>Alasan Revisi dari PIC:</strong><br /><span className="text-dark">{selectedRevisiItem.revisiNote || '-'}</span></Alert><Form.Group className="mb-3"><Form.Label>Catatan Admin</Form.Label><Form.Control as="textarea" rows={3} value={approveRevisiNote} onChange={(e) => setApproveRevisiNote(e.target.value)} placeholder="Isi catatan untuk PIC..." /></Form.Group><Alert variant="secondary"><small><strong>Setuju Revisi:</strong> Status berubah ke <Badge bg="danger">Rejected</Badge> — PIC bisa edit ulang.<br /><strong>Tolak Revisi:</strong> Status tetap <Badge bg="success">Approved</Badge>.</small></Alert></>)}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowApproveRevisiModal(false)}>Batal</Button>
          <Button variant="danger" onClick={handleRejectRevisi} disabled={submittingRevisi}>{submittingRevisi ? <Spinner animation="border" size="sm" /> : <><FaTimesCircle className="me-1" /> Tolak Revisi</>}</Button>
          <Button variant="success" onClick={handleApproveRevisi} disabled={submittingRevisi}>{submittingRevisi ? <Spinner animation="border" size="sm" /> : <><FaCheckCircle className="me-1" /> Setuju Revisi</>}</Button>
        </Modal.Footer>
      </Modal>

      <ImportWizardModal show={showWizard} items={wizardItems} user={user} onClose={() => { setShowWizard(false); setWizardItems([]); }} />
    </>
  );
};

export default AdminKomitmen;

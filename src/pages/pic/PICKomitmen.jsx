import { useState, useEffect, useRef } from 'react';
import {
  Container, Card, Button, Table, Modal, Form, Badge, Spinner,
  InputGroup, Alert, Row, Col
} from 'react-bootstrap';
import {
  collection, getDocs, query, orderBy, doc, addDoc,
  updateDoc, getDoc, onSnapshot,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import NavigationBar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import {
  FaEye, FaFileExport, FaSearch, FaPlus, FaEdit,
  FaDownload, FaFileImport, FaUndo
} from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// idGenerator functions now used inside useImportKomitmen hook
import { generateIdPaket } from '../../utils/idGenerator';
import { addNotification } from '../../utils/notificationService';
import { parseRupiahInput, formatRupiahInput, formatCurrency } from '../../utils/rupiahUtils';
import { checkAPSchedule, formatScheduleStatus } from '../../utils/scheduleValidator';
import ImportWizardModal from '../../components/ImportWizardModal';
import useImportKomitmen from '../../hooks/useImportKomitmen';

import KomitmenFormModal from '../../components/komitmen/KomitmenFormModal';
import KomitmenDetailModal from '../../components/komitmen/KomitmenDetailModal';
import useKomitmenForm from '../../hooks/useKomitmenForm';

const PICKomitmen = () => {
  const lastToastTime = useRef(0);
  const TOAST_COOLDOWN = 5000;
  const showToastOnce = (message, type = 'warning') => {
    const now = Date.now();
    if (now - lastToastTime.current > TOAST_COOLDOWN) {
      toast[type](message, { autoClose: 5000 });
      lastToastTime.current = now;
    }
  };

  const fileInputRef = useRef(null);
  const { user } = useAuth();

  // ── Data state ──────────────────────────────────────────────────────
  const [komitmenList, setKomitmenList] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [masterAPList, setMasterAPList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userAP, setUserAP] = useState('');

  // ── Schedule state ───────────────────────────────────────────────
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleInfo, setScheduleInfo] = useState(null);
  const [scheduleStatus, setScheduleStatus] = useState(null);
  const [scheduleAllowed, setScheduleAllowed] = useState(false);

  // ── UI state ──────────────────────────────────────────────────────
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedKomitmen, setSelectedKomitmen] = useState(null);
  const [editMode, setEditMode] = useState(false);

  // ── Filter state ────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [filterApprovalStatus, setFilterApprovalStatus] = useState('all');

  // ── Import state (via hook) ──────────────────────────
  const {
    importing,
    showImportModal, setShowImportModal,
    importPreview,
    importErrors,
    showWizard,
    wizardItems,
    handleFileUpload,
    handleImportConfirm,
    handleWizardCancel,
    handleWizardClose,
  } = useImportKomitmen({ user, userAP, masterAPList });

  // ── Revisi state ────────────────────────────────────────────────
  const [showRevisiModal, setShowRevisiModal] = useState(false);
  const [selectedRevisiItem, setSelectedRevisiItem] = useState(null);
  const [revisiNote, setRevisiNote] = useState('');
  const [submittingRevisi, setSubmittingRevisi] = useState(false);

  // ── Form hook ───────────────────────────────────────────────────
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
  } = useKomitmenForm({ defaultNamaAP: userAP });

  // ── Lifecycle ───────────────────────────────────────────────────
  useEffect(() => {
    const fetchUserAP = async () => {
      try {
        if (user?.uid) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) setUserAP(userDoc.data().namaAP || '');
        }
      } catch (error) { console.error('Error fetching user AP:', error); }
    };
    fetchUserAP();
  }, [user]);

  useEffect(() => {
    fetchMasterAP();
    const unsubscribe = fetchKomitmen();
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  useEffect(() => { filterData(); }, [searchTerm, filterApprovalStatus, komitmenList, userAP]);

  // Auto-set namaAP when opening add form
  useEffect(() => {
    if (showFormModal && !editMode && userAP) {
      setFormData(prev => ({ ...prev, namaAP: userAP }));
    }
  }, [showFormModal, editMode, userAP]);

  // Auto-calculate progress/sisa from realisasi rows
  useEffect(() => {
    const totalRealisasiPeriode = realisasiRows.reduce((sum, row) => sum + parseRupiahInput(row.realisasi), 0);
    let totalRealisasiKeseluruhan = totalRealisasiPeriode;
    if (isAddingNewRealisasi && editMode && selectedKomitmen) {
      totalRealisasiKeseluruhan = (selectedKomitmen.realisasi || 0) + totalRealisasiPeriode;
    }
    const isMY = formData.jenisPaket === 'Multi Year (MY)';
    const nilaiKontrakValue = parseRupiahInput(formData.nilaiKontrakKeseluruhan);
    const nilaiKomitmenTahunIni = parseRupiahInput(formData.nilaiKomitmen);
    const nilaiKomitmenKeseluruhan = parseRupiahInput(formData.komitmenKeseluruhan);
    const nilaiReferensiKeseluruhan = isMY
      ? (nilaiKontrakValue > 0 ? nilaiKontrakValue : nilaiKomitmenKeseluruhan)
      : (nilaiKontrakValue > 0 ? nilaiKontrakValue : nilaiKomitmenTahunIni);
    const progressKeseluruhan = nilaiReferensiKeseluruhan > 0
      ? ((totalRealisasiKeseluruhan / nilaiReferensiKeseluruhan) * 100).toFixed(2) : '0';
    setFormData(prev => ({
      ...prev,
      progres: Math.min(parseFloat(progressKeseluruhan), 100).toString(),
      sisaPembayaran: formatRupiahInput((nilaiReferensiKeseluruhan - totalRealisasiKeseluruhan).toFixed(0))
    }));
  }, [realisasiRows, formData.nilaiKontrakKeseluruhan, formData.nilaiKomitmen, formData.komitmenKeseluruhan, formData.jenisPaket, isAddingNewRealisasi, editMode, selectedKomitmen]);

  // Auto-calculate PDN/TKDN/Import (only in edit mode)
  useEffect(() => {
    if (editMode) {
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

  // Load schedule
  useEffect(() => {
    const loadScheduleInfo = async () => {
      if (!userAP || masterAPList.length === 0) { setScheduleLoading(false); return; }
      setScheduleLoading(true);
      try {
        const apData = masterAPList.find(ap => ap.namaAP === userAP);
        const result = await checkAPSchedule(apData?.id, userAP);
        setScheduleAllowed(result.allowed);
        setScheduleInfo(result.schedule);
        if (result.schedule) setScheduleStatus(formatScheduleStatus(result.schedule));
        if (!result.allowed) showToastOnce(result.message, 'warning');
        else if (result.remainingDays && result.remainingDays <= 7) showToastOnce(result.message, 'info');
      } catch (error) {
        console.error('Error loading schedule:', error);
        setScheduleAllowed(true);
        toast.error('Gagal memuat schedule. Silakan refresh.', { autoClose: 5000 });
      } finally { setScheduleLoading(false); }
    };
    loadScheduleInfo();
  }, [userAP, masterAPList]);

  // ── Fetch ────────────────────────────────────────────────────────
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
      (snapshot) => { setKomitmenList(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      (error) => { toast.error('Gagal memuat data komitmen: ' + error.message); setLoading(false); }
    );
  };

  const filterData = () => {
    let filtered = [...komitmenList];
    if (userAP) filtered = filtered.filter(item => item.namaAP === userAP);
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.namaPaket?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.namaAP?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.idPaketMonitoring?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filterApprovalStatus !== 'all') {
      if (filterApprovalStatus === 'selesai') filtered = filtered.filter(item => item.status === 'selesai');
      else filtered = filtered.filter(item => item.approvalStatus === filterApprovalStatus);
    }
    setFilteredList(filtered);
  };

  // ── Modal handlers ────────────────────────────────────────────────
  const handleCloseFormModal = () => {
    setShowFormModal(false);
    setEditMode(false);
    setSelectedKomitmen(null);
    setIsAddingNewRealisasi(false);
    resetForm(userAP);
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
    toast.info('Mode: Tambah Realisasi Baru.');
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

  // ── Submit ───────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const isRejectedResubmit = editMode && (selectedKomitmen?.approvalStatus === 'rejected' || selectedKomitmen?.approvalStatus === 'rejected_gm');

    // Live schedule check on new submission
    if (!editMode) {
      try {
        const apData = masterAPList.find(ap => ap.namaAP === userAP);
        const liveCheck = await checkAPSchedule(apData?.id, userAP);
        if (!liveCheck.allowed) { toast.error('Schedule berubah! ' + liveCheck.message); setScheduleAllowed(false); return; }
      } catch (error) { console.error('Live schedule check failed:', error); }
    }

    try {
      setLoading(true);
      const checkboxCount = [formData.pdnCheckbox, formData.tkdnCheckbox, formData.importCheckbox].filter(Boolean).length;
      if (checkboxCount > 1) { toast.error('Hanya boleh memilih 1 checkbox (PDN, TKDN, atau Import)'); setLoading(false); return; }
      if (!formData.namaPaket || !formData.namaAP) { toast.error('Mohon lengkapi field wajib: Nama Paket dan Nama AP'); setLoading(false); return; }

      const totalRencana = rencanaRows.reduce((sum, row) => sum + parseRupiahInput(row.nilaiRencana), 0);
      const nilaiKomitmenKeseluruhan = parseRupiahInput(formData.komitmenKeseluruhan);
      const nilaiKomitmenTahunIni = parseRupiahInput(formData.nilaiKomitmen);
      const referensiKomitmen = nilaiKomitmenKeseluruhan > 0 ? nilaiKomitmenKeseluruhan : nilaiKomitmenTahunIni;
      if (totalRencana > referensiKomitmen && referensiKomitmen > 0) {
        toast.error(`Total Rencana melebihi Komitmen sebesar ${formatCurrency(totalRencana - referensiKomitmen)}.`, { autoClose: 8000 });
        setLoading(false); return;
      }

      if (formData.pdnCheckbox && (!formData.nilaiTahunBerjalanPDN || !formData.nilaiKeseluruhanPDN)) { toast.error('Nilai Tahun Berjalan PDN dan Nilai Keseluruhan PDN wajib diisi'); setLoading(false); return; }
      if (formData.tkdnCheckbox && (!formData.nilaiTahunBerjalanTKDN || !formData.nilaiKeseluruhanTKDN)) { toast.error('Nilai Tahun Berjalan TKDN dan Nilai Keseluruhan TKDN wajib diisi'); setLoading(false); return; }
      if (formData.importCheckbox && (!formData.nilaiTahunBerjalanImport || !formData.nilaiKeseluruhanImport)) { toast.error('Nilai Tahun Berjalan Import dan Nilai Keseluruhan Import wajib diisi'); setLoading(false); return; }

      const hasRealisasiData = realisasiRows.some(row => row.realisasi && parseRupiahInput(row.realisasi) > 0);
      // Validasi realisasi hanya berlaku jika komitmen sudah approved oleh admin
      const isApproved = selectedKomitmen?.approvalStatus === 'approved';
      if (editMode && !isRejectedResubmit && isApproved) {
        const isImportedKomitmen = selectedKomitmen?.needRealisasi === true;
        if (!hasRealisasiData && !isImportedKomitmen) { toast.error('Minimal 1 baris realisasi wajib diisi di Tab Realisasi'); setLoading(false); return; }
        if (hasRealisasiData) {
          for (let i = 0; i < realisasiRows.length; i++) {
            const row = realisasiRows[i];
            if (row.realisasi && parseRupiahInput(row.realisasi) > 0 && (!row.bulanRealisasi || !row.nomorInvoice)) {
              toast.error(`Baris realisasi ${i + 1}: Bulan dan Nomor Invoice wajib diisi`); setLoading(false); return;
            }
          }
          if (!formData.namaPenyedia) { toast.error('Nama Penyedia wajib diisi di Tab Realisasi'); setLoading(false); return; }
          if (!formData.nilaiKontrakKeseluruhan) { toast.error('Nilai Kontrak Keseluruhan wajib diisi di Tab Realisasi'); setLoading(false); return; }
        }
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
      if (!editMode) {
        dataToSave.createdAt = new Date();
        dataToSave.createdBy = user?.email || user?.displayName || '';
        dataToSave.createdByName = user?.nama || user?.username || '';
        dataToSave.approvalStatus = 'pending_gm';
      }
      if (isRejectedResubmit) {
        dataToSave.approvalStatus = 'pending_gm';
        dataToSave.approvalNote = '';
        dataToSave.rejectedBy = '';
        dataToSave.rejectedAt = null;
      }
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
            namaPengadaanRealisasi: formData.namaPengadaanRealisasi, metodePemilihanRealisasi: formData.metodePemilihanRealisasi,
            approvalStatus: 'pending_gm'
          };
          Object.keys(updateData).forEach(key => { if (updateData[key] === undefined) delete updateData[key]; });
          await updateDoc(doc(db, 'komitmen', selectedKomitmen.id), updateData);
          toast.success('Realisasi baru berhasil ditambahkan!');
          setIsAddingNewRealisasi(false);
          setKomitmenList(prev => prev.map(k => k.id === selectedKomitmen.id ? { ...k, ...updateData } : k));
        } else {
          if (selectedKomitmen?.needRealisasi) dataToSave.needRealisasi = false;
          await updateDoc(doc(db, 'komitmen', selectedKomitmen.id), dataToSave);
          toast.success(isRejectedResubmit ? 'Data berhasil diperbaiki dan di-submit ulang!' : 'Data berhasil diupdate');
          setKomitmenList(prev => prev.map(k => k.id === selectedKomitmen.id ? { ...k, ...dataToSave } : k));
        }
        try { await addNotification(user?.uid || '', 'info', 'Komitmen Diupdate', `Komitmen "${formData.namaPaket}" telah diupdate`, { komitmenId: selectedKomitmen.id, action: isRejectedResubmit ? 'resubmit' : 'update' }); } catch { }
      } else {
        const docRef = await addDoc(collection(db, 'komitmen'), dataToSave);
        toast.success('Komitmen berhasil disimpan dan menunggu approval admin!');
        setKomitmenList(prev => [{ id: docRef.id, ...dataToSave }, ...prev]);
        try { await addNotification(user?.uid || '', 'success', 'Komitmen Baru', `Komitmen "${formData.namaPaket}" telah ditambahkan`, { action: 'create' }); } catch { }
      }
      handleCloseFormModal();
    } catch (error) { toast.error('Terjadi kesalahan saat menyimpan data: ' + error.message); }
    finally { setLoading(false); }
  };

  // ── Export ───────────────────────────────────────────────────────
  const handleExport = () => {
    const dataToExport = filteredList.map(item => ({
      'ID Paket': item.idPaketMonitoring, 'Jenis Paket': item.jenisPaket, 'Nama AP': item.namaAP,
      'Nama Paket': item.namaPaket, 'Nilai Komitmen': item.nilaiKomitmen, 'Realisasi': item.realisasi,
      'Progres': item.progres, 'Status': item.status, 'Approval': item.approvalStatus
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Komitmen');
    XLSX.writeFile(wb, `Export_Komitmen_PIC_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Data berhasil diexport');
  };

  // ── Import ───────────────────────────────────────────────────────

  // ── Revisi ───────────────────────────────────────────────────────
  const handleOpenRevisi = (item) => { setSelectedRevisiItem(item); setRevisiNote(''); setShowRevisiModal(true); };

  const handleSubmitRevisi = async () => {
    if (!revisiNote?.trim()) { toast.error('Catatan/alasan revisi wajib diisi'); return; }
    if (!selectedRevisiItem) return;
    setSubmittingRevisi(true);
    try {
      const isPendingGM = selectedRevisiItem.approvalStatus === 'pending_gm';
      const isApproved = selectedRevisiItem.approvalStatus === 'approved';
      let revisiData;
      if (isPendingGM) {
        // Tarik submission yang belum diproses GM
        revisiData = { approvalStatus: 'rejected_gm', approvalNote: `[Ditarik PIC] ${revisiNote.trim()}`, rejectedBy: user?.email || '', rejectedAt: new Date(), revisiNote: revisiNote.trim(), revisiRequestedBy: user?.email || '', revisiRequestedAt: new Date(), updatedAt: new Date(), updatedBy: user?.email || '' };
      } else {
        // Approved — request revisi ke admin
        revisiData = { approvalStatus: 'revision_requested', revisiNote: revisiNote.trim(), revisiRequestedBy: user?.email || '', revisiRequestedAt: new Date(), updatedAt: new Date(), updatedBy: user?.email || '' };
      }
      await updateDoc(doc(db, 'komitmen', selectedRevisiItem.id), revisiData);
      toast.success(isPendingGM ? 'Submission berhasil ditarik. Silakan perbaiki dan submit ulang!' : 'Request revisi berhasil dikirim ke admin!');
      setKomitmenList(prev => prev.map(k => k.id === selectedRevisiItem.id ? { ...k, ...revisiData } : k));
      try { await addNotification(user?.uid || '', 'info', isPendingGM ? 'Submission Ditarik' : 'Request Revisi Dikirim', isPendingGM ? `Komitmen "${selectedRevisiItem.namaPaket}" berhasil ditarik.` : `Request revisi untuk komitmen "${selectedRevisiItem.namaPaket}" dikirim ke admin.`, { komitmenId: selectedRevisiItem.id, action: isPendingGM ? 'draft_recalled' : 'revision_requested', reason: revisiNote.trim() }); } catch { }
      setShowRevisiModal(false); setSelectedRevisiItem(null); setRevisiNote('');
    } catch (error) { toast.error('Gagal mengirim request revisi: ' + error.message); }
    finally { setSubmittingRevisi(false); }
  };

  const renderApprovalBadge = (item) => {
    if (item.status === 'selesai') return <Badge bg="dark">Selesai</Badge>;
    switch (item.approvalStatus) {
      case 'approved': return <Badge bg="success">Approved</Badge>;
      case 'rejected': return <Badge bg="danger">Rejected — Perlu Revisi</Badge>;
      case 'rejected_gm': return <Badge bg="danger">Ditolak GM — Perlu Revisi</Badge>;
      case 'pending_gm': return <Badge bg="info" className="text-dark">Menunggu Review GM</Badge>;
      case 'pending_admin': return <Badge bg="warning" className="text-dark">Menunggu Approval Admin</Badge>;
      case 'revision_requested': return <Badge bg="warning" className="text-dark">Request Revisi</Badge>;
      default: return <Badge bg="secondary">Menunggu Approval</Badge>;
    }
  };

  const canEdit = (item) => {
    if (item.status === 'selesai') return false;
    // PIC boleh mengedit setelah komitmen di-approve admin (untuk mengisi/melengkapi Realisasi).
    // Tab Komitmen tetap terkunci di dalam form; hanya tab Realisasi yang bisa diedit.
    return item.approvalStatus === 'approved' || item.approvalStatus === 'rejected' || item.approvalStatus === 'rejected_gm' || item.approvalStatus === 'draft' || item.needRealisasi || item.approvalStatus === 'pending_gm';
  };

  const canRequestRevisi = (item) => {
    return (item.approvalStatus === 'pending_gm' || item.approvalStatus === 'approved') && item.status !== 'selesai';
  };

  // ════════════════════════════════════ RENDER ═══════════════════════════════════
  return (
    <>
      <NavigationBar />
      <div className="d-flex">
        <Sidebar />
        <Container fluid className="responsive-shift" style= padding: '2rem', marginTop: '70px' >
          <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick />

          {/* Schedule Alert */}
          {!scheduleLoading && scheduleStatus && (
            <Alert variant={scheduleAllowed ? scheduleStatus.color : 'warning'} className="mb-3">
              {scheduleAllowed
                ? <><strong>Periode Input Aktif</strong> — {scheduleStatus.message}</>
                : <><strong>Periode Input Tidak Aktif</strong> — {scheduleStatus.message}. Penambahan komitmen baru tidak diizinkan.</>
              }
            </Alert>
          )}

          <Card className="shadow-sm mb-4">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h2 className="fw-bold mb-1">Monitoring Komitmen</h2>
                  <p className="text-muted mb-0">
                    Kelola data komitmen dan realisasi — <Badge bg="info">AP: {userAP}</Badge>
                  </p>
                </div>
                <div className="d-flex gap-2">
                  <Button variant="success" size="sm" onClick={() => setShowFormModal(true)} disabled={!scheduleAllowed || scheduleLoading}>
                    <FaPlus className="me-1" /> Tambah Komitmen
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleExport}><FaFileExport className="me-1" /> Export Excel</Button>
                  <Button variant="info" size="sm" onClick={() => { const link = document.createElement('a'); link.href = '/templates/Template_Import_Komitmen_Awal.xlsx'; link.download = 'Template_Import_Komitmen_Awal.xlsx'; document.body.appendChild(link); link.click(); document.body.removeChild(link); toast.success('Template berhasil didownload!'); }}><FaDownload className="me-1" /> Download Template</Button>
                  <Button variant="warning" size="sm" onClick={() => fileInputRef.current?.click()} disabled={!scheduleAllowed}><FaFileImport className="me-1" /> Import Excel</Button>
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} style= display: 'none'  />
                </div>
              </div>

              <Row className="mb-3">
                <Col md={6}>
                  <InputGroup>
                    <InputGroup.Text><FaSearch /></InputGroup.Text>
                    <Form.Control placeholder="Cari berdasarkan Nama Paket atau ID Paket..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </InputGroup>
                </Col>
                <Col md={3}>
                  <Form.Select value={filterApprovalStatus} onChange={(e) => setFilterApprovalStatus(e.target.value)}>
                    <option value="all">Semua Status</option>
                    <option value="pending_gm">Menunggu Review GM</option>
                    <option value="pending_admin">Menunggu Approval Admin</option>
                    <option value="approved">Approved</option>
                    <option value="rejected_gm">Ditolak GM</option>
                    <option value="rejected">Rejected Admin</option>
                    <option value="revision_requested">Request Revisi</option>
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
                        <th>#</th><th>ID Paket</th><th>Nama Paket</th><th>Jenis</th>
                        <th>Komitmen Tahun Berjalan</th><th>Total Rencana</th>
                        <th>Nilai Kontrak</th><th>Realisasi</th><th>Status</th><th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredList.length === 0 ? (
                        <tr><td colSpan="10" className="text-center">Tidak ada data</td></tr>
                      ) : filteredList.map((item, index) => (
                        <tr key={item.id}>
                          <td>{index + 1}</td>
                          <td><small className="font-monospace">{item.idPaketMonitoring}</small></td>
                          <td>
                            {item.namaPaket}
                            {item.approvalStatus === 'rejected' && item.approvalNote && (
                              <div><small className="text-danger">Catatan: {item.approvalNote}</small></div>
                            )}
                            {item.revisiNote && item.approvalStatus === 'revision_requested' && (
                              <div><small className="text-warning">Catatan: {item.revisiNote}</small></div>
                            )}
                          </td>
                          <td><Badge bg="info">{item.jenisPaket}</Badge></td>
                          <td>{formatCurrency(item.nilaiKomitmen)}</td>
                          <td>{formatCurrency((item.rencanaDetail || []).reduce((sum, d) => sum + (d.nilaiRencana || 0), 0))}</td>
                          <td>{item.nilaiKontrakKeseluruhan > 0 ? <span className="text-info fw-bold">{formatCurrency(item.nilaiKontrakKeseluruhan)}</span> : <span className="text-muted">-</span>}</td>
                          <td><span className="text-success fw-bold">{formatCurrency(item.realisasi)}</span></td>
                          <td>{renderApprovalBadge(item)}</td>
                          <td>
                            <div className="d-flex flex-wrap gap-1">
                              <Button variant="info" size="sm" onClick={() => { setSelectedKomitmen(item); setShowDetailModal(true); }} title="Lihat Detail"><FaEye /></Button>
                              {canEdit(item) && (
                                <Button variant="warning" size="sm" onClick={() => handleEdit(item)} title="Edit"><FaEdit /></Button>
                              )}
                              {canRequestRevisi(item) && (
                                <Button variant="outline-warning" size="sm" onClick={() => handleOpenRevisi(item)} title="Request Revisi / Tarik Submission">
                                  <FaUndo className="me-1" />{item.approvalStatus === 'pending_gm' ? 'Tarik' : 'Revisi'}
                                </Button>
                              )}
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

      {/* ── MODAL IMPORT ── */}
      <Modal show={showImportModal} onHide={() => setShowImportModal(false)} size="xl" centered>
        <Modal.Header closeButton><Modal.Title>Preview Import Data - AP: <Badge bg="primary">{userAP}</Badge></Modal.Title></Modal.Header>
        <Modal.Body style= maxHeight: '70vh', overflowY: 'auto' >
          {importErrors.length > 0 && (<Alert variant="danger"><strong>Ditemukan {importErrors.length} error:</strong><ul className="mb-0 mt-2">{importErrors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}</ul></Alert>)}
          <Alert variant="info"><strong>Total data:</strong> {importPreview.length} baris untuk AP <Badge bg="primary">{userAP}</Badge></Alert>
          <div className="table-responsive">
            <Table striped bordered hover size="sm">
              <thead><tr><th>#</th><th>ID Paket</th><th>Nama Paket</th><th>Komitmen</th><th>Jenis</th></tr></thead>
              <tbody>
                {importPreview.slice(0, 20).map((item, i) => { const nk = item['Nilai Komitmen']; const nilaiNum = typeof nk === 'number' ? nk : parseRupiahInput(String(nk || '0')); return (<tr key={i}><td>{i + 1}</td><td><small>{item['ID Paket Monitoring'] || 'Auto'}</small></td><td>{item['Nama Paket']}</td><td>{formatCurrency(nilaiNum)}</td><td><small>{item['Jenis Paket']}</small></td></tr>); })}
                {importPreview.length > 20 && <tr><td colSpan="5" className="text-center text-muted">... dan {importPreview.length - 20} baris lainnya</td></tr>}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowImportModal(false)}>Batal</Button>
          <Button variant="primary" onClick={handleImportConfirm} disabled={importing || importErrors.length > 0}>{importing ? <><Spinner animation="border" size="sm" className="me-2" />Importing...</> : <>Import {importPreview.length} Data</>}</Button>
        </Modal.Footer>
      </Modal>

      {/* ── MODAL FORM (shared) ── */}
      <KomitmenFormModal
        show={showFormModal} onHide={handleCloseFormModal} editMode={editMode}
        isAddingNewRealisasi={isAddingNewRealisasi} loading={loading}
        formData={formData} setFormData={setFormData}
        realisasiRows={realisasiRows} rencanaRows={rencanaRows}
        masterAPList={masterAPList} role="pic"
        createdByName={user?.nama || user?.username || ''}
        handleSubmit={handleSubmit} handleFormChange={handleFormChange} handleRupiahChange={handleRupiahChange}
        handleRealisasiChange={handleRealisasiChange} handleRealisasiRupiahChange={handleRealisasiRupiahChange}
        addRealisasiRow={addRealisasiRow} removeRealisasiRow={removeRealisasiRow}
        handleRencanaChange={handleRencanaChange} handleRencanaRupiahChange={handleRencanaRupiahChange}
        addRencanaRow={addRencanaRow} removeRencanaRow={removeRencanaRow}
        handleNewRealisasi={handleNewRealisasi} handleCancelNewRealisasi={handleCancelNewRealisasi}
        selectedKomitmen={selectedKomitmen}
      />

      {/* ── MODAL DETAIL (shared) ── */}
      <KomitmenDetailModal show={showDetailModal} onHide={() => setShowDetailModal(false)} selectedKomitmen={selectedKomitmen} />

      {/* ── MODAL REQUEST REVISI ── */}
      <Modal show={showRevisiModal} onHide={() => setShowRevisiModal(false)} centered>
        <Modal.Header closeButton className="bg-warning">
          <Modal.Title><FaUndo className="me-2" />{selectedRevisiItem?.approvalStatus === 'pending_gm' ? 'Tarik Submission' : 'Request Revisi ke Admin'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedRevisiItem && (
            <>
              <Alert variant="info" className="mb-3">
                <strong>Paket:</strong> {selectedRevisiItem.namaPaket}<br />
                <strong>ID:</strong> <span className="font-monospace">{selectedRevisiItem.idPaketMonitoring}</span>
              </Alert>
              {selectedRevisiItem.approvalStatus === 'pending_gm' ? (
                <Alert variant="warning"><strong>Catatan:</strong> Submission akan ditarik kembali. Anda dapat mengedit dan submit ulang ke GM.</Alert>
              ) : (
                <Alert variant="info"><strong>Catatan:</strong> Request revisi akan dikirim ke admin. Admin akan memutuskan apakah revisi disetujui atau ditolak.</Alert>
              )}
              <Form.Group className="mb-3">
                <Form.Label>Catatan/Alasan <span className="text-danger">*</span></Form.Label>
                <Form.Control as="textarea" rows={4} value={revisiNote} onChange={(e) => setRevisiNote(e.target.value.slice(0, 500))} placeholder="Jelaskan alasan revisi atau perbaikan yang diperlukan..." maxLength={500} />
                <Form.Text className="text-muted">{revisiNote.length}/500 karakter</Form.Text>
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRevisiModal(false)}>Batal</Button>
          <Button variant="warning" onClick={handleSubmitRevisi} disabled={submittingRevisi || !revisiNote.trim()}>
            {submittingRevisi ? <Spinner animation="border" size="sm" /> : <><FaUndo className="me-1" />{selectedRevisiItem?.approvalStatus === 'pending_gm' ? 'Tarik Submission' : 'Kirim Request Revisi'}</>}
          </Button>
        </Modal.Footer>
      </Modal>

      <ImportWizardModal
        show={showWizard}
        items={wizardItems}
        user={user}
        onClose={handleWizardClose}
        onCancel={handleWizardCancel}
      />
    </>
  );
};

export default PICKomitmen;
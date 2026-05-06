/**
 * AdminKomitmen.jsx
 *
 * Halaman manajemen komitmen untuk Admin.
 * Admin dapat melihat SEMUA AP (tidak difilter seperti PIC).
 *
 * Fitur:
 *   • CRUD komitmen (tambah, edit, hapus)
 *   • Import Excel (semua AP) via useImportKomitmen dengan userAP=null
 *   • Export Excel
 *   • Approval / Reject / Mark Selesai
 *   • Proses Request Revisi dari PIC
 */

import { useState, useEffect, useRef } from 'react';
import {
  Container, Card, Button, Table, Modal, Form, Badge, Spinner,
  InputGroup, Alert, Row, Col,
} from 'react-bootstrap';
import {
  collection, getDocs, query, orderBy, deleteDoc, doc,
  addDoc, updateDoc, onSnapshot,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import NavigationBar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import {
  FaEye, FaTrash, FaFileExport, FaFileImport, FaSearch,
  FaDownload, FaPlus, FaEdit, FaCheckCircle, FaTimesCircle, FaUndo,
} from 'react-icons/fa';
import { toast, ToastContainer, Slide } from 'react-toastify';
import * as XLSX from 'xlsx';
import 'react-toastify/dist/ReactToastify.css';
import { addNotification } from '../../utils/notificationService';
import { generateIdPaket } from '../../utils/idGenerator';
import { parseRupiahInput, formatRupiahInput, formatCurrency } from '../../utils/rupiahUtils';
import ImportWizardModal from '../../components/ImportWizardModal';
import KomitmenFormModal from '../../components/komitmen/KomitmenFormModal';
import KomitmenDetailModal from '../../components/komitmen/KomitmenDetailModal';
import useKomitmenForm from '../../hooks/useKomitmenForm';
import useImportKomitmen from '../../hooks/useImportKomitmen';

// ─────────────────────────────────────────────────────────────────────────────
const AdminKomitmen = () => {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  // ── Data state ──────────────────────────────────────────────────────────────
  const [komitmenList,    setKomitmenList]    = useState([]);
  const [filteredList,    setFilteredList]    = useState([]);
  const [masterAPList,    setMasterAPList]    = useState([]);
  const [loading,         setLoading]         = useState(true);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFormModal,   setShowFormModal]   = useState(false);
  const [selectedKomitmen, setSelectedKomitmen] = useState(null);
  const [editMode,        setEditMode]        = useState(false);
  const [searchTerm,      setSearchTerm]      = useState('');
  const [filterApprovalStatus, setFilterApprovalStatus] = useState('all');

  // ── Approval state ──────────────────────────────────────────────────────────
  const [showApprovalModal,     setShowApprovalModal]     = useState(false);
  const [selectedApprovalItem,  setSelectedApprovalItem]  = useState(null);
  const [approvalAction,        setApprovalAction]        = useState('approve');
  const [approvalNote,          setApprovalNote]          = useState('');

  // ── Request Revisi state ────────────────────────────────────────────────────
  const [showApproveRevisiModal, setShowApproveRevisiModal] = useState(false);
  const [selectedRevisiItem,     setSelectedRevisiItem]     = useState(null);
  const [approveRevisiNote,      setApproveRevisiNote]      = useState('');
  const [submittingRevisi,       setSubmittingRevisi]       = useState(false);

  // ── Form hook ───────────────────────────────────────────────────────────────
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

  // ── Import hook (Admin: userAP=null → semua AP, tanpa filter) ──────────────
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
  } = useImportKomitmen({ user, userAP: null, masterAPList });

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchMasterAP();
    const unsubscribe = fetchKomitmen();
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  useEffect(() => { filterData(); }, [searchTerm, filterApprovalStatus, komitmenList]);

  useEffect(() => {
    if (editMode || realisasiRows.some((row) => parseRupiahInput(row.realisasi) > 0)) {
      const totalRealisasi = realisasiRows.reduce((sum, row) => sum + parseRupiahInput(row.realisasi), 0);
      if (formData.pdnCheckbox && totalRealisasi > 0) {
        setFormData((prev) => ({ ...prev, nilaiPDN: formatRupiahInput(totalRealisasi.toString()), nilaiTKDN: '0', nilaiImpor: '0' }));
      } else if (formData.tkdnCheckbox && totalRealisasi > 0) {
        setFormData((prev) => ({ ...prev, nilaiPDN: '0', nilaiTKDN: formatRupiahInput(totalRealisasi.toString()), nilaiImpor: '0' }));
      } else if (formData.importCheckbox && totalRealisasi > 0) {
        setFormData((prev) => ({ ...prev, nilaiPDN: '0', nilaiTKDN: '0', nilaiImpor: formatRupiahInput(totalRealisasi.toString()) }));
      }
    }
  }, [realisasiRows, formData.pdnCheckbox, formData.tkdnCheckbox, formData.importCheckbox, editMode]);

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchMasterAP = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'masterAP'));
      setMasterAPList(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).filter((ap) => ap.isActive));
    } catch { toast.error('Gagal memuat Master AP'); }
  };

  const fetchKomitmen = () => {
    setLoading(true);
    const q = query(collection(db, 'komitmen'), orderBy('createdAt', 'desc'));
    return onSnapshot(q,
      (snapshot) => {
        setKomitmenList(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (error) => { console.error(error); toast.error('Gagal memuat data komitmen'); setLoading(false); }
    );
  };

  const filterData = () => {
    let filtered = [...komitmenList];
    if (searchTerm) {
      filtered = filtered.filter((item) =>
        item.namaPaket?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.namaAP?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.idPaketMonitoring?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filterApprovalStatus !== 'all') {
      if (filterApprovalStatus === 'selesai') {
        filtered = filtered.filter((item) => item.status === 'selesai');
      } else {
        filtered = filtered.filter((item) => item.approvalStatus === filterApprovalStatus);
      }
    }
    setFilteredList(filtered);
  };

  // ── Form modal handlers ─────────────────────────────────────────────────────
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
    setFormData((prev) => ({
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
        setRealisasiRows(selectedKomitmen.realisasiDetail.map((detail) => ({
          id: Date.now() + Math.random(),
          tahunRealisasi: detail.tahunRealisasi || '',
          bulanRealisasi: detail.bulanRealisasi || '',
          realisasi: formatRupiahInput(detail.realisasi?.toString() || ''),
          nomorInvoice: detail.nomorInvoice || '',
          tanggalInvoice: detail.tanggalInvoice || '',
          dokumen: detail.dokumen || null,
        })));
      }
      setFormData((prev) => ({
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
  };

  // ── Submit form (tambah / edit) ─────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const checkboxCount = [formData.pdnCheckbox, formData.tkdnCheckbox, formData.importCheckbox].filter(Boolean).length;
      if (checkboxCount > 1) { toast.error('Hanya boleh memilih 1 checkbox (PDN, TKDN, atau Import)'); return; }
      if (!formData.namaPaket || !formData.namaAP) { toast.error('Mohon lengkapi field wajib: Nama Paket dan Nama AP'); return; }

      const totalRencana   = rencanaRows.reduce((sum, row) => sum + parseRupiahInput(row.nilaiRencana), 0);
      const refKomitmen    = parseRupiahInput(formData.komitmenKeseluruhan) > 0 ? parseRupiahInput(formData.komitmenKeseluruhan) : parseRupiahInput(formData.nilaiKomitmen);
      if (totalRencana > refKomitmen && refKomitmen > 0) {
        toast.error(`Total Rencana melebihi Komitmen sebesar ${formatCurrency(totalRencana - refKomitmen)}.`, { autoClose: 8000 });
        return;
      }

      const selectedAP = masterAPList.find((ap) => ap.namaAP === formData.namaAP);
      if (!selectedAP) { toast.error('AP tidak ditemukan di Master Data'); return; }

      let idPaket = formData.idPaketMonitoring;
      if (!editMode || !idPaket) idPaket = await generateIdPaket(formData.jenisPaket, selectedAP.singkatanAP);

      const totalRealisasi = realisasiRows.reduce((sum, row) => sum + parseRupiahInput(row.realisasi), 0);
      const dataToSave = {
        idPaketMonitoring:        idPaket,
        jenisPaket:               formData.jenisPaket,
        idRUP:                    formData.idRUP,
        namaAP:                   formData.namaAP,
        namaPaket:                formData.namaPaket,
        jenisAnggaran:            formData.jenisAnggaran,
        jenisPengadaan:           formData.jenisPengadaan,
        usulanMetodePemilihan:    formData.usulanMetodePemilihan,
        statusPadi:               formData.statusPadi,
        nilaiKomitmen:            parseRupiahInput(formData.nilaiKomitmen),
        komitmenKeseluruhan:      parseRupiahInput(formData.komitmenKeseluruhan),
        waktuPemanfaatanDari:     formData.waktuPemanfaatanDari,
        waktuPemanfaatanSampai:   formData.waktuPemanfaatanSampai,
        rencanaDetail:            rencanaRows.map((row) => ({ tahunRencana: row.tahunRencana || '', nilaiRencana: parseRupiahInput(row.nilaiRencana), bulanRencana: row.bulanRencana, keterangan: row.keterangan })),
        pdnCheckbox:              formData.pdnCheckbox,
        tkdnCheckbox:             formData.tkdnCheckbox,
        importCheckbox:           formData.importCheckbox,
        targetNilaiTKDN:          parseRupiahInput(formData.targetNilaiTKDN),
        nilaiAnggaranBelanja:     parseRupiahInput(formData.nilaiAnggaranBelanja),
        nilaiTahunBerjalanPDN:    parseRupiahInput(formData.nilaiTahunBerjalanPDN),
        nilaiKeseluruhanPDN:      parseRupiahInput(formData.nilaiKeseluruhanPDN),
        nilaiTahunBerjalanTKDN:   parseRupiahInput(formData.nilaiTahunBerjalanTKDN),
        nilaiKeseluruhanTKDN:     parseRupiahInput(formData.nilaiKeseluruhanTKDN),
        nilaiTahunBerjalanImport: parseRupiahInput(formData.nilaiTahunBerjalanImport),
        nilaiKeseluruhanImport:   parseRupiahInput(formData.nilaiKeseluruhanImport),
        realisasi:                totalRealisasi,
        realisasiDetail:          realisasiRows.map((row) => ({ tahunRealisasi: row.tahunRealisasi, bulanRealisasi: row.bulanRealisasi, realisasi: parseRupiahInput(row.realisasi), nomorInvoice: row.nomorInvoice, tanggalInvoice: row.tanggalInvoice, dokumen: row.dokumen, namaPenyedia: row.namaPenyedia || formData.namaPenyedia })),
        nilaiKontrakKeseluruhan:  parseRupiahInput(formData.nilaiKontrakKeseluruhan),
        namaPenyedia:             formData.namaPenyedia,
        kualifikasiPenyedia:      formData.kualifikasiPenyedia,
        nilaiPDN:                 parseRupiahInput(formData.nilaiPDN),
        nilaiTKDN:                parseRupiahInput(formData.nilaiTKDN),
        nilaiImpor:               parseRupiahInput(formData.nilaiImpor),
        namaPengadaanRealisasi:   formData.namaPengadaanRealisasi,
        metodePemilihanRealisasi: formData.metodePemilihanRealisasi,
        progres:                  formData.progres,
        sisaPembayaran:           parseRupiahInput(formData.sisaPembayaran),
        catatanKomitmen:          formData.catatanKomitmen,
        keterangan:               formData.keterangan,
        status:                   formData.status,
        isActive:                 formData.isActive,
        idUser:                   user?.uid || '',
        updatedAt:                new Date(),
        updatedBy:                user?.email || '',
      };
      Object.keys(dataToSave).forEach((key) => { if (dataToSave[key] === undefined) delete dataToSave[key]; });

      if (editMode && selectedKomitmen?.id) {
        if (isAddingNewRealisasi) {
          const existing         = selectedKomitmen.realisasiDetail || [];
          const newDetail        = [
            ...existing.map((row) => ({ ...row, namaPenyedia: row.namaPenyedia || selectedKomitmen.namaPenyedia || '' })),
            ...realisasiRows.map((row) => ({ tahunRealisasi: row.tahunRealisasi, bulanRealisasi: row.bulanRealisasi, realisasi: parseRupiahInput(row.realisasi), nomorInvoice: row.nomorInvoice, tanggalInvoice: row.tanggalInvoice, dokumen: row.dokumen ? row.dokumen.name : null, namaPengadaanRealisasi: formData.namaPengadaanRealisasi, metodePemilihanRealisasi: formData.metodePemilihanRealisasi, kualifikasiPenyedia: formData.kualifikasiPenyedia, namaPenyedia: formData.namaPenyedia })),
          ];
          const totalBaru        = newDetail.reduce((sum, d) => sum + (d.realisasi || 0), 0);
          const isMY             = formData.jenisPaket === 'Multi Year (MY)';
          const nilaiKontrak     = parseRupiahInput(formData.nilaiKontrakKeseluruhan);
          const nilaiReferensi   = isMY ? (nilaiKontrak > 0 ? nilaiKontrak : parseRupiahInput(formData.komitmenKeseluruhan)) : (nilaiKontrak > 0 ? nilaiKontrak : parseRupiahInput(formData.nilaiKomitmen));
          const updateData = {
            realisasiDetail:          newDetail,
            realisasi:                totalBaru,
            progres:                  Math.min(nilaiReferensi > 0 ? (totalBaru / nilaiReferensi) * 100 : 0, 100).toFixed(2),
            sisaPembayaran:           nilaiReferensi - totalBaru,
            nilaiKontrakKeseluruhan:  nilaiKontrak,
            nilaiPDN:                 parseRupiahInput(formData.nilaiPDN),
            nilaiTKDN:                parseRupiahInput(formData.nilaiTKDN),
            nilaiImpor:               parseRupiahInput(formData.nilaiImpor),
            keterangan:               formData.keterangan,
            updatedAt:                new Date(),
            updatedBy:                user?.email || '',
            needRealisasi:            false,
            namaPenyedia:             formData.namaPenyedia,
            kualifikasiPenyedia:      formData.kualifikasiPenyedia,
            namaPengadaanRealisasi:   formData.namaPengadaanRealisasi,
            metodePemilihanRealisasi: formData.metodePemilihanRealisasi,
          };
          await updateDoc(doc(db, 'komitmen', selectedKomitmen.id), updateData);
          toast.success('Realisasi baru berhasil ditambahkan!');
          setIsAddingNewRealisasi(false);
          setKomitmenList((prev) => prev.map((k) => k.id === selectedKomitmen.id ? { ...k, ...updateData } : k));
        } else {
          if (selectedKomitmen?.needRealisasi) dataToSave.needRealisasi = false;
          await updateDoc(doc(db, 'komitmen', selectedKomitmen.id), dataToSave);
          toast.success('Data berhasil diupdate');
          setKomitmenList((prev) => prev.map((k) => k.id === selectedKomitmen.id ? { ...k, ...dataToSave } : k));
        }
        try { await addNotification(user?.uid || '', 'info', 'Komitmen Diupdate', `Komitmen "${formData.namaPaket}" telah diupdate`, { komitmenId: selectedKomitmen.id, action: 'update' }); } catch { }
      } else {
        dataToSave.createdAt  = new Date();
        dataToSave.createdBy  = user?.email || '';
        dataToSave.createdByName = user?.nama || user?.username || '';
        const docRef = await addDoc(collection(db, 'komitmen'), dataToSave);
        toast.success('Data berhasil disimpan');
        setKomitmenList((prev) => [{ id: docRef.id, ...dataToSave }, ...prev]);
        try { await addNotification(user?.uid || '', 'success', 'Komitmen Baru', `Komitmen "${formData.namaPaket}" telah ditambahkan`, { action: 'create' }); } catch { }
      }
      handleCloseFormModal();
    } catch (error) {
      toast.error('Terjadi kesalahan saat menyimpan data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus data ini?')) return;
    try {
      await deleteDoc(doc(db, 'komitmen', id));
      toast.success('Data berhasil dihapus');
      setKomitmenList((prev) => prev.filter((k) => k.id !== id));
      await addNotification(user?.uid || '', 'warning', 'Komitmen Dihapus', 'Data komitmen telah dihapus', { komitmenId: id, action: 'delete' });
    } catch { toast.error('Gagal menghapus data'); }
  };

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const dataToExport = filteredList.map((item) => ({
      'ID Paket': item.idPaketMonitoring, 'Jenis Paket': item.jenisPaket, 'ID RUP': item.idRUP || '',
      'Nama AP': item.namaAP, 'Nama Paket': item.namaPaket, 'Jenis Anggaran': item.jenisAnggaran,
      'Jenis Pengadaan': item.jenisPengadaan, 'Metode Pemilihan': item.usulanMetodePemilihan,
      'Status PaDi': item.statusPadi, 'Nilai Komitmen': item.nilaiKomitmen, 'Komitmen Keseluruhan': item.komitmenKeseluruhan,
      'Waktu Pemanfaatan Dari': item.waktuPemanfaatanDari, 'Waktu Pemanfaatan Sampai': item.waktuPemanfaatanSampai,
      'PDN': item.pdnCheckbox ? 'TRUE' : 'FALSE', 'TKDN': item.tkdnCheckbox ? 'TRUE' : 'FALSE', 'Import': item.importCheckbox ? 'TRUE' : 'FALSE',
      'Realisasi': item.realisasi, 'Nilai Kontrak': item.nilaiKontrakKeseluruhan || 0,
      'Nama Penyedia': item.namaPenyedia, 'Status': item.status,
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Komitmen');
    XLSX.writeFile(wb, `Export_Komitmen_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Data berhasil diexport');
  };

  // ── Approval handlers ───────────────────────────────────────────────────────
  const handleOpenApproval = (item, action) => {
    setSelectedApprovalItem(item); setApprovalAction(action); setApprovalNote(''); setShowApprovalModal(true);
  };

  const handleApprove = async () => {
    if (!selectedApprovalItem) return;
    setLoading(true);
    try {
      const data = { approvalStatus: 'approved', approvedBy: user?.email || 'Admin', approvedAt: new Date(), approvalNote: approvalNote || 'Disetujui oleh admin', status: 'active', updatedAt: new Date(), updatedBy: user?.email || '' };
      await updateDoc(doc(db, 'komitmen', selectedApprovalItem.id), data);
      toast.success(`Komitmen ${selectedApprovalItem.idPaketMonitoring} berhasil disetujui!`);
      try { await addNotification(selectedApprovalItem.idUser, 'success', 'Komitmen Disetujui', `Komitmen "${selectedApprovalItem.namaPaket}" telah disetujui`, { komitmenId: selectedApprovalItem.id, action: 'approved' }); } catch { }
      setShowApprovalModal(false); setSelectedApprovalItem(null); setApprovalNote('');
      setKomitmenList((prev) => prev.map((k) => k.id === selectedApprovalItem.id ? { ...k, ...data } : k));
    } catch (error) { toast.error('Gagal menyetujui komitmen: ' + error.message); }
    finally { setLoading(false); }
  };

  const handleReject = async () => {
    if (!selectedApprovalItem) return;
    if (!approvalNote?.trim()) { toast.error('Alasan penolakan wajib diisi'); return; }
    setLoading(true);
    try {
      const data = { approvalStatus: 'rejected', approvedBy: user?.email || 'Admin', approvedAt: new Date(), approvalNote, rejectedBy: user?.email || 'Admin', rejectedAt: new Date(), updatedAt: new Date(), updatedBy: user?.email || '' };
      await updateDoc(doc(db, 'komitmen', selectedApprovalItem.id), data);
      toast.success(`Komitmen ${selectedApprovalItem.idPaketMonitoring} ditolak.`);
      try { await addNotification(selectedApprovalItem.idUser, 'warning', 'Komitmen Ditolak', `Komitmen "${selectedApprovalItem.namaPaket}" ditolak.`, { komitmenId: selectedApprovalItem.id, action: 'rejected', reason: approvalNote }); } catch { }
      setShowApprovalModal(false); setSelectedApprovalItem(null); setApprovalNote('');
      setKomitmenList((prev) => prev.map((k) => k.id === selectedApprovalItem.id ? { ...k, ...data } : k));
    } catch (error) { toast.error('Gagal menolak komitmen: ' + error.message); }
    finally { setLoading(false); }
  };

  const handleMarkAsCompleted = async (item) => {
    if (!window.confirm(`Tandai "${item.namaPaket}" sebagai SELESAI?`)) return;
    try {
      setLoading(true);
      const data = { status: 'selesai', completedBy: user.email, completedAt: new Date(), updatedAt: new Date(), updatedBy: user?.email || '' };
      await updateDoc(doc(db, 'komitmen', item.id), data);
      if (item.idUser) await addNotification(item.idUser, 'success', 'Komitmen Selesai', `Paket "${item.namaPaket}" telah ditandai SELESAI.`, { komitmenId: item.id, action: 'completed' });
      toast.success('Komitmen berhasil ditandai sebagai SELESAI');
      setKomitmenList((prev) => prev.map((k) => k.id === item.id ? { ...k, ...data } : k));
    } catch { toast.error('Gagal menandai komitmen sebagai selesai'); }
    finally { setLoading(false); }
  };

  // ── Request Revisi handlers ─────────────────────────────────────────────────
  const handleOpenApproveRevisi = (item) => {
    setSelectedRevisiItem(item); setApproveRevisiNote(''); setShowApproveRevisiModal(true);
  };

  const handleApproveRevisi = async () => {
    if (!selectedRevisiItem) return;
    setSubmittingRevisi(true);
    try {
      const data = { approvalStatus: 'rejected', approvalNote: approveRevisiNote.trim() || 'Revisi disetujui.', rejectedBy: user?.email || 'Admin', rejectedAt: new Date(), revisiApprovedBy: user?.email || 'Admin', revisiApprovedAt: new Date(), updatedAt: new Date(), updatedBy: user?.email || '' };
      await updateDoc(doc(db, 'komitmen', selectedRevisiItem.id), data);
      toast.success(`Request revisi disetujui. PIC dapat mengedit "${selectedRevisiItem.namaPaket}".`);
      try { await addNotification(selectedRevisiItem.idUser, 'warning', 'Request Revisi Disetujui', `Request revisi untuk "${selectedRevisiItem.namaPaket}" disetujui.`, { komitmenId: selectedRevisiItem.id, action: 'revision_approved' }); } catch { }
      setKomitmenList((prev) => prev.map((k) => k.id === selectedRevisiItem.id ? { ...k, ...data } : k));
      setShowApproveRevisiModal(false); setSelectedRevisiItem(null);
    } catch { toast.error('Gagal memproses request revisi'); }
    finally { setSubmittingRevisi(false); }
  };

  const handleRejectRevisi = async () => {
    if (!selectedRevisiItem) return;
    if (!approveRevisiNote.trim()) { toast.error('Alasan penolakan revisi wajib diisi'); return; }
    setSubmittingRevisi(true);
    try {
      const data = { approvalStatus: 'approved', revisiRejectedNote: approveRevisiNote.trim(), revisiRejectedBy: user?.email || 'Admin', revisiRejectedAt: new Date(), revisiNote: '', updatedAt: new Date(), updatedBy: user?.email || '' };
      await updateDoc(doc(db, 'komitmen', selectedRevisiItem.id), data);
      toast.success('Request revisi ditolak. Status kembali ke Approved.');
      try { await addNotification(selectedRevisiItem.idUser, 'info', 'Request Revisi Ditolak', `Request revisi untuk "${selectedRevisiItem.namaPaket}" ditolak.`, { komitmenId: selectedRevisiItem.id, action: 'revision_rejected', reason: approveRevisiNote.trim() }); } catch { }
      setKomitmenList((prev) => prev.map((k) => k.id === selectedRevisiItem.id ? { ...k, ...data } : k));
      setShowApproveRevisiModal(false); setSelectedRevisiItem(null);
    } catch { toast.error('Gagal menolak request revisi'); }
    finally { setSubmittingRevisi(false); }
  };

  // ── Badge helper ────────────────────────────────────────────────────────────
  const renderApprovalBadge = (item) => {
    if (item.status === 'selesai') return <Badge bg="dark">Selesai</Badge>;
    switch (item.approvalStatus) {
      case 'approved':           return <Badge bg="success">Approved</Badge>;
      case 'rejected':           return <Badge bg="danger">Rejected</Badge>;
      case 'rejected_gm':        return <Badge bg="danger">Ditolak GM</Badge>;
      case 'pending_gm':         return <Badge bg="info" className="text-dark">Menunggu GM</Badge>;
      case 'pending_admin':      return <Badge bg="warning" className="text-dark">Menunggu Admin</Badge>;
      case 'revision_requested': return <Badge bg="warning" className="text-dark">Request Revisi</Badge>;
      default:                   return <Badge bg="secondary">Pending</Badge>;
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <NavigationBar />
      <div className="d-flex">
        <Sidebar />
        <Container fluid style={{ marginLeft: '250px', paddingTop: '100px', paddingLeft: '1.5rem', paddingRight: '1.5rem', paddingBottom: '1.5rem', minHeight: '100vh' }}>
          <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover limit={3} transition={Slide} />

          {/* ── Header card ── */}
          <Card className="shadow-sm mb-4">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h2 className="fw-bold mb-1">Manajemen Komitmen</h2>
                  <p className="text-muted mb-0">Kelola semua data komitmen dan realisasi — semua AP</p>
                </div>
                <div className="d-flex gap-2 flex-wrap">
                  <Button variant="success" size="sm" onClick={() => setShowFormModal(true)}><FaPlus className="me-1" /> Tambah</Button>
                  <Button variant="primary" size="sm" onClick={handleExport}><FaFileExport className="me-1" /> Export</Button>
                  <Button variant="info" size="sm" onClick={() => { const a = document.createElement('a'); a.href = '/templates/Template_Import_Komitmen_Awal.xlsx'; a.download = 'Template_Import_Komitmen_Awal.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); toast.success('Template didownload!'); }}>
                    <FaDownload className="me-1" /> Template
                  </Button>
                  <Button variant="warning" size="sm" onClick={() => fileInputRef.current?.click()}><FaFileImport className="me-1" /> Import</Button>
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} style={{ display: 'none' }} />
                </div>
              </div>

              {/* Filters */}
              <Row className="mb-3">
                <Col md={6}>
                  <InputGroup>
                    <InputGroup.Text><FaSearch /></InputGroup.Text>
                    <Form.Control placeholder="Cari Nama Paket, AP, atau ID Paket..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </InputGroup>
                </Col>
                <Col md={3}>
                  <Form.Select value={filterApprovalStatus} onChange={(e) => setFilterApprovalStatus(e.target.value)}>
                    <option value="all">Semua Status</option>
                    <option value="pending_gm">Menunggu GM</option>
                    <option value="pending_admin">Menunggu Admin</option>
                    <option value="approved">Approved</option>
                    <option value="revision_requested">Request Revisi</option>
                    <option value="rejected">Rejected</option>
                    <option value="rejected_gm">Ditolak GM</option>
                    <option value="selesai">Selesai</option>
                  </Form.Select>
                </Col>
              </Row>

              {/* Table */}
              {loading ? (
                <div className="text-center py-5"><Spinner animation="border" variant="primary" /><p className="mt-2">Loading...</p></div>
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
                          <td>
                            {item.jenisPaket === 'Multi Year (MY)'
                              ? <span className="text-primary fw-bold">{formatCurrency(item.komitmenKeseluruhan)}</span>
                              : <span className="text-success fw-bold">{formatCurrency(item.nilaiKomitmen)}</span>}
                          </td>
                          <td>{formatCurrency(item.nilaiKomitmen)}</td>
                          <td>{formatCurrency((item.rencanaDetail || []).reduce((s, d) => s + (d.nilaiRencana || 0), 0))}</td>
                          <td>{item.nilaiKontrakKeseluruhan > 0 ? <span className="text-info fw-bold">{formatCurrency(item.nilaiKontrakKeseluruhan)}</span> : <span className="text-muted">-</span>}</td>
                          <td><span className="text-success fw-bold">{formatCurrency(item.realisasi)}</span></td>
                          <td>{renderApprovalBadge(item)}</td>
                          <td>
                            <div className="d-flex flex-wrap gap-1">
                              <Button variant="info"    size="sm" onClick={() => { setSelectedKomitmen(item); setShowDetailModal(true); }} title="Detail"><FaEye /></Button>
                              <Button variant="warning" size="sm" onClick={() => handleEdit(item)} title="Edit"><FaEdit /></Button>
                              <Button variant="danger"  size="sm" onClick={() => handleDelete(item.id)} title="Hapus"><FaTrash /></Button>
                              {item.approvalStatus === 'pending_admin' && item.status !== 'selesai' && (
                                <>
                                  <Button variant="success" size="sm" onClick={() => handleOpenApproval(item, 'approve')} title="Approve"><FaCheckCircle /></Button>
                                  <Button variant="danger"  size="sm" onClick={() => handleOpenApproval(item, 'reject')}  title="Reject"><FaTimesCircle /></Button>
                                </>
                              )}
                              {item.approvalStatus === 'approved' && item.status !== 'selesai' && (
                                <Button variant="dark" size="sm" onClick={() => handleMarkAsCompleted(item)}>Selesai</Button>
                              )}
                              {item.approvalStatus === 'revision_requested' && (
                                <Button variant="warning" size="sm" onClick={() => handleOpenApproveRevisi(item)}><FaUndo className="me-1" /> Revisi</Button>
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

      {/* ── Modal Preview Import ── */}
      <Modal show={showImportModal} onHide={() => setShowImportModal(false)} size="xl" centered>
        <Modal.Header closeButton><Modal.Title>Preview Import Data — Semua AP</Modal.Title></Modal.Header>
        <Modal.Body style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {importErrors.length > 0 && (
            <Alert variant="danger">
              <strong>Ditemukan {importErrors.length} error:</strong>
              <ul className="mb-0 mt-2">{importErrors.slice(0, 10).map((err, i) => <li key={i}>{err}</li>)}{importErrors.length > 10 && <li>... dan {importErrors.length - 10} error lainnya</li>}</ul>
            </Alert>
          )}
          <Alert variant="info">
            <strong>Total data:</strong> {importPreview.length} baris akan diimport
            <br /><small className="text-muted">Field opsional dapat dilengkapi via Edit setelah import.</small>
          </Alert>
          <Table striped bordered hover size="sm">
            <thead><tr><th>#</th><th>ID Paket</th><th>Nama Paket</th><th>AP</th><th>Komitmen</th><th>Jenis</th></tr></thead>
            <tbody>
              {importPreview.slice(0, 20).map((item, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td><small>{item['ID Paket Monitoring'] || 'Auto'}</small></td>
                  <td>{item['Nama Paket']}</td>
                  <td><small>{item['Nama AP']}</small></td>
                  <td>{formatCurrency(typeof item['Nilai Komitmen'] === 'number' ? item['Nilai Komitmen'] : parseRupiahInput(String(item['Nilai Komitmen'] || '0')))}</td>
                  <td><small>{item['Jenis Paket']}</small></td>
                </tr>
              ))}
              {importPreview.length > 20 && <tr><td colSpan="6" className="text-center text-muted">... dan {importPreview.length - 20} baris lainnya</td></tr>}
            </tbody>
          </Table>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowImportModal(false)}>Batal</Button>
          <Button variant="primary" onClick={handleImportConfirm} disabled={importing || importErrors.length > 0}>
            {importing ? <><Spinner animation="border" size="sm" className="me-2" />Importing...</> : <>Import {importPreview.length} Data</>}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Form Modal ── */}
      <KomitmenFormModal
        show={showFormModal} onHide={handleCloseFormModal} editMode={editMode}
        isAddingNewRealisasi={isAddingNewRealisasi} loading={loading}
        formData={formData} setFormData={setFormData}
        realisasiRows={realisasiRows} rencanaRows={rencanaRows}
        masterAPList={masterAPList} role="admin"
        createdByName={user?.nama || user?.username || ''}
        handleSubmit={handleSubmit} handleFormChange={handleFormChange} handleRupiahChange={handleRupiahChange}
        handleRealisasiChange={handleRealisasiChange} handleRealisasiRupiahChange={handleRealisasiRupiahChange}
        addRealisasiRow={addRealisasiRow} removeRealisasiRow={removeRealisasiRow}
        handleRencanaChange={handleRencanaChange} handleRencanaRupiahChange={handleRencanaRupiahChange}
        addRencanaRow={addRencanaRow} removeRencanaRow={removeRencanaRow}
        handleNewRealisasi={handleNewRealisasi} handleCancelNewRealisasi={handleCancelNewRealisasi}
        selectedKomitmen={selectedKomitmen}
      />

      {/* ── Detail Modal ── */}
      <KomitmenDetailModal show={showDetailModal} onHide={() => setShowDetailModal(false)} selectedKomitmen={selectedKomitmen} />

      {/* ── Approval Modal ── */}
      <Modal show={showApprovalModal} onHide={() => setShowApprovalModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{approvalAction === 'approve' ? 'Approve Komitmen' : 'Reject Komitmen'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedApprovalItem && (
            <>
              <p><strong>ID:</strong> {selectedApprovalItem.idPaketMonitoring}</p>
              <p><strong>Nama Paket:</strong> {selectedApprovalItem.namaPaket}</p>
              <p><strong>Komitmen:</strong> {formatCurrency(selectedApprovalItem.nilaiKomitmen)}</p>
              <hr />
              <Form.Group>
                <Form.Label>{approvalAction === 'approve' ? 'Catatan (Opsional)' : 'Alasan Penolakan *'}</Form.Label>
                <Form.Control as="textarea" rows={3} value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)} placeholder={approvalAction === 'approve' ? 'Catatan opsional...' : 'Jelaskan alasan penolakan...'} />
              </Form.Group>
              {approvalAction === 'reject' && <Alert variant="warning" className="mt-2"><small>Komitmen yang ditolak akan dikembalikan ke PIC untuk diperbaiki.</small></Alert>}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowApprovalModal(false)}>Batal</Button>
          {approvalAction === 'approve'
            ? <Button variant="success" onClick={handleApprove} disabled={loading}>{loading ? <Spinner animation="border" size="sm" /> : <><FaCheckCircle className="me-1" /> Approve</>}</Button>
            : <Button variant="danger"  onClick={handleReject}  disabled={loading}>{loading ? <Spinner animation="border" size="sm" /> : <><FaTimesCircle className="me-1" /> Reject</>}</Button>}
        </Modal.Footer>
      </Modal>

      {/* ── Request Revisi Modal ── */}
      <Modal show={showApproveRevisiModal} onHide={() => setShowApproveRevisiModal(false)} centered>
        <Modal.Header closeButton className="bg-warning">
          <Modal.Title><FaUndo className="me-2" />Proses Request Revisi</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedRevisiItem && (
            <>
              <Alert variant="info" className="mb-3">
                <strong>Paket:</strong> {selectedRevisiItem.namaPaket}<br />
                <strong>ID:</strong> <span className="font-monospace">{selectedRevisiItem.idPaketMonitoring}</span><br />
                <strong>AP:</strong> {selectedRevisiItem.namaAP}
              </Alert>
              <Alert variant="warning" className="mb-3">
                <strong>Alasan Revisi dari PIC:</strong><br />
                <span className="text-dark">{selectedRevisiItem.revisiNote || '-'}</span>
              </Alert>
              <Form.Group className="mb-3">
                <Form.Label>Catatan Admin</Form.Label>
                <Form.Control as="textarea" rows={3} value={approveRevisiNote} onChange={(e) => setApproveRevisiNote(e.target.value)} placeholder="Catatan untuk PIC..." />
              </Form.Group>
              <Alert variant="secondary">
                <small>
                  <strong>Setuju:</strong> Status → <Badge bg="danger">Rejected</Badge> — PIC bisa edit.<br />
                  <strong>Tolak:</strong> Status tetap <Badge bg="success">Approved</Badge>.
                </small>
              </Alert>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowApproveRevisiModal(false)}>Batal</Button>
          <Button variant="danger"  onClick={handleRejectRevisi}  disabled={submittingRevisi}>{submittingRevisi ? <Spinner animation="border" size="sm" /> : <><FaTimesCircle className="me-1" /> Tolak Revisi</>}</Button>
          <Button variant="success" onClick={handleApproveRevisi} disabled={submittingRevisi}>{submittingRevisi ? <Spinner animation="border" size="sm" /> : <><FaCheckCircle className="me-1" /> Setuju Revisi</>}</Button>
        </Modal.Footer>
      </Modal>

      {/* ── Import Wizard — onCancel wajib untuk rollback ── */}
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

export default AdminKomitmen;

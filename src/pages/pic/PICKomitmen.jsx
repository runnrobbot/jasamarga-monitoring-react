import { useState, useEffect, useRef } from 'react';
import { Container, Card, Button, Table, Modal, Form, Badge, Spinner, InputGroup, Alert, Row, Col, Tabs, Tab } from 'react-bootstrap';
import { collection, getDocs, query, orderBy, doc, writeBatch, addDoc, updateDoc, where, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import NavigationBar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import { FaEye, FaFileExport, FaSearch, FaPlus, FaEdit, FaTimes, FaDownload, FaFileImport, FaCheckCircle, FaTimesCircle, FaClock, FaExclamationTriangle, FaUndo } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import * as XLSX from 'xlsx';
import 'react-toastify/dist/ReactToastify.css';

import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { id } from 'date-fns/locale';

import { generateIdPaket, parseExcelBoolean, validateImportData, parseExcelDate } from '../../utils/idGenerator';
import { addNotification } from '../../utils/notificationService';
import { checkAPSchedule, getAPScheduleInfo, formatScheduleStatus } from '../../utils/scheduleValidator';


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
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importErrors, setImportErrors] = useState([]);

  const [scheduleInfo, setScheduleInfo] = useState(null);
  const [scheduleStatus, setScheduleStatus] = useState(null);
  const [scheduleAllowed, setScheduleAllowed] = useState(false);

  const [showImportRealisasiModal, setShowImportRealisasiModal] = useState(false);
  const [importedDataNeedRealisasi, setImportedDataNeedRealisasi] = useState([]);
  const [currentImportIndex, setCurrentImportIndex] = useState(0);

  const { user } = useAuth();
  const [komitmenList, setKomitmenList] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [masterAPList, setMasterAPList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedKomitmen, setSelectedKomitmen] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [userAP, setUserAP] = useState('');

  const [filterApprovalStatus, setFilterApprovalStatus] = useState('all');

  // State untuk fitur Request Revisi
  const [showRevisiModal, setShowRevisiModal] = useState(false);
  const [selectedRevisiItem, setSelectedRevisiItem] = useState(null);
  const [revisiNote, setRevisiNote] = useState('');
  const [submittingRevisi, setSubmittingRevisi] = useState(false);

  const [realisasiRows, setRealisasiRows] = useState([{
    id: Date.now(),
    tahunRealisasi: '',
    bulanRealisasi: '',
    realisasi: '',
    nomorInvoice: '',
    tanggalInvoice: '',
    dokumen: null
  }]);

  const [rencanaRows, setRencanaRows] = useState([{
    id: Date.now(),
    tahunRencana: '',
    nilaiRencana: '',
    bulanRencana: '',
    keterangan: ''
  }]);

  const [isAddingNewRealisasi, setIsAddingNewRealisasi] = useState(false);

  const [formData, setFormData] = useState({
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
    pdnCheckbox: false,
    tkdnCheckbox: false,
    importCheckbox: false,
    targetNilaiTKDN: '',
    nilaiAnggaranBelanja: '',
    nilaiTahunBerjalanPDN: '',
    nilaiKeseluruhanPDN: '',
    nilaiTahunBerjalanTKDN: '',
    nilaiKeseluruhanTKDN: '',
    nilaiTahunBerjalanImport: '',
    nilaiKeseluruhanImport: '',
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
    idUser: ''
  });

  const formatRupiahInput = (value) => {
    if (!value) return '';
    const numericValue = value.replace(/[^\d,]/g, '');
    const parts = numericValue.split(',');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return parts.length > 1 ? `${parts[0]},${parts[1].slice(0, 2)}` : parts[0];
  };

  const parseRupiahInput = (value) => {
    if (!value) return 0;
    const cleanValue = value.replace(/\./g, '').replace(/,/g, '.');
    return parseFloat(cleanValue) || 0;
  };

  const handleRupiahChange = (e, fieldName) => {
    const { value } = e.target;
    const formattedValue = formatRupiahInput(value);
    setFormData(prev => ({
      ...prev,
      [fieldName]: formattedValue
    }));
  };

  const handleRealisasiRupiahChange = (index, fieldName, value) => {
    const formattedValue = formatRupiahInput(value);
    const newRows = [...realisasiRows];
    newRows[index][fieldName] = formattedValue;
    setRealisasiRows(newRows);
  };

  const addRealisasiRow = () => {
    setRealisasiRows([...realisasiRows, {
      id: Date.now(),
      isExisting: false,
      tahunRealisasi: '',
      bulanRealisasi: '',
      realisasi: '',
      nomorInvoice: '',
      tanggalInvoice: '',
      dokumen: null
    }]);
    toast.info('Baris realisasi baru ditambahkan');
  };

  const removeRealisasiRow = (index) => {
    if (realisasiRows.length === 1) {
      toast.warning('Minimal harus ada 1 baris realisasi');
      return;
    }
    const newRows = realisasiRows.filter((_, i) => i !== index);
    setRealisasiRows(newRows);
    toast.info('Baris realisasi dihapus');
  };

  const handleRealisasiChange = (index, field, value) => {
    const newRows = [...realisasiRows];
    newRows[index][field] = value;

    // Auto-set tahunRealisasi & bulanRealisasi dari tanggalInvoice
    if (field === 'tanggalInvoice' && value) {
      const d = new Date(value);
      if (!isNaN(d)) {
        newRows[index].tahunRealisasi = d.getFullYear().toString();
        newRows[index].bulanRealisasi = (d.getMonth() + 1).toString();
      }
    }

    setRealisasiRows(newRows);
  };

  const addRencanaRow = () => {
    setRencanaRows([...rencanaRows, {
      id: Date.now(),
      tahunRencana: '',
      nilaiRencana: '',
      bulanRencana: '',
      keterangan: ''
    }]);
    toast.info('Baris rencana baru ditambahkan');
  };

  const removeRencanaRow = (index) => {
    if (rencanaRows.length === 1) {
      toast.warning('Minimal harus ada 1 baris rencana');
      return;
    }
    const newRows = rencanaRows.filter((_, i) => i !== index);
    setRencanaRows(newRows);
    toast.info('Baris rencana dihapus');
  };

  const handleRencanaChange = (index, field, value) => {
    const newRows = [...rencanaRows];
    newRows[index][field] = value;
    setRencanaRows(newRows);
  };

  const handleRencanaRupiahChange = (index, value) => {
    const formattedValue = formatRupiahInput(value);
    const newRows = [...rencanaRows];
    newRows[index].nilaiRencana = formattedValue;
    setRencanaRows(newRows);
  };

  useEffect(() => {
    const fetchUserAP = async () => {
      try {
        if (user?.uid) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const ap = userData.namaAP || '';
            console.log('User AP found:', ap);
            setUserAP(ap);
          } else {
            console.log('User document not found');
          }
        }
      } catch (error) {
        console.error('Error fetching user AP:', error);
      }
    };

    fetchUserAP();
  }, [user]);

  useEffect(() => {
    fetchMasterAP();
    const unsubscribe = fetchKomitmen();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    filterData();
  }, [searchTerm, filterStatus, filterApprovalStatus, komitmenList, userAP]);

  useEffect(() => {
    if (showFormModal && !editMode && userAP) {
      setFormData(prev => ({
        ...prev,
        namaAP: userAP
      }));
    }
  }, [showFormModal, editMode, userAP]);

  useEffect(() => {
    const totalRealisasiPeriode = realisasiRows.reduce((sum, row) => {
      return sum + parseRupiahInput(row.realisasi);
    }, 0);

    let totalRealisasiKeseluruhan = totalRealisasiPeriode;
    if (isAddingNewRealisasi && editMode && selectedKomitmen) {
      const realisasiLama = selectedKomitmen.realisasi || 0;
      totalRealisasiKeseluruhan = realisasiLama + totalRealisasiPeriode;
    }

    const isMY = formData.jenisPaket === 'Multi Year (MY)';
    const nilaiKontrakValue = parseRupiahInput(formData.nilaiKontrakKeseluruhan);
    const nilaiKomitmenTahunIni = parseRupiahInput(formData.nilaiKomitmen);
    const nilaiKomitmenKeseluruhan = parseRupiahInput(formData.komitmenKeseluruhan);

    let nilaiReferensiKeseluruhan = 0;
    if (isMY) {
      nilaiReferensiKeseluruhan = nilaiKontrakValue > 0 ? nilaiKontrakValue : nilaiKomitmenKeseluruhan;
    } else {
      nilaiReferensiKeseluruhan = nilaiKontrakValue > 0 ? nilaiKontrakValue : nilaiKomitmenTahunIni;
    }

    const progressKeseluruhan = nilaiReferensiKeseluruhan > 0
      ? ((totalRealisasiKeseluruhan / nilaiReferensiKeseluruhan) * 100).toFixed(2)
      : '0';
    const sisaKeseluruhan = nilaiReferensiKeseluruhan - totalRealisasiKeseluruhan;

    setFormData(prev => ({
      ...prev,
      progres: Math.min(parseFloat(progressKeseluruhan), 100).toString(),
      sisaPembayaran: formatRupiahInput(sisaKeseluruhan.toFixed(0))
    }));
  }, [realisasiRows, formData.nilaiKontrakKeseluruhan, formData.nilaiKomitmen, formData.komitmenKeseluruhan, formData.jenisPaket, isAddingNewRealisasi, editMode, selectedKomitmen]);

  useEffect(() => {
    const loadScheduleInfo = async () => {
      if (!userAP || masterAPList.length === 0) {
        setScheduleLoading(false);
        return;
      }
      setScheduleLoading(true);
      try {
        const apData = masterAPList.find(ap => ap.namaAP === userAP);
        const apId = apData?.id;
        const result = await checkAPSchedule(apId, userAP);

        setScheduleAllowed(result.allowed);
        setScheduleInfo(result.schedule);

        if (result.schedule) {
          const status = formatScheduleStatus(result.schedule);
          setScheduleStatus(status);
        }

        if (!result.allowed) {
          showToastOnce(result.message, 'warning');
        } else if (result.remainingDays && result.remainingDays <= 7) {
          showToastOnce(result.message, 'info');
        }

        console.log('📅 Schedule check result:', result);
      } catch (error) {
        console.error('Error loading schedule:', error);
        setScheduleAllowed(true);
        toast.error(
          'Gagal memuat schedule. Silakan refresh atau hubungi admin.',
          { autoClose: 5000 }
        );
      } finally {
        setScheduleLoading(false);
      }
    };

    loadScheduleInfo();
  }, [userAP, masterAPList]);

  useEffect(() => {
    // Hanya jalankan di edit mode (tab realisasi)
    if (editMode) {
      // Hitung total realisasi dari semua row
      const totalRealisasi = realisasiRows.reduce((sum, row) => {
        return sum + parseRupiahInput(row.realisasi);
      }, 0);

      // Auto-set nilai berdasarkan checkbox yang aktif
      if (formData.pdnCheckbox && totalRealisasi > 0) {
        setFormData(prev => ({
          ...prev,
          nilaiPDN: formatRupiahInput(totalRealisasi.toString()),
          nilaiTKDN: '0',
          nilaiImpor: '0'
        }));
      } else if (formData.tkdnCheckbox && totalRealisasi > 0) {
        setFormData(prev => ({
          ...prev,
          nilaiPDN: '0',
          nilaiTKDN: formatRupiahInput(totalRealisasi.toString()),
          nilaiImpor: '0'
        }));
      } else if (formData.importCheckbox && totalRealisasi > 0) {
        setFormData(prev => ({
          ...prev,
          nilaiPDN: '0',
          nilaiTKDN: '0',
          nilaiImpor: formatRupiahInput(totalRealisasi.toString())
        }));
      }
    }
  }, [
    realisasiRows,
    formData.pdnCheckbox,
    formData.tkdnCheckbox,
    formData.importCheckbox,
    editMode
  ]);

  const fetchMasterAP = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'masterAP'));
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(ap => ap.isActive);
      setMasterAPList(data);
    } catch (error) {
      console.error('Error fetching Master AP:', error);
      toast.error('Gagal memuat Master AP');
    }
  };

  const fetchKomitmen = () => {
    setLoading(true);
    const q = query(collection(db, 'komitmen'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const data = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        setKomitmenList(data);
        setLoading(false);
      },
      (error) => {
        toast.error('Gagal memuat data komitmen: ' + error.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  };

  const filterData = () => {
    let filtered = [...komitmenList];

    if (userAP) {
      filtered = filtered.filter(item => item.namaAP === userAP);
    }

    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.namaPaket?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.namaAP?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.idPaketMonitoring?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(item => item.status === filterStatus);
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

  const shouldShowPDNFields = () => formData.pdnCheckbox === true;
  const shouldShowTKDNFields = () => formData.tkdnCheckbox === true;
  const shouldShowImportFields = () => formData.importCheckbox === true;

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === 'pdnCheckbox' || name === 'tkdnCheckbox' || name === 'importCheckbox') {
      if (checked) {
        setFormData(prev => ({
          ...prev,
          pdnCheckbox: name === 'pdnCheckbox',
          tkdnCheckbox: name === 'tkdnCheckbox',
          importCheckbox: name === 'importCheckbox'
        }));
        toast.info(`${name === 'pdnCheckbox' ? 'PDN' : name === 'tkdnCheckbox' ? 'TKDN' : 'Import'} dipilih. Checkbox lain di-uncheck.`);
      } else {
        setFormData(prev => ({
          ...prev,
          [name]: checked
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleCloseFormModal = async () => {
    setShowFormModal(false);
    setEditMode(false);
    setSelectedKomitmen(null);
    setIsAddingNewRealisasi(false);
    setRealisasiRows([{
      id: Date.now(),
      tahunRealisasi: '',
      bulanRealisasi: '',
      realisasi: '',
      nomorInvoice: '',
      tanggalInvoice: '',
      dokumen: null
    }]);
    setRencanaRows([{
      id: Date.now(),
      tahunRencana: '',
      nilaiRencana: '',
      bulanRencana: '',
      keterangan: ''
    }]);
    setFormData({
      idPaketMonitoring: '',
      jenisPaket: 'Single Year (SY)',
      idRUP: '',
      namaAP: userAP,
      namaPaket: '',
      jenisAnggaran: 'Opex',
      jenisPengadaan: 'Barang',
      usulanMetodePemilihan: 'Tender/Seleksi Umum',
      statusPadi: 'Non PaDi',
      nilaiKomitmen: '',
      komitmenKeseluruhan: '',
      waktuPemanfaatanDari: '',
      waktuPemanfaatanSampai: '',
      pdnCheckbox: false,
      tkdnCheckbox: false,
      importCheckbox: false,
      targetNilaiTKDN: '',
      nilaiAnggaranBelanja: '',
      nilaiTahunBerjalanPDN: '',
      nilaiKeseluruhanPDN: '',
      nilaiTahunBerjalanTKDN: '',
      nilaiKeseluruhanTKDN: '',
      nilaiTahunBerjalanImport: '',
      nilaiKeseluruhanImport: '',
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
      idUser: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isRejectedResubmit = editMode && selectedKomitmen?.approvalStatus === 'rejected';

    if (!editMode) {
      try {
        const apData = masterAPList.find(ap => ap.namaAP === userAP);
        const liveCheck = await checkAPSchedule(apData?.id, userAP);

        if (!liveCheck.allowed) {
          toast.error('⚠️ Schedule berubah! ' + liveCheck.message);
          setScheduleAllowed(false);
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error('Live schedule check failed:', error);
      }
    }

    try {
      setLoading(true);

      const checkboxCount = [formData.pdnCheckbox, formData.tkdnCheckbox, formData.importCheckbox].filter(v => v === true).length;
      if (checkboxCount > 1) {
        toast.error('Hanya boleh memilih 1 checkbox (PDN, TKDN, atau Import)');
        setLoading(false);
        return;
      }

      if (!formData.namaPaket || !formData.namaAP || !formData.nilaiKomitmen) {
        toast.error('Mohon lengkapi semua field wajib di Tab Komitmen Awal (Nama Paket, Nama AP, Nilai Komitmen)');
        setLoading(false);
        return;
      }

      // Validasi: Total Rencana tidak boleh melebihi Komitmen Keseluruhan
      const totalRencana = rencanaRows.reduce((sum, row) => sum + parseRupiahInput(row.nilaiRencana), 0);
      const nilaiKomitmenKeseluruhan = parseRupiahInput(formData.komitmenKeseluruhan);
      const nilaiKomitmenTahunIni = parseRupiahInput(formData.nilaiKomitmen);
      const referensiKomitmen = nilaiKomitmenKeseluruhan > 0 ? nilaiKomitmenKeseluruhan : nilaiKomitmenTahunIni;

      if (totalRencana > referensiKomitmen && referensiKomitmen > 0) {
        const selisih = totalRencana - referensiKomitmen;
        toast.error(
          `Total Rencana Realisasi (${formatCurrency(totalRencana)}) melebihi ` +
          `${nilaiKomitmenKeseluruhan > 0 ? 'Komitmen Keseluruhan' : 'Komitmen Tahun Berjalan'} ` +
          `(${formatCurrency(referensiKomitmen)}) sebesar ${formatCurrency(selisih)}. ` +
          `Kurangi nilai rencana sebelum menyimpan.`,
          { autoClose: 8000 }
        );
        setLoading(false);
        return;
      }

      if (formData.pdnCheckbox) {
        if (!formData.nilaiTahunBerjalanPDN || !formData.nilaiKeseluruhanPDN) {
          toast.error('Nilai Tahun Berjalan PDN dan Nilai Keseluruhan PDN wajib diisi');
          setLoading(false);
          return;
        }
      }

      if (formData.tkdnCheckbox) {
        if (!formData.nilaiTahunBerjalanTKDN || !formData.nilaiKeseluruhanTKDN) {
          toast.error('Nilai Tahun Berjalan TKDN dan Nilai Keseluruhan TKDN wajib diisi');
          setLoading(false);
          return;
        }
      }

      if (formData.importCheckbox) {
        if (!formData.nilaiTahunBerjalanImport || !formData.nilaiKeseluruhanImport) {
          toast.error('Nilai Tahun Berjalan Import dan Nilai Keseluruhan Import wajib diisi');
          setLoading(false);
          return;
        }
      }

      if (editMode) {
        if (!isRejectedResubmit) {
          const hasRealisasiData = realisasiRows.some(row =>
            row.realisasi && parseRupiahInput(row.realisasi) > 0
          );

          if (!hasRealisasiData) {
            toast.error('Mohon isi minimal 1 baris Detail Realisasi per Periode di Tab Realisasi');
            setLoading(false);
            return;
          }

          if (hasRealisasiData) {
            const invalidRealisasiRow = realisasiRows.find((row, index) => {
              const hasAmount = row.realisasi && parseRupiahInput(row.realisasi) > 0;
              if (hasAmount) {
                if (!row.bulanRealisasi || !row.nomorInvoice) {
                  toast.error(`Baris realisasi ${index + 1}: Bulan dan Nomor Invoice wajib diisi jika ada nilai realisasi`);
                  return true;
                }
              }
              return false;
            });

            if (invalidRealisasiRow) {
              setLoading(false);
              return;
            }
          }

          if (hasRealisasiData && !formData.namaPenyedia) {
            toast.error('Nama Penyedia wajib diisi di Tab Realisasi');
            setLoading(false);
            return;
          }

          if (hasRealisasiData && !formData.nilaiKontrakKeseluruhan) {
            toast.error('Nilai Kontrak Keseluruhan wajib diisi di Tab Realisasi');
            setLoading(false);
            return;
          }

          if (isAddingNewRealisasi) {
            const newRows = realisasiRows.filter((row) => {
              const isExistingRow = selectedKomitmen?.realisasiDetail?.some(
                detail => detail.bulanRealisasi === row.bulanRealisasi &&
                  detail.nomorInvoice === row.nomorInvoice &&
                  detail.tanggalInvoice === row.tanggalInvoice
              );
              return !isExistingRow;
            });

            const invalidNewRow = newRows.find((row) => {
              const hasAmount = row.realisasi && parseRupiahInput(row.realisasi) > 0;
              if (hasAmount && (!row.bulanRealisasi || !row.nomorInvoice)) {
                toast.error(`Baris realisasi baru: Bulan dan Nomor Invoice wajib diisi`);
                return true;
              }
              return false;
            });

            if (invalidNewRow) {
              setLoading(false);
              return;
            }
          }
        }
      }

      const selectedAP = masterAPList.find(ap => ap.namaAP === formData.namaAP);
      if (!selectedAP) {
        toast.error('AP tidak ditemukan di Master Data');
        setLoading(false);
        return;
      }

      let idPaket = formData.idPaketMonitoring;

      if (!editMode || !idPaket) {
        idPaket = await generateIdPaket(formData.jenisPaket, selectedAP.singkatanAP);
      }

      const dataToSave = {
        idPaketMonitoring: idPaket,
        jenisPaket: formData.jenisPaket,
        idRUP: formData.idRUP,
        namaAP: formData.namaAP,
        namaPaket: formData.namaPaket,
        jenisAnggaran: formData.jenisAnggaran,
        jenisPengadaan: formData.jenisPengadaan,
        usulanMetodePemilihan: formData.usulanMetodePemilihan,
        statusPadi: formData.statusPadi,
        nilaiKomitmen: parseRupiahInput(formData.nilaiKomitmen),
        komitmenKeseluruhan: parseRupiahInput(formData.komitmenKeseluruhan),
        waktuPemanfaatanDari: formData.waktuPemanfaatanDari,
        waktuPemanfaatanSampai: formData.waktuPemanfaatanSampai,
        rencanaDetail: rencanaRows.map(row => ({
          tahunRencana: row.tahunRencana || '',
          nilaiRencana: parseRupiahInput(row.nilaiRencana),
          bulanRencana: row.bulanRencana,
          keterangan: row.keterangan
        })),
        pdnCheckbox: formData.pdnCheckbox,
        tkdnCheckbox: formData.tkdnCheckbox,
        importCheckbox: formData.importCheckbox,
        targetNilaiTKDN: parseRupiahInput(formData.targetNilaiTKDN),
        nilaiAnggaranBelanja: parseRupiahInput(formData.nilaiAnggaranBelanja),
        nilaiTahunBerjalanPDN: parseRupiahInput(formData.nilaiTahunBerjalanPDN),
        nilaiKeseluruhanPDN: parseRupiahInput(formData.nilaiKeseluruhanPDN),
        nilaiTahunBerjalanTKDN: parseRupiahInput(formData.nilaiTahunBerjalanTKDN),
        nilaiKeseluruhanTKDN: parseRupiahInput(formData.nilaiKeseluruhanTKDN),
        nilaiTahunBerjalanImport: parseRupiahInput(formData.nilaiTahunBerjalanImport),
        nilaiKeseluruhanImport: parseRupiahInput(formData.nilaiKeseluruhanImport),
        catatanKomitmen: formData.catatanKomitmen,
        status: 'draft',
        isActive: formData.isActive,
        idUser: user?.uid || '',
        updatedAt: new Date(),
        updatedBy: user?.email || user?.displayName || ''
      };

      if (editMode) {
        const totalRealisasi = realisasiRows.reduce((sum, row) => {
          return sum + parseRupiahInput(row.realisasi);
        }, 0);

        dataToSave.realisasi = totalRealisasi;
        dataToSave.realisasiDetail = realisasiRows.map(row => ({
          tahunRealisasi: row.tahunRealisasi,
          bulanRealisasi: row.bulanRealisasi,
          realisasi: parseRupiahInput(row.realisasi),
          nomorInvoice: row.nomorInvoice,
          tanggalInvoice: row.tanggalInvoice,
          dokumen: row.dokumen,
          namaPenyedia: row.namaPenyedia || formData.namaPenyedia
        }));
        dataToSave.nilaiKontrakKeseluruhan = parseRupiahInput(formData.nilaiKontrakKeseluruhan);
        dataToSave.namaPenyedia = formData.namaPenyedia;
        dataToSave.kualifikasiPenyedia = formData.kualifikasiPenyedia;
        dataToSave.nilaiPDN = parseRupiahInput(formData.nilaiPDN);
        dataToSave.nilaiTKDN = parseRupiahInput(formData.nilaiTKDN);
        dataToSave.nilaiImpor = parseRupiahInput(formData.nilaiImpor);
        dataToSave.namaPengadaanRealisasi = formData.namaPengadaanRealisasi;
        dataToSave.metodePemilihanRealisasi = formData.metodePemilihanRealisasi;
        dataToSave.progres = formData.progres;
        dataToSave.sisaPembayaran = parseRupiahInput(formData.sisaPembayaran);
        dataToSave.keterangan = formData.keterangan;
      } else {
        dataToSave.realisasi = 0;
        dataToSave.realisasiDetail = [];
        dataToSave.progres = '0';
        dataToSave.sisaPembayaran = parseRupiahInput(formData.nilaiKomitmen);
      }

      if (!editMode) {
        dataToSave.createdAt = new Date();
        dataToSave.createdBy = user?.email || user?.displayName || '';
        dataToSave.approvalStatus = 'draft';
      }

      Object.keys(dataToSave).forEach(key => {
        if (dataToSave[key] === undefined) {
          delete dataToSave[key];
        }
      });

      if (editMode && selectedKomitmen?.id) {
        if (isRejectedResubmit) {
          const preservedRealisasiData = {};
          if (selectedKomitmen.realisasiDetail && selectedKomitmen.realisasiDetail.length > 0) {
            preservedRealisasiData.realisasi = selectedKomitmen.realisasi;
            preservedRealisasiData.realisasiDetail = selectedKomitmen.realisasiDetail;
            preservedRealisasiData.nilaiKontrakKeseluruhan = selectedKomitmen.nilaiKontrakKeseluruhan;
            preservedRealisasiData.namaPenyedia = selectedKomitmen.namaPenyedia;
            preservedRealisasiData.kualifikasiPenyedia = selectedKomitmen.kualifikasiPenyedia;
            preservedRealisasiData.nilaiPDN = selectedKomitmen.nilaiPDN;
            preservedRealisasiData.nilaiTKDN = selectedKomitmen.nilaiTKDN;
            preservedRealisasiData.nilaiImpor = selectedKomitmen.nilaiImpor;
            preservedRealisasiData.namaPengadaanRealisasi = selectedKomitmen.namaPengadaanRealisasi;
            preservedRealisasiData.metodePemilihanRealisasi = selectedKomitmen.metodePemilihanRealisasi;
            preservedRealisasiData.progres = selectedKomitmen.progres;
            preservedRealisasiData.sisaPembayaran = selectedKomitmen.sisaPembayaran;
            preservedRealisasiData.keterangan = selectedKomitmen.keterangan;
          }

          const resubmitData = {
            ...dataToSave,
            ...preservedRealisasiData,
            approvalStatus: 'draft',
            approvedBy: '',
            approvedAt: null,
            approvalNote: '',
            rejectedBy: '',
            rejectedAt: null,
            updatedAt: new Date(),
            updatedBy: user?.email || user?.displayName || ''
          };

          await updateDoc(doc(db, 'komitmen', selectedKomitmen.id), resubmitData);
          toast.success('Data berhasil diperbaiki dan dikirim ulang untuk approval!');

          setKomitmenList(prev => prev.map(k =>
            k.id === selectedKomitmen.id ? { ...k, ...resubmitData } : k
          ));

          try {
            await addNotification(
              user?.uid || '',
              'info',
              'Komitmen Resubmit',
              `Komitmen "${formData.namaPaket}" telah diperbaiki dan menunggu approval ulang`,
              {
                komitmenId: selectedKomitmen.id,
                action: 'resubmit',
                previousStatus: 'rejected'
              }
            );
          } catch (notifError) {
            console.error('Error sending notification:', notifError);
          }
        } else if (isAddingNewRealisasi) {
          const existingRealisasi = selectedKomitmen.realisasiDetail || [];

          const newRealisasiDetail = [
            ...existingRealisasi.map(row => ({
              ...row,
              namaPenyedia: row.namaPenyedia || selectedKomitmen.namaPenyedia || ''
            })),
            ...realisasiRows.map(row => ({
              tahunRealisasi: row.tahunRealisasi,
              bulanRealisasi: row.bulanRealisasi,
              realisasi: parseRupiahInput(row.realisasi),
              nomorInvoice: row.nomorInvoice,
              tanggalInvoice: row.tanggalInvoice,
              dokumen: row.dokumen ? row.dokumen.name : null,
              namaPengadaanRealisasi: formData.namaPengadaanRealisasi,
              metodePemilihanRealisasi: formData.metodePemilihanRealisasi,
              kualifikasiPenyedia: formData.kualifikasiPenyedia,
              namaPenyedia: formData.namaPenyedia
            }))
          ];

          const totalRealisasiBaru = newRealisasiDetail.reduce((sum, detail) => {
            return sum + (detail.realisasi || 0);
          }, 0);

          const isMY = formData.jenisPaket === 'Multi Year (MY)';
          const nilaiKontrakValue = parseRupiahInput(formData.nilaiKontrakKeseluruhan);
          const nilaiKomitmenTahunIni = parseRupiahInput(formData.nilaiKomitmen);
          const nilaiKomitmenKeseluruhan = parseRupiahInput(formData.komitmenKeseluruhan);

          let nilaiReferensiKeseluruhan = 0;
          if (isMY) {
            nilaiReferensiKeseluruhan = nilaiKontrakValue > 0 ? nilaiKontrakValue : nilaiKomitmenKeseluruhan;
          } else {
            nilaiReferensiKeseluruhan = nilaiKontrakValue > 0 ? nilaiKontrakValue : nilaiKomitmenTahunIni;
          }

          const progressBaru = nilaiReferensiKeseluruhan > 0
            ? ((totalRealisasiBaru / nilaiReferensiKeseluruhan) * 100).toFixed(2)
            : '0';
          const sisaBaru = nilaiReferensiKeseluruhan - totalRealisasiBaru;

          const updateData = {
            realisasiDetail: newRealisasiDetail,
            realisasi: totalRealisasiBaru,
            progres: Math.min(parseFloat(progressBaru), 100).toString(),
            sisaPembayaran: sisaBaru,
            nilaiKontrakKeseluruhan: nilaiKontrakValue,
            nilaiPDN: parseRupiahInput(formData.nilaiPDN),
            nilaiTKDN: parseRupiahInput(formData.nilaiTKDN),
            nilaiImpor: parseRupiahInput(formData.nilaiImpor),
            keterangan: formData.keterangan,
            updatedAt: new Date(),
            updatedBy: user?.email || user?.displayName || '',
            needRealisasi: false,
            namaPenyedia: formData.namaPenyedia,
            kualifikasiPenyedia: formData.kualifikasiPenyedia,
            namaPengadaanRealisasi: formData.namaPengadaanRealisasi,
            metodePemilihanRealisasi: formData.metodePemilihanRealisasi
          };

          Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined) {
              delete updateData[key];
            }
          });

          await updateDoc(doc(db, 'komitmen', selectedKomitmen.id), updateData);
          toast.success('Realisasi baru berhasil ditambahkan!');
          setIsAddingNewRealisasi(false);

          setKomitmenList(prev => prev.map(k =>
            k.id === selectedKomitmen.id ? { ...k, ...updateData } : k
          ));

          try {
            await addNotification(
              user?.uid || '',
              'success',
              'Realisasi Baru Ditambahkan',
              `Realisasi baru untuk komitmen "${formData.namaPaket}" berhasil ditambahkan`,
              {
                komitmenId: selectedKomitmen.id,
                action: 'add_realisasi',
                totalRealisasi: totalRealisasiBaru
              }
            );
          } catch (notifError) {
            console.error('Error sending notification:', notifError);
          }

        } else {
          const updateData = {
            realisasiDetail: dataToSave.realisasiDetail,
            realisasi: dataToSave.realisasi,
            progres: dataToSave.progres,
            sisaPembayaran: dataToSave.sisaPembayaran,
            nilaiKontrakKeseluruhan: dataToSave.nilaiKontrakKeseluruhan,
            nilaiPDN: dataToSave.nilaiPDN,
            nilaiTKDN: dataToSave.nilaiTKDN,
            nilaiImpor: dataToSave.nilaiImpor,
            namaPengadaanRealisasi: dataToSave.namaPengadaanRealisasi,
            metodePemilihanRealisasi: dataToSave.metodePemilihanRealisasi,
            keterangan: dataToSave.keterangan,
            kualifikasiPenyedia: dataToSave.kualifikasiPenyedia,
            namaPenyedia: dataToSave.namaPenyedia,
            updatedAt: dataToSave.updatedAt,
            updatedBy: dataToSave.updatedBy,
            needRealisasi: false
          };

          Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined) {
              delete updateData[key];
            }
          });

          await updateDoc(doc(db, 'komitmen', selectedKomitmen.id), updateData);
          toast.success('Data realisasi berhasil diupdate');

          setKomitmenList(prev => prev.map(k =>
            k.id === selectedKomitmen.id ? { ...k, ...updateData } : k
          ));

          try {
            await addNotification(
              user?.uid || '',
              'info',
              'Realisasi Diupdate',
              `Realisasi komitmen "${formData.namaPaket}" telah diupdate`,
              {
                komitmenId: selectedKomitmen.id,
                action: 'update_realisasi'
              }
            );
          } catch (notifError) {
            console.error('Error sending notification:', notifError);
          }
        }

      } else {
        const docRef = await addDoc(collection(db, 'komitmen'), dataToSave);
        toast.success('Komitmen baru berhasil ditambahkan');
        setKomitmenList(prev => [{ id: docRef.id, ...dataToSave }, ...prev]);

        try {
          await addNotification(
            user?.uid || '',
            'success',
            'Komitmen Baru Dibuat',
            `Komitmen "${formData.namaPaket}" berhasil ditambahkan`,
            {
              action: 'create',
              namaPaket: formData.namaPaket,
              namaAP: formData.namaAP
            }
          );
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
        }
      }

      handleCloseFormModal();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Terjadi kesalahan saat menyimpan data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (komitmen) => {
    // Cegah edit jika status draft
    if (komitmen.approvalStatus === 'draft') {
      toast.error('Komitmen sedang menunggu approval admin. Anda tidak dapat mengedit saat ini.');
      return;
    }

    // Cegah edit jika sudah selesai
    if (komitmen.status === 'selesai') {
      toast.error('Komitmen yang sudah selesai tidak dapat diedit');
      return;
    }
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
      nilaiTahunBerjalanPDN: formatRupiahInput(komitmen.nilaiTahunBerjalanPDN?.toString() || ''),
      nilaiKeseluruhanPDN: formatRupiahInput(komitmen.nilaiKeseluruhanPDN?.toString() || ''),
      nilaiTahunBerjalanTKDN: formatRupiahInput(komitmen.nilaiTahunBerjalanTKDN?.toString() || ''),
      nilaiKeseluruhanTKDN: formatRupiahInput(komitmen.nilaiKeseluruhanTKDN?.toString() || ''),
      nilaiTahunBerjalanImport: formatRupiahInput(komitmen.nilaiTahunBerjalanImport?.toString() || ''),
      nilaiKeseluruhanImport: formatRupiahInput(komitmen.nilaiKeseluruhanImport?.toString() || ''),
      nilaiPDN: formatRupiahInput(komitmen.nilaiPDN?.toString() || ''),
      nilaiTKDN: formatRupiahInput(komitmen.nilaiTKDN?.toString() || ''),
      nilaiImpor: formatRupiahInput(komitmen.nilaiImpor?.toString() || ''),
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
      idUser: komitmen.idUser || ''
    });

    // FIX: Hapus isExisting: true saat load handleEdit.
    // isExisting hanya digunakan pada mode isAddingNewRealisasi untuk membedakan
    // row lama vs row baru. Saat edit biasa (termasuk flow reject→resubmit→approve),
    // semua row harus bisa diedit setelah status approved.
    if (komitmen.realisasiDetail && komitmen.realisasiDetail.length > 0) {
      setRealisasiRows(komitmen.realisasiDetail.map(detail => ({
        id: Date.now() + Math.random(),
        // isExisting TIDAK di-set di sini agar row tetap editable saat approved
        tahunRealisasi: detail.tahunRealisasi || '',
        bulanRealisasi: detail.bulanRealisasi || '',
        realisasi: formatRupiahInput(detail.realisasi?.toString() || ''),
        nomorInvoice: detail.nomorInvoice || '',
        tanggalInvoice: detail.tanggalInvoice || '',
        dokumen: detail.dokumen || null,
        namaPenyedia: detail.namaPenyedia || ''
      })));
    }

    if (komitmen.rencanaDetail && komitmen.rencanaDetail.length > 0) {
      setRencanaRows(komitmen.rencanaDetail.map(detail => ({
        id: Date.now() + Math.random(),
        tahunRencana: detail.tahunRencana || '',
        nilaiRencana: formatRupiahInput(detail.nilaiRencana?.toString() || ''),
        bulanRencana: detail.bulanRencana || '',
        keterangan: detail.keterangan || ''
      })));
    } else {
      setRencanaRows([{
        id: Date.now(),
        tahunRencana: '',
        nilaiRencana: '',
        bulanRencana: '',
        keterangan: ''
      }]);
    }
    setSelectedKomitmen(komitmen);
    setEditMode(true);
    setShowFormModal(true);
  };

  const handleOpenRevisi = (item) => {
    setSelectedRevisiItem(item);
    setRevisiNote('');
    setShowRevisiModal(true);
  };

  const handleSubmitRevisi = async () => {
    if (!revisiNote || revisiNote.trim() === '') {
      toast.error('Catatan/alasan revisi wajib diisi');
      return;
    }
    if (!selectedRevisiItem) return;

    setSubmittingRevisi(true);
    try {
      const isDraft = selectedRevisiItem.approvalStatus === 'draft';

      // Kalau draft: langsung tarik ke rejected agar bisa edit, tanpa perlu tunggu admin
      // Kalau approved: minta review admin dulu (revision_requested)
      const revisiData = isDraft
        ? {
          approvalStatus: 'rejected',
          approvalNote: `[Ditarik PIC] ${revisiNote.trim()}`,
          rejectedBy: user?.email || user?.displayName || '',
          rejectedAt: new Date(),
          revisiNote: revisiNote.trim(),
          revisiRequestedBy: user?.email || user?.displayName || '',
          revisiRequestedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: user?.email || user?.displayName || ''
        }
        : {
          approvalStatus: 'revision_requested',
          revisiNote: revisiNote.trim(),
          revisiRequestedBy: user?.email || user?.displayName || '',
          revisiRequestedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: user?.email || user?.displayName || ''
        };

      await updateDoc(doc(db, 'komitmen', selectedRevisiItem.id), revisiData);

      if (isDraft) {
        toast.success('Submission berhasil ditarik. Silakan perbaiki dan submit ulang!');
      } else {
        toast.success('Request revisi berhasil dikirim ke admin!');
      }

      setKomitmenList(prev => prev.map(k =>
        k.id === selectedRevisiItem.id ? { ...k, ...revisiData } : k
      ));

      try {
        await addNotification(
          user?.uid || '',
          'info',
          isDraft ? 'Submission Ditarik' : 'Request Revisi Dikirim',
          isDraft
            ? `Komitmen "${selectedRevisiItem.namaPaket}" berhasil ditarik. Silakan edit dan submit ulang.`
            : `Request revisi untuk komitmen "${selectedRevisiItem.namaPaket}" berhasil dikirim ke admin`,
          {
            komitmenId: selectedRevisiItem.id,
            action: isDraft ? 'draft_recalled' : 'revision_requested',
            reason: revisiNote.trim()
          }
        );
      } catch (notifError) {
        console.error('Error sending notification:', notifError);
      }

      setShowRevisiModal(false);
      setSelectedRevisiItem(null);
      setRevisiNote('');
    } catch (error) {
      console.error('Error requesting revision:', error);
      toast.error('Gagal mengirim request revisi: ' + error.message);
    } finally {
      setSubmittingRevisi(false);
    }
  };

  const handleExport = () => {
    const dataToExport = filteredList.map(item => ({
      'ID Paket': item.idPaketMonitoring,
      'Jenis Paket': item.jenisPaket,
      'ID RUP': item.idRUP || '',
      'Nama AP': item.namaAP,
      'Nama Paket': item.namaPaket,
      'Jenis Anggaran': item.jenisAnggaran,
      'Jenis Pengadaan': item.jenisPengadaan,
      'Metode Pemilihan': item.usulanMetodePemilihan,
      'Status PaDi': item.statusPadi,
      'Nilai Komitmen': item.nilaiKomitmen,
      'Komitmen Keseluruhan': item.komitmenKeseluruhan,
      'Waktu Pemanfaatan Dari': item.waktuPemanfaatanDari,
      'Waktu Pemanfaatan Sampai': item.waktuPemanfaatanSampai,
      'Tahun Rencana': item.rencanaDetail?.[0]?.tahunRencana || '',
      'Nilai Rencana': item.rencanaDetail?.[0]?.nilaiRencana || '',
      'Bulan Rencana': item.rencanaDetail?.[0]?.bulanRencana || '',
      'Keterangan Rencana': item.rencanaDetail?.[0]?.keterangan || '',
      'PDN': item.pdnCheckbox ? 'TRUE' : 'FALSE',
      'TKDN': item.tkdnCheckbox ? 'TRUE' : 'FALSE',
      'Import': item.importCheckbox ? 'TRUE' : 'FALSE',
      'Nilai Tahun Berjalan PDN': item.nilaiTahunBerjalanPDN || 0,
      'Nilai Keseluruhan PDN': item.nilaiKeseluruhanPDN || 0,
      'Nilai Tahun Berjalan TKDN': item.nilaiTahunBerjalanTKDN || 0,
      'Nilai Keseluruhan TKDN': item.nilaiKeseluruhanTKDN || 0,
      'Nilai Tahun Berjalan Import': item.nilaiTahunBerjalanImport || 0,
      'Nilai Keseluruhan Import': item.nilaiKeseluruhanImport || 0,
      'Target Nilai TKDN': item.targetNilaiTKDN || 0,
      'Nilai Anggaran Belanja': item.nilaiAnggaranBelanja || 0,
      'Catatan Komitmen': item.catatanKomitmen || '',
      'Realisasi': item.realisasi || 0,
      'Nilai Kontrak': item.nilaiKontrakKeseluruhan || 0,
      'Nama Penyedia': item.namaPenyedia || '',
      'Status': item.status
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
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        const filteredData = data.filter(item => item['Nama AP'] === userAP);

        if (filteredData.length === 0) {
          toast.warning(`Tidak ada data untuk AP: ${userAP}`);
          e.target.value = '';
          return;
        }

        const skippedCount = data.length - filteredData.length;
        if (skippedCount > 0) {
          toast.info(
            `${skippedCount} data dengan AP berbeda dilewati. ` +
            `Hanya ${filteredData.length} data untuk "${userAP}" yang akan diimport.`,
            { autoClose: 5000 }
          );
        }

        const errors = validateImportData(filteredData);
        setImportErrors(errors);
        setImportPreview(filteredData);
        setShowImportModal(true);

      } catch (error) {
        console.error('Error reading file:', error);
        toast.error('Gagal membaca file Excel');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleImportConfirm = async () => {
    if (!scheduleAllowed) {
      toast.error(
        'Periode input sudah ditutup atau belum dibuka. ' +
        'Silakan hubungi administrator.',
        { autoClose: 5000 }
      );
      setShowImportModal(false);
      return;
    }

    try {
      const duplicates = [];
      for (const item of importPreview) {
        const existingQuery = query(
          collection(db, 'komitmen'),
          where('namaPaket', '==', item['Nama Paket'])
        );
        const existingSnapshot = await getDocs(existingQuery);

        if (!existingSnapshot.empty) {
          duplicates.push(item['Nama Paket']);
        }
      }

      if (duplicates.length > 0) {
        toast.error(
          `Import dibatalkan! Ditemukan ${duplicates.length} duplikasi:\n${duplicates.slice(0, 5).join('\n')}${duplicates.length > 5 ? '\n...dan lainnya' : ''}`,
          { autoClose: 15000 }
        );
        setImporting(false);
        return;
      }

      setImporting(true);
      const dataReadyToImport = [];

      for (const item of importPreview) {
        if (item['Nama AP'] !== userAP) {
          console.warn('Skipping data for different AP:', item['Nama AP']);
          continue;
        }

        const selectedAP = masterAPList.find(ap => ap.namaAP === item['Nama AP']);
        if (!selectedAP) {
          console.error('AP tidak ditemukan:', item['Nama AP']);
          continue;
        }

        let idPaket = item['ID Paket Monitoring'];
        if (!idPaket || idPaket.trim() === '') {
          idPaket = await generateIdPaket(
            item['Jenis Paket'],
            selectedAP.singkatanAP
          );
        }

        const dataToImport = {
          idPaketMonitoring: idPaket,
          jenisPaket: item['Jenis Paket'],
          idRUP: item['ID RUP'] || '',
          namaAP: item['Nama AP'],
          namaPaket: item['Nama Paket'],
          jenisAnggaran: item['Jenis Anggaran'],
          jenisPengadaan: item['Jenis Pengadaan'],
          usulanMetodePemilihan: item['Metode Pemilihan'],
          statusPadi: item['Status PaDi'] || 'Non PaDi',
          nilaiKomitmen: parseFloat(item['Nilai Komitmen']) || 0,
          komitmenKeseluruhan: parseFloat(item['Komitmen Keseluruhan']) || 0,
          waktuPemanfaatanDari: parseExcelDate(item['Waktu Pemanfaatan Dari']),
          waktuPemanfaatanSampai: parseExcelDate(item['Waktu Pemanfaatan Sampai']),
          rencanaDetail: item['Nilai Rencana'] && parseFloat(item['Nilai Rencana']) > 0
            ? [{
              tahunRencana: item['Tahun Rencana'] || '',
              nilaiRencana: parseFloat(item['Nilai Rencana']) || 0,
              bulanRencana: item['Bulan Rencana'] || '',
              keterangan: item['Keterangan Rencana'] || ''
            }]
            : [],
          pdnCheckbox: parseExcelBoolean(item['PDN']),
          tkdnCheckbox: parseExcelBoolean(item['TKDN']),
          importCheckbox: parseExcelBoolean(item['Import']),
          nilaiTahunBerjalanPDN: parseFloat(item['Nilai Tahun Berjalan PDN']) || 0,
          nilaiKeseluruhanPDN: parseFloat(item['Nilai Keseluruhan PDN']) || 0,
          nilaiTahunBerjalanTKDN: parseFloat(item['Nilai Tahun Berjalan TKDN']) || 0,
          nilaiKeseluruhanTKDN: parseFloat(item['Nilai Keseluruhan TKDN']) || 0,
          nilaiTahunBerjalanImport: parseFloat(item['Nilai Tahun Berjalan Import']) || 0,
          nilaiKeseluruhanImport: parseFloat(item['Nilai Keseluruhan Import']) || 0,
          targetNilaiTKDN: parseFloat(item['Target Nilai TKDN']) || 0,
          nilaiAnggaranBelanja: parseFloat(item['Nilai Anggaran Belanja']) || 0,
          realisasi: 0,
          realisasiDetail: [],
          nilaiKontrakKeseluruhan: 0,
          namaPenyedia: '',
          kualifikasiPenyedia: 'UMKM',
          nilaiPDN: 0,
          nilaiTKDN: 0,
          nilaiImpor: 0,
          namaPengadaanRealisasi: '',
          metodePemilihanRealisasi: item['Metode Pemilihan'],
          progres: '0',
          sisaPembayaran: parseFloat(item['Nilai Komitmen']) || 0,
          catatanKomitmen: item['Catatan Komitmen'] || '',
          keterangan: '',
          status: item['Status'] || 'active',
          isActive: item['Status'] !== 'inactive',
          idUser: user?.uid || '',
          createdAt: new Date(),
          createdBy: user?.email || user?.displayName || 'Import',
          updatedAt: new Date(),
          updatedBy: user?.email || user?.displayName || 'Import',
          needRealisasi: true
        };

        dataReadyToImport.push(dataToImport);
      }

      const batch = writeBatch(db);
      const savedIds = [];

      for (const dataItem of dataReadyToImport) {
        const docRef = doc(collection(db, 'komitmen'));
        batch.set(docRef, dataItem);
        savedIds.push({ id: docRef.id, ...dataItem });
      }

      await batch.commit();
      toast.success(`${dataReadyToImport.length} data komitmen berhasil diimport!`);

      try {
        await addNotification(
          user?.uid || '',
          'success',
          'Import Data Berhasil',
          `${dataReadyToImport.length} komitmen berhasil diimport. Silakan isi realisasi untuk setiap data.`,
          {
            action: 'import',
            count: dataReadyToImport.length,
            namaAP: userAP
          }
        );
      } catch (notifError) {
        console.error('Error sending notification:', notifError);
      }

      setShowImportModal(false);
      setImportPreview([]);
      setImportErrors([]);

      await fetchKomitmen();

      const needRealisasiData = savedIds.filter(item => item.needRealisasi);
      if (needRealisasiData.length > 0) {
        setImportedDataNeedRealisasi(needRealisasiData);
        setCurrentImportIndex(0);
        setShowImportRealisasiModal(true);
        loadImportedDataToForm(needRealisasiData[0]);
      }

    } catch (error) {
      console.error('Error importing:', error);
      toast.error('Gagal import data');

      try {
        await addNotification(
          user?.uid || '',
          'error',
          'Import Data Gagal',
          `Terjadi kesalahan saat import: ${error.message}`,
          {
            action: 'import_failed',
            error: error.message
          }
        );
      } catch (notifError) {
        console.error('Error sending notification:', notifError);
      }
    } finally {
      setImporting(false);
    }
  };

  const loadImportedDataToForm = (dataItem) => {
    setFormData({
      idPaketMonitoring: dataItem.idPaketMonitoring || '',
      jenisPaket: dataItem.jenisPaket || 'Single Year (SY)',
      idRUP: dataItem.idRUP || '',
      namaAP: dataItem.namaAP || '',
      namaPaket: dataItem.namaPaket || '',
      jenisAnggaran: dataItem.jenisAnggaran || 'Opex',
      jenisPengadaan: dataItem.jenisPengadaan || 'Barang',
      usulanMetodePemilihan: dataItem.usulanMetodePemilihan || 'Tender/Seleksi Umum',
      statusPadi: dataItem.statusPadi || 'Non PaDi',
      nilaiKomitmen: formatRupiahInput(dataItem.nilaiKomitmen?.toString() || ''),
      komitmenKeseluruhan: formatRupiahInput(dataItem.komitmenKeseluruhan?.toString() || ''),
      waktuPemanfaatanDari: dataItem.waktuPemanfaatanDari || '',
      waktuPemanfaatanSampai: dataItem.waktuPemanfaatanSampai || '',
      pdnCheckbox: dataItem.pdnCheckbox || false,
      tkdnCheckbox: dataItem.tkdnCheckbox || false,
      importCheckbox: dataItem.importCheckbox || false,
      targetNilaiTKDN: formatRupiahInput(dataItem.targetNilaiTKDN?.toString() || ''),
      nilaiAnggaranBelanja: formatRupiahInput(dataItem.nilaiAnggaranBelanja?.toString() || ''),
      nilaiKontrakKeseluruhan: '',
      namaPenyedia: '',
      kualifikasiPenyedia: 'UMKM',
      nilaiPDN: '',
      nilaiTKDN: '',
      nilaiImpor: '',
      namaPengadaanRealisasi: '',
      metodePemilihanRealisasi: dataItem.metodePemilihanRealisasi || '',
      progres: '0',
      sisaPembayaran: formatRupiahInput(dataItem.nilaiKomitmen?.toString() || ''),
      catatanKomitmen: dataItem.catatanKomitmen || '',
      keterangan: '',
      status: 'active',
      isActive: true,
      idUser: dataItem.idUser || ''
    });

    setRealisasiRows([{
      id: Date.now(),
      tahunRealisasi: '',
      bulanRealisasi: '',
      realisasi: '',
      nomorInvoice: '',
      tanggalInvoice: '',
      dokumen: null
    }]);
  };

  const handleSaveImportedRealisasi = async () => {
    try {
      setLoading(true);

      const currentData = importedDataNeedRealisasi[currentImportIndex];

      const hasRealisasiData = realisasiRows.some(row =>
        row.realisasi && parseRupiahInput(row.realisasi) > 0
      );

      if (!hasRealisasiData) {
        toast.error('Mohon isi minimal 1 baris Detail Realisasi per Periode');
        setLoading(false);
        return;
      }

      if (hasRealisasiData) {
        const invalidRealisasiRow = realisasiRows.find((row, index) => {
          const hasAmount = row.realisasi && parseRupiahInput(row.realisasi) > 0;
          if (hasAmount) {
            if (!row.bulanRealisasi || !row.nomorInvoice) {
              toast.error(`Baris realisasi ${index + 1}: Bulan dan Nomor Invoice wajib diisi`);
              return true;
            }
          }
          return false;
        });

        if (invalidRealisasiRow) {
          setLoading(false);
          return;
        }
      }

      if (!formData.namaPenyedia) {
        toast.error('Nama Penyedia wajib diisi');
        setLoading(false);
        return;
      }

      const totalRealisasi = realisasiRows.reduce((sum, row) => {
        return sum + parseRupiahInput(row.realisasi);
      }, 0);

      const updateData = {
        realisasi: totalRealisasi,
        realisasiDetail: realisasiRows.map(row => ({
          tahunRealisasi: row.tahunRealisasi,
          bulanRealisasi: row.bulanRealisasi,
          realisasi: parseRupiahInput(row.realisasi),
          nomorInvoice: row.nomorInvoice,
          tanggalInvoice: row.tanggalInvoice,
          dokumen: row.dokumen,
          namaPenyedia: row.namaPenyedia || formData.namaPenyedia
        })),
        namaPenyedia: formData.namaPenyedia,
        kualifikasiPenyedia: formData.kualifikasiPenyedia,
        nilaiPDN: parseRupiahInput(formData.nilaiPDN),
        nilaiTKDN: parseRupiahInput(formData.nilaiTKDN),
        nilaiImpor: parseRupiahInput(formData.nilaiImpor),
        namaPengadaanRealisasi: formData.namaPengadaanRealisasi,
        metodePemilihanRealisasi: formData.metodePemilihanRealisasi,
        progres: formData.progres,
        sisaPembayaran: parseRupiahInput(formData.sisaPembayaran),
        keterangan: formData.keterangan,
        needRealisasi: false,
        updatedAt: new Date(),
        updatedBy: user?.email || user?.displayName || ''
      };

      const komitmenDocs = await getDocs(
        query(collection(db, 'komitmen'), where('idPaketMonitoring', '==', currentData.idPaketMonitoring))
      );

      if (!komitmenDocs.empty) {
        const docId = komitmenDocs.docs[0].id;
        await updateDoc(doc(db, 'komitmen', docId), updateData);
        toast.success(`Realisasi untuk "${currentData.namaPaket}" berhasil disimpan`);

        if (currentImportIndex < importedDataNeedRealisasi.length - 1) {
          const nextIndex = currentImportIndex + 1;
          setCurrentImportIndex(nextIndex);
          loadImportedDataToForm(importedDataNeedRealisasi[nextIndex]);
        } else {
          toast.success('Semua data import berhasil dilengkapi realisasinya!');
          setShowImportRealisasiModal(false);
          setImportedDataNeedRealisasi([]);
          setCurrentImportIndex(0);
          fetchKomitmen();
        }
      }

    } catch (error) {
      console.error('Error saving realisasi:', error);
      toast.error('Gagal menyimpan realisasi');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipImportedRealisasi = () => {
    if (currentImportIndex < importedDataNeedRealisasi.length - 1) {
      const nextIndex = currentImportIndex + 1;
      setCurrentImportIndex(nextIndex);
      loadImportedDataToForm(importedDataNeedRealisasi[nextIndex]);
      toast.info('Dilewati. Anda bisa mengisi realisasi nanti via Edit.');
    } else {
      setShowImportRealisasiModal(false);
      setImportedDataNeedRealisasi([]);
      setCurrentImportIndex(0);
      toast.info('Import selesai. Data yang dilewati bisa diisi realisasi via Edit.');
      fetchKomitmen();
    }
  };

  const formatCurrency = (value) => {
    if (!value) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  const months = [
    { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' }, { value: 4, label: 'April' },
    { value: 5, label: 'Mei' }, { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' }, { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' }, { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' }, { value: 12, label: 'Desember' }
  ];

  const handleNewRealisasi = () => {
    setFormData(prev => ({
      ...prev,
      namaPenyedia: '',
      kualifikasiPenyedia: 'UMKM',
      nilaiPDN: '',
      nilaiTKDN: '',
      nilaiImpor: '',
      namaPengadaanRealisasi: '',
      metodePemilihanRealisasi: formData.usulanMetodePemilihan,
      progres: '0',
      sisaPembayaran: formData.jenisPaket === 'Multi Year (MY)'
        ? formData.komitmenKeseluruhan
        : formData.nilaiKomitmen,
      keterangan: ''
    }));

    setRealisasiRows([{
      id: Date.now(),
      tahunRealisasi: '',
      bulanRealisasi: '',
      realisasi: '',
      nomorInvoice: '',
      tanggalInvoice: '',
      dokumen: null
    }]);

    setIsAddingNewRealisasi(true);
    toast.info('Mode: Tambah Realisasi Baru. Field realisasi telah di-reset.');
  };

  const handleCancelNewRealisasi = () => {
    setIsAddingNewRealisasi(false);

    if (editMode && selectedKomitmen) {
      if (selectedKomitmen.realisasiDetail && selectedKomitmen.realisasiDetail.length > 0) {
        // FIX: Tidak perlu set isExisting di sini juga, agar konsisten
        setRealisasiRows(selectedKomitmen.realisasiDetail.map(detail => ({
          id: Date.now() + Math.random(),
          // isExisting TIDAK di-set agar row tetap editable
          tahunRealisasi: detail.tahunRealisasi || '',
          bulanRealisasi: detail.bulanRealisasi || '',
          realisasi: formatRupiahInput(detail.realisasi?.toString() || ''),
          nomorInvoice: detail.nomorInvoice || '',
          tanggalInvoice: detail.tanggalInvoice || '',
          dokumen: detail.dokumen || null
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
        keterangan: selectedKomitmen.keterangan || ''
      }));
    }

    toast.info('Mode: Edit Realisasi Existing');
  };

  const calculateSummaryPerPeriode = () => {
    const currentYear = new Date().getFullYear().toString();
    const isMY = formData.jenisPaket === 'Multi Year (MY)';

    let rowsForPeriode;
    if (isAddingNewRealisasi) {
      rowsForPeriode = realisasiRows;
    } else if (isMY) {
      const filtered = realisasiRows.filter(row => {
        if (row.tahunRealisasi) return row.tahunRealisasi.toString() === currentYear;
        if (row.tanggalInvoice) return new Date(row.tanggalInvoice).getFullYear().toString() === currentYear;
        return true;
      });
      rowsForPeriode = filtered;
    } else {
      rowsForPeriode = realisasiRows;
    }

    const totalRealisasiPeriode = rowsForPeriode.reduce((sum, row) =>
      sum + parseRupiahInput(row.realisasi), 0
    );
    const nilaiKomitmenTahunIni = parseRupiahInput(formData.nilaiKomitmen);

    const progressRaw = nilaiKomitmenTahunIni > 0
      ? ((totalRealisasiPeriode / nilaiKomitmenTahunIni) * 100).toFixed(2)
      : '0';
    const progress = Math.min(parseFloat(progressRaw), 100).toFixed(2);
    const sisa = nilaiKomitmenTahunIni - totalRealisasiPeriode;

    return {
      progress,
      sisa: formatRupiahInput(sisa.toString()),
      total: formatRupiahInput(totalRealisasiPeriode.toString())
    };
  };

  const calculateSummaryKeseluruhan = () => {
    const totalRealisasiPeriode = realisasiRows.reduce((sum, row) =>
      sum + parseRupiahInput(row.realisasi), 0
    );

    let totalRealisasiKeseluruhan = totalRealisasiPeriode;
    if (isAddingNewRealisasi && editMode && selectedKomitmen) {
      const realisasiLama = selectedKomitmen.realisasi || 0;
      totalRealisasiKeseluruhan = realisasiLama + totalRealisasiPeriode;
    }

    const isMY = formData.jenisPaket === 'Multi Year (MY)';
    const nilaiKontrakValue = parseRupiahInput(formData.nilaiKontrakKeseluruhan);
    const nilaiKomitmenTahunIni = parseRupiahInput(formData.nilaiKomitmen);
    const nilaiKomitmenKeseluruhan = parseRupiahInput(formData.komitmenKeseluruhan);

    let nilaiReferensiKeseluruhan = 0;
    if (isMY) {
      nilaiReferensiKeseluruhan = nilaiKontrakValue > 0 ? nilaiKontrakValue : nilaiKomitmenKeseluruhan;
    } else {
      nilaiReferensiKeseluruhan = nilaiKontrakValue > 0 ? nilaiKontrakValue : nilaiKomitmenTahunIni;
    }

    const progress = nilaiReferensiKeseluruhan > 0
      ? ((totalRealisasiKeseluruhan / nilaiReferensiKeseluruhan) * 100).toFixed(2)
      : '0';
    const sisa = nilaiReferensiKeseluruhan - totalRealisasiKeseluruhan;

    return {
      progress,
      sisa: formatRupiahInput(sisa.toString()),
      total: formatRupiahInput(totalRealisasiKeseluruhan.toString())
    };
  };

  const isKomitmenDisabled = editMode && selectedKomitmen?.approvalStatus !== 'rejected';
  const isRealisasiDisabled = editMode && !isAddingNewRealisasi && selectedKomitmen?.approvalStatus !== 'approved';

  const isInvoiceLunas = (item) => {
    if (item.jenisPaket === 'Multi Year (MY)') {
      const komitmenTotal = item.komitmenKeseluruhan || 0;
      const realisasiTotal = item.realisasi || 0;
      return komitmenTotal > 0 && komitmenTotal === realisasiTotal;
    } else {
      const selisih = (item.nilaiKomitmen || 0) - (item.realisasi || 0);
      return selisih === 0;
    }
  };

  const isTahunBerjalanLunas = (item) => {
    if (item.jenisPaket !== 'Multi Year (MY)') return false;
    const currentYear = new Date().getFullYear().toString();
    const details = item.realisasiDetail || [];
    const realisasiTahunIni = details
      .filter(d => {
        if (d.tahunRealisasi) return d.tahunRealisasi.toString() === currentYear;
        if (d.tanggalInvoice) return new Date(d.tanggalInvoice).getFullYear().toString() === currentYear;
        return false;
      })
      .reduce((sum, d) => sum + (d.realisasi || 0), 0);
    const nilaiKomitmen = item.nilaiKomitmen || 0;
    return nilaiKomitmen > 0 && realisasiTahunIni >= nilaiKomitmen;
  };

  const getTahunBerjalan = (item) => {
    const details = item.realisasiDetail || [];
    if (details.length > 0) {
      for (let i = details.length - 1; i >= 0; i--) {
        if (details[i].tahunRealisasi) return details[i].tahunRealisasi;
        if (details[i].tanggalInvoice) {
          const y = new Date(details[i].tanggalInvoice).getFullYear();
          if (!isNaN(y)) return y;
        }
      }
    }
    return new Date().getFullYear();
  };

  return (
    <>
      <NavigationBar />
      <div className="d-flex">
        <Sidebar />
        <Container
          fluid
          style={{
            marginLeft: '250px',
            paddingTop: '100px',
            paddingLeft: '1.5rem',
            paddingRight: '1.5rem',
            paddingBottom: '1.5rem',
            minHeight: '100vh'
          }}
        >
          <ToastContainer position="top-right" autoClose={3000} />

          <Card className="shadow-sm mb-4">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h2 className="fw-bold mb-1">Manajemen Komitmen</h2>
                  <p className="text-muted mb-0">
                    Kelola data komitmen dan realisasi - <Badge bg="info">AP: {userAP}</Badge>
                    {scheduleStatus && (
                      <Badge bg={scheduleStatus.color} className="ms-2">
                        {scheduleStatus.icon} {scheduleStatus.message}
                      </Badge>
                    )}
                  </p>
                </div>

                <div className="d-flex gap-2">
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => setShowFormModal(true)}
                    disabled={!scheduleAllowed}
                    title={!scheduleAllowed || scheduleLoading ? 'Periode input belum dibuka atau sudah ditutup' : 'Tambah Komitmen'}
                  >
                    <FaPlus className="me-1" /> Tambah Komitmen
                  </Button>
                  <Button
                    variant="info"
                    size="sm"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = '/templates/Template_Import_Komitmen_Awal.xlsx';
                      link.download = 'Template_Import_Komitmen_Awal.xlsx';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      toast.success('Template berhasil didownload!');
                    }}
                  >
                    <FaDownload className="me-1" /> Download Template
                  </Button>
                  <Button
                    variant="warning"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!scheduleAllowed}
                    title={!scheduleAllowed ? 'Periode input belum dibuka atau sudah ditutup' : 'Import Excel'}
                  >
                    <FaFileImport className="me-1" /> Import Excel
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  <Button variant="primary" size="sm" onClick={handleExport}>
                    <FaFileExport className="me-1" /> Export Excel
                  </Button>
                </div>
              </div>
              {scheduleInfo && (
                <Alert
                  variant={scheduleStatus?.color || 'info'}
                  className="mb-3"
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <strong>Status Schedule Input Data:</strong> {scheduleStatus?.message}
                      {scheduleInfo.keterangan && (
                        <>
                          <br />
                          <small className="text-muted">{scheduleInfo.keterangan}</small>
                        </>
                      )}
                    </div>
                    <div className="text-end">
                      <small className="d-block">
                        Buka: {new Date(scheduleInfo.tanggalBuka).toLocaleDateString('id-ID')}
                      </small>
                      <small className="d-block">
                        Tutup: {new Date(scheduleInfo.tanggalTutup).toLocaleDateString('id-ID')}
                      </small>
                    </div>
                  </div>
                </Alert>
              )}

              <Row className="mb-3">
                <Col md={8}>
                  <InputGroup>
                    <InputGroup.Text><FaSearch /></InputGroup.Text>
                    <Form.Control
                      placeholder="Cari berdasarkan Nama Paket atau ID Paket..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </InputGroup>
                </Col>
                <Col md={4}>
                  <Form.Select value={filterApprovalStatus} onChange={(e) => setFilterApprovalStatus(e.target.value)}>
                    <option value="all">Semua Status</option>
                    <option value="draft">Pending Approval</option>
                    <option value="approved">Approved</option>
                    <option value="revision_requested">Request Revisi</option>
                    <option value="rejected">Rejected - Perlu Revisi</option>
                    <option value="selesai">Selesai</option>
                  </Form.Select>
                </Col>
              </Row>

              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                  <p className="mt-2">Loading data...</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table striped bordered hover>
                    <thead className="table-dark">
                      <tr>
                        <th>#</th>
                        <th>ID Paket</th>
                        <th>Nama Paket</th>
                        <th>Jenis</th>
                        <th>Komitmen/Kontrak Keseluruhan</th>
                        <th>Komitmen Tahun Berjalan</th>
                        <th>Total Rencana Realisasi</th>
                        <th>Nilai Kontrak</th>
                        <th>Realisasi</th>
                        <th>Status</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredList.length === 0 ? (
                        <tr>
                          <td colSpan="11" className="text-center">Tidak ada data</td>
                        </tr>
                      ) : (
                        filteredList.map((item, index) => (
                          <tr key={item.id}>
                            <td>{index + 1}</td>
                            <td><small className="font-monospace">{item.idPaketMonitoring}</small></td>
                            <td>{item.namaPaket}</td>
                            <td><Badge bg="info">{item.jenisPaket}</Badge></td>
                            <td>
                              {item.jenisPaket === 'Multi Year (MY)' ? (
                                <span className="text-primary fw-bold">
                                  {formatCurrency(item.komitmenKeseluruhan)}
                                </span>
                              ) : item.jenisPaket === 'Single Year (SY)' ? (
                                <span className="text-success fw-bold">
                                  {formatCurrency(item.nilaiKomitmen)}
                                </span>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            <td>{formatCurrency(item.nilaiKomitmen)}</td>
                            <td>
                              {formatCurrency(
                                (item.rencanaDetail || []).reduce((sum, d) => sum + (d.nilaiRencana || 0), 0)
                              )}
                            </td>
                            <td>
                              {formatCurrency(item.nilaiKontrakKeseluruhan)}
                            </td>
                            <td>{formatCurrency(item.realisasi)}</td>
                            <td>
                              <div className="d-flex flex-column gap-1">
                                {item.approvalStatus === 'draft' && (
                                  <Badge bg="warning" text="dark">
                                    <FaClock className="me-1" />
                                    Draft
                                  </Badge>
                                )}
                                {item.approvalStatus === 'approved' && (
                                  <Badge bg="success">
                                    <FaCheckCircle className="me-1" />
                                    Approved
                                  </Badge>
                                )}
                                {item.approvalStatus === 'rejected' && (
                                  <>
                                    <Badge bg="danger">
                                      <FaTimesCircle className="me-1" />
                                      Rejected
                                    </Badge>
                                    {item.approvalNote && (
                                      <small className="text-danger mt-1" style={{ fontSize: '0.75rem' }}>
                                        <strong>Alasan:</strong> {item.approvalNote}
                                      </small>
                                    )}
                                  </>
                                )}
                                {item.approvalStatus === 'revision_requested' && (
                                  <>
                                    <Badge bg="warning" text="dark">
                                      <FaUndo className="me-1" />
                                      Request Revisi
                                    </Badge>
                                    {item.revisiNote && (
                                      <small className="text-warning mt-1" style={{ fontSize: '0.75rem' }}>
                                        <strong>Catatan:</strong> {item.revisiNote}
                                      </small>
                                    )}
                                  </>
                                )}
                                {item.approvalStatus === 'approved' && item.status === 'selesai' && (
                                  <Badge bg="primary">
                                    <FaCheckCircle className="me-1" />
                                    SELESAI
                                  </Badge>
                                )}
                                {item.status !== 'selesai' && item.jenisPaket === 'Multi Year (MY)' && isTahunBerjalanLunas(item) && !isInvoiceLunas(item) && (
                                  <Badge bg="info" text="dark">
                                    Selesai Tahun {getTahunBerjalan(item)}
                                  </Badge>
                                )}
                                {item.needRealisasi && (
                                  <Badge bg="warning" text="dark">Perlu Realisasi</Badge>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="d-flex gap-1 flex-wrap">
                                <Button
                                  variant="info"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedKomitmen(item);
                                    setShowDetailModal(true);
                                  }}
                                  title="Lihat Detail"
                                >
                                  <FaEye />
                                </Button>
                                <Button
                                  variant="warning"
                                  size="sm"
                                  onClick={() => handleEdit(item)}
                                  disabled={
                                    item.status === 'selesai' ||
                                    item.approvalStatus === 'draft' ||
                                    item.approvalStatus === 'revision_requested'
                                  }
                                  title={
                                    item.status === 'selesai'
                                      ? "Komitmen sudah ditandai selesai oleh admin"
                                      : item.approvalStatus === 'draft'
                                        ? "Menunggu approval admin. Tombol edit akan aktif setelah approved/rejected"
                                        : item.approvalStatus === 'revision_requested'
                                          ? "Menunggu admin memproses request revisi"
                                          : item.approvalStatus === 'rejected'
                                            ? "Edit untuk perbaiki data yang ditolak, lalu submit ulang"
                                            : item.approvalStatus === 'approved'
                                              ? "Edit untuk update realisasi"
                                              : "Edit komitmen"
                                  }
                                >
                                  <FaEdit />
                                </Button>
                                {(item.approvalStatus === 'approved' || item.approvalStatus === 'draft') && item.status !== 'selesai' && (
                                  <Button
                                    variant="outline-warning"
                                    size="sm"
                                    onClick={() => handleOpenRevisi(item)}
                                    title={
                                      item.approvalStatus === 'draft'
                                        ? "Tarik kembali submission untuk diperbaiki"
                                        : "Request Revisi Data Komitmen Awal ke Admin"
                                    }
                                  >
                                    <FaUndo className="me-1" /> Req. Revisi
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Container>
      </div>

      {/* MODAL FORM */}
      <Modal show={showFormModal} onHide={handleCloseFormModal} size="xl" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {editMode ? 'Edit Komitmen' : 'Tambah Komitmen'}
            {editMode && (
              <Badge bg="warning" className="ms-2 text-dark">Edit Mode - Tab Komitmen Awal View Only</Badge>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <Form onSubmit={handleSubmit}>
            {editMode && selectedKomitmen?.approvalStatus === 'rejected' && (
              <Alert variant="danger" className="mb-3">
                <strong>⚠️ Data Ditolak oleh Admin</strong><br />
                <strong>Alasan:</strong> {selectedKomitmen.approvalNote || 'Tidak ada catatan'}<br />
                <small className="text-muted mt-2 d-block">
                  Silakan perbaiki data sesuai catatan di atas, lalu submit ulang.
                  Status akan kembali ke "Pending Approval" setelah Anda submit.
                </small>
              </Alert>
            )}
            {editMode && selectedKomitmen?.approvalStatus !== 'rejected' && (
              <Alert variant="warning" className="mb-3">
                <strong>⚠️ Mode View Only:</strong> Tab Komitmen Awal tidak dapat diedit oleh PIC
              </Alert>
            )}
            <Tabs defaultActiveKey="komitmen" className="mb-3">
              <Tab eventKey="komitmen" title="Komitmen Awal / Informasi Dasar">
                <h6 className="fw-bold mb-3 mt-3">Informasi Paket</h6>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>ID Paket Monitoring</Form.Label>
                      <Form.Control
                        type="text"
                        name="idPaketMonitoring"
                        value={formData.idPaketMonitoring}
                        onChange={handleFormChange}
                        placeholder="Auto-generate (SY.2025.XXX.12345)"
                        disabled
                        className={isKomitmenDisabled ? "bg-light" : ""}
                      />
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Jenis Paket <span className="text-danger">*</span></Form.Label>
                      <Form.Select
                        name="jenisPaket"
                        value={formData.jenisPaket}
                        onChange={handleFormChange}
                        required
                        disabled={isKomitmenDisabled}
                        className={isKomitmenDisabled ? "bg-light" : ""}
                      >
                        <option value="Single Year (SY)">Single Year (SY)</option>
                        <option value="Multi Year (MY)">Multi Year (MY)</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>ID RUP</Form.Label>
                      <Form.Control
                        type="text"
                        name="idRUP"
                        value={formData.idRUP}
                        onChange={handleFormChange}
                        placeholder='opsional'
                        disabled={isKomitmenDisabled}
                        className={isKomitmenDisabled ? "bg-light" : ""}
                      />
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Nama AP <span className="text-danger">*</span></Form.Label>
                      <Form.Control
                        type="text"
                        name="namaAP"
                        value={formData.namaAP || userAP}
                        required
                        disabled
                        className="bg-light"
                      />
                      <Form.Text className="text-muted">
                        Nama AP otomatis sesuai dengan akun Anda
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label>Nama Paket <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="text"
                    name="namaPaket"
                    value={formData.namaPaket}
                    onChange={handleFormChange}
                    required
                    disabled={isKomitmenDisabled}
                    className={isKomitmenDisabled ? "bg-light" : ""}
                  />
                </Form.Group>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Jenis Anggaran <span className="text-danger">*</span></Form.Label>
                      <Form.Select
                        name="jenisAnggaran"
                        value={formData.jenisAnggaran}
                        onChange={handleFormChange}
                        required
                        disabled={isKomitmenDisabled}
                        className={isKomitmenDisabled ? "bg-light" : ""}
                      >
                        <option value="Opex">Opex</option>
                        <option value="Capex">Capex</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Jenis Pengadaan <span className="text-danger">*</span></Form.Label>
                      <Form.Select
                        name="jenisPengadaan"
                        value={formData.jenisPengadaan}
                        onChange={handleFormChange}
                        required
                        disabled={isKomitmenDisabled}
                        className={isKomitmenDisabled ? "bg-light" : ""}
                      >
                        <option value="Barang">Barang</option>
                        <option value="Jasa Konsultansi">Jasa Konsultansi</option>
                        <option value="Jasa Lainnya">Jasa Lainnya</option>
                        <option value="Pekerjaan Konstruksi">Pekerjaan Konstruksi</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Usulan Metode Pemilihan <span className="text-danger">*</span></Form.Label>
                      <Form.Select
                        name="usulanMetodePemilihan"
                        value={formData.usulanMetodePemilihan}
                        onChange={(e) => {
                          handleFormChange(e);
                          if (e.target.value !== 'Pengadaan Langsung') {
                            setFormData(prev => ({ ...prev, statusPadi: 'Non PaDi' }));
                          }
                        }}
                        required
                        disabled={isKomitmenDisabled}
                        className={isKomitmenDisabled ? "bg-light" : ""}
                      >
                        <option value="Tender/Seleksi Umum">Tender/Seleksi Umum</option>
                        <option value="Tender/Seleksi Terbatas">Tender/Seleksi Terbatas</option>
                        <option value="Penunjukan Langsung">Penunjukan Langsung</option>
                        <option value="Pengadaan Langsung">Pengadaan Langsung</option>
                        <option value="Penetapan Langsung">Penetapan Langsung</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Status PaDi</Form.Label>
                      <Form.Select
                        name="statusPadi"
                        value={formData.statusPadi}
                        onChange={handleFormChange}
                        disabled={formData.usulanMetodePemilihan !== 'Pengadaan Langsung' || isKomitmenDisabled}
                        className={formData.usulanMetodePemilihan !== 'Pengadaan Langsung' || isKomitmenDisabled ? "bg-light" : ""}
                      >
                        <option value="Non PaDi">Non PaDi</option>
                        <option value="PaDi">PaDi</option>
                      </Form.Select>
                      <Form.Text className="text-muted">
                        {formData.usulanMetodePemilihan === 'Pengadaan Langsung'
                          ? 'Pilih PaDi atau Non PaDi'
                          : 'Otomatis Non PaDi untuk metode ini'}
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Komitmen Tahun Berjalan (Rp) <span className="text-danger">*</span></Form.Label>
                      <Form.Control
                        type="text"
                        name="nilaiKomitmen"
                        value={formData.nilaiKomitmen}
                        onChange={(e) => handleRupiahChange(e, 'nilaiKomitmen')}
                        required
                        disabled={isKomitmenDisabled}
                        className={isKomitmenDisabled ? "bg-light" : ""}
                      />
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        Komitmen Keseluruhan (Rp)
                        {formData.jenisPaket === 'Multi Year (MY)' && <span className="text-danger">*</span>}
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="komitmenKeseluruhan"
                        value={formData.komitmenKeseluruhan}
                        onChange={(e) => handleRupiahChange(e, 'komitmenKeseluruhan')}
                        disabled={isKomitmenDisabled}
                        className={isKomitmenDisabled ? "bg-light" : ""}
                      />
                      {formData.jenisPaket === 'Multi Year (MY)' && (
                        <Form.Text className="text-danger">
                          Wajib diisi untuk Multi Year
                        </Form.Text>
                      )}
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Waktu Pemanfaatan Dari</Form.Label>
                      <DatePicker
                        selected={formData.waktuPemanfaatanDari ? new Date(formData.waktuPemanfaatanDari) : null}
                        onChange={(date) => {
                          if (date) {
                            const formatted = date.toISOString().split('T')[0];
                            setFormData(prev => ({ ...prev, waktuPemanfaatanDari: formatted }));
                          } else {
                            setFormData(prev => ({ ...prev, waktuPemanfaatanDari: '' }));
                          }
                        }}
                        dateFormat="dd/MM/yyyy"
                        locale={id}
                        placeholderText="dd/mm/yyyy"
                        className="form-control"
                        wrapperClassName="w-100"
                        disabled={isKomitmenDisabled}
                        showMonthDropdown
                        showYearDropdown
                        dropdownMode="select"
                        yearDropdownItemNumber={10}
                        scrollableYearDropdown
                        popperProps={{ strategy: 'fixed' }}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Waktu Pemanfaatan Sampai</Form.Label>
                      <DatePicker
                        selected={formData.waktuPemanfaatanSampai ? new Date(formData.waktuPemanfaatanSampai) : null}
                        onChange={(date) => {
                          if (date) {
                            const formatted = date.toISOString().split('T')[0];
                            setFormData(prev => ({ ...prev, waktuPemanfaatanSampai: formatted }));
                          } else {
                            setFormData(prev => ({ ...prev, waktuPemanfaatanSampai: '' }));
                          }
                        }}
                        dateFormat="dd/MM/yyyy"
                        locale={id}
                        placeholderText="dd/mm/yyyy"
                        className="form-control"
                        wrapperClassName="w-100"
                        disabled={isKomitmenDisabled}
                        showMonthDropdown
                        showYearDropdown
                        dropdownMode="select"
                        yearDropdownItemNumber={10}
                        scrollableYearDropdown
                        popperProps={{ strategy: 'fixed' }}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <hr />
                <hr className="my-4" />
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="fw-bold mb-0">Rencana Realisasi</h6>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={addRencanaRow}
                    disabled={
                      isKomitmenDisabled ||
                      (() => {
                        const totalRencana = rencanaRows.reduce((sum, row) => sum + parseRupiahInput(row.nilaiRencana), 0);
                        const komitmenKeseluruhan = parseRupiahInput(formData.komitmenKeseluruhan);
                        return komitmenKeseluruhan > 0 && totalRencana >= komitmenKeseluruhan;
                      })()
                    }
                    title={
                      (() => {
                        const totalRencana = rencanaRows.reduce((sum, row) => sum + parseRupiahInput(row.nilaiRencana), 0);
                        const komitmenKeseluruhan = parseRupiahInput(formData.komitmenKeseluruhan);
                        return komitmenKeseluruhan > 0 && totalRencana >= komitmenKeseluruhan
                          ? "Total Rencana sudah mencapai Komitmen Keseluruhan"
                          : "Tambah Rencana Realisasi";
                      })()
                    }
                  >
                    <FaPlus className="me-1" /> Tambah Rencana
                  </Button>
                </div>
                {(() => {
                  const totalRencana = rencanaRows.reduce((sum, row) => sum + parseRupiahInput(row.nilaiRencana), 0);
                  const komitmenKeseluruhan = parseRupiahInput(formData.komitmenKeseluruhan);
                  return komitmenKeseluruhan > 0 && totalRencana >= komitmenKeseluruhan && (
                    <Alert variant="success" className="mb-3">
                      <strong>Total Rencana sudah sesuai dengan Komitmen Keseluruhan</strong><br />
                      <small>Anda tidak dapat menambah rencana lagi.</small>
                    </Alert>
                  );
                })()}
                {formData.jenisPaket === 'Multi Year (MY)' && (
                  <Alert variant="info" className="mb-3">
                    <small><strong>Multi Year:</strong> Silakan isi tahun rencana untuk setiap periode</small>
                  </Alert>
                )}
                <Row className="mb-2 bg-light py-2 border rounded">
                  {formData.jenisPaket === 'Multi Year (MY)' && (
                    <Col md={2}>
                      <Form.Label className="fw-bold small mb-0">Tahun</Form.Label>
                    </Col>
                  )}
                  <Col md={formData.jenisPaket === 'Multi Year (MY)' ? 3 : 4}>
                    <Form.Label className="fw-bold small mb-0">Nilai Rencana (Rp)</Form.Label>
                  </Col>
                  <Col md={formData.jenisPaket === 'Multi Year (MY)' ? 3 : 4}>
                    <Form.Label className="fw-bold small mb-0">Bulan Rencana</Form.Label>
                  </Col>
                  <Col md={formData.jenisPaket === 'Multi Year (MY)' ? 3 : 3}>
                    <Form.Label className="fw-bold small mb-0">Keterangan</Form.Label>
                  </Col>
                  <Col md={1} className="text-center">
                    <Form.Label className="fw-bold small mb-0">Aksi</Form.Label>
                  </Col>
                </Row>

                {rencanaRows.map((row, index) => (
                  <Row key={row.id} className="mb-2 align-items-center border-bottom pb-2">
                    {formData.jenisPaket === 'Multi Year (MY)' && (
                      <Col md={2}>
                        <Form.Control
                          type="number"
                          value={row.tahunRencana}
                          onChange={(e) => handleRencanaChange(index, 'tahunRencana', e.target.value)}
                          placeholder="2025"
                          min="2024"
                          max="2030"
                          disabled={isKomitmenDisabled}
                          className={isKomitmenDisabled ? "bg-light" : ""}
                          size="sm"
                        />
                      </Col>
                    )}

                    <Col md={formData.jenisPaket === 'Multi Year (MY)' ? 3 : 4}>
                      <Form.Control
                        type="text"
                        value={row.nilaiRencana}
                        onChange={(e) => handleRencanaRupiahChange(index, e.target.value)}
                        placeholder="0"
                        disabled={isKomitmenDisabled}
                        className={isKomitmenDisabled ? "bg-light" : ""}
                        size="sm"
                      />
                    </Col>
                    <Col md={formData.jenisPaket === 'Multi Year (MY)' ? 3 : 4}>
                      <Form.Select
                        value={row.bulanRencana}
                        onChange={(e) => handleRencanaChange(index, 'bulanRencana', e.target.value)}
                        disabled={isKomitmenDisabled}
                        className={isKomitmenDisabled ? "bg-light" : ""}
                        size="sm"
                      >
                        <option value="">Pilih Bulan</option>
                        {months.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col md={formData.jenisPaket === 'Multi Year (MY)' ? 3 : 3}>
                      <Form.Control
                        type="text"
                        value={row.keterangan}
                        onChange={(e) => handleRencanaChange(index, 'keterangan', e.target.value)}
                        placeholder="Catatan..."
                        disabled={isKomitmenDisabled}
                        className={isKomitmenDisabled ? "bg-light" : ""}
                        size="sm"
                      />
                    </Col>

                    <Col md={1} className="text-center">
                      {rencanaRows.length > 1 && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => removeRencanaRow(index)}
                          disabled={isKomitmenDisabled}
                        >
                          <FaTimes />
                        </Button>
                      )}
                    </Col>
                  </Row>
                ))}

                <Row className="mt-3">
                  <Col md={12}>
                    <Alert variant={
                      (() => {
                        const totalRencana = rencanaRows.reduce((sum, row) => sum + parseRupiahInput(row.nilaiRencana), 0);
                        const refKomitmen = parseRupiahInput(formData.komitmenKeseluruhan) > 0
                          ? parseRupiahInput(formData.komitmenKeseluruhan)
                          : parseRupiahInput(formData.nilaiKomitmen);
                        if (refKomitmen > 0 && totalRencana > refKomitmen) return 'danger';
                        if (refKomitmen > 0 && totalRencana === refKomitmen) return 'success';
                        return 'success';
                      })()
                    } className="mb-0">
                      <strong>Total Rencana Realisasi:</strong> {formatRupiahInput(
                        rencanaRows.reduce((sum, row) => sum + parseRupiahInput(row.nilaiRencana), 0).toString()
                      )}
                      {(() => {
                        const totalRencana = rencanaRows.reduce((sum, row) => sum + parseRupiahInput(row.nilaiRencana), 0);
                        const refKomitmen = parseRupiahInput(formData.komitmenKeseluruhan) > 0
                          ? parseRupiahInput(formData.komitmenKeseluruhan)
                          : parseRupiahInput(formData.nilaiKomitmen);
                        if (refKomitmen > 0 && totalRencana > refKomitmen) {
                          return (
                            <span className="ms-2 text-danger fw-bold">
                              ⚠️ Melebihi {parseRupiahInput(formData.komitmenKeseluruhan) > 0 ? 'Komitmen Keseluruhan' : 'Komitmen Tahun Berjalan'} sebesar {formatRupiahInput((totalRencana - refKomitmen).toString())}! Data tidak dapat disimpan.
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </Alert>
                  </Col>
                </Row>
                <hr />
                <h5 className="mb-3">Informasi Keuangan</h5>
                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Check
                        type="checkbox"
                        name="pdnCheckbox"
                        label="PDN"
                        checked={formData.pdnCheckbox}
                        onChange={handleFormChange}
                        disabled={isKomitmenDisabled}
                      />
                    </Form.Group>
                  </Col>

                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Check
                        type="checkbox"
                        name="tkdnCheckbox"
                        label="TKDN"
                        checked={formData.tkdnCheckbox}
                        onChange={handleFormChange}
                        disabled={isKomitmenDisabled}
                      />
                    </Form.Group>
                  </Col>

                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Check
                        type="checkbox"
                        name="importCheckbox"
                        label="Import"
                        checked={formData.importCheckbox}
                        onChange={handleFormChange}
                        disabled={isKomitmenDisabled}
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Alert variant="info" className="mb-3">
                  <small>⚠️ Hanya boleh memilih 1 checkbox (PDN, TKDN, atau Import)</small>
                </Alert>

                {shouldShowPDNFields() && (
                  <>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Nilai Tahun Berjalan PDN (Rp) <span className="text-danger">*</span></Form.Label>
                          <Form.Control
                            type="text"
                            name="nilaiTahunBerjalanPDN"
                            value={formData.nilaiTahunBerjalanPDN}
                            onChange={(e) => handleRupiahChange(e, 'nilaiTahunBerjalanPDN')}
                            required
                            disabled={isKomitmenDisabled}
                            className={isKomitmenDisabled ? "bg-light" : ""}
                            placeholder="Masukkan nilai PDN untuk tahun ini"
                          />
                        </Form.Group>
                      </Col>

                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Nilai Keseluruhan PDN (Rp) <span className="text-danger">*</span></Form.Label>
                          <Form.Control
                            type="text"
                            name="nilaiKeseluruhanPDN"
                            value={formData.nilaiKeseluruhanPDN}
                            onChange={(e) => handleRupiahChange(e, 'nilaiKeseluruhanPDN')}
                            required
                            disabled={isKomitmenDisabled}
                            className={isKomitmenDisabled ? "bg-light" : ""}
                            placeholder="Masukkan nilai PDN keseluruhan"
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                    <Alert variant="success" className="mb-3">
                      <small><strong>PDN dipilih:</strong> Silakan isi kedua field nilai PDN di atas.</small>
                    </Alert>
                  </>
                )}

                {shouldShowTKDNFields() && (
                  <>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Nilai Tahun Berjalan TKDN (Rp) <span className="text-danger">*</span></Form.Label>
                          <Form.Control
                            type="text"
                            name="nilaiTahunBerjalanTKDN"
                            value={formData.nilaiTahunBerjalanTKDN}
                            onChange={(e) => handleRupiahChange(e, 'nilaiTahunBerjalanTKDN')}
                            required
                            disabled={isKomitmenDisabled}
                            className={isKomitmenDisabled ? "bg-light" : ""}
                            placeholder="Masukkan nilai TKDN untuk tahun ini"
                          />
                        </Form.Group>
                      </Col>

                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Nilai Keseluruhan TKDN (Rp) <span className="text-danger">*</span></Form.Label>
                          <Form.Control
                            type="text"
                            name="nilaiKeseluruhanTKDN"
                            value={formData.nilaiKeseluruhanTKDN}
                            onChange={(e) => handleRupiahChange(e, 'nilaiKeseluruhanTKDN')}
                            required
                            disabled={isKomitmenDisabled}
                            className={isKomitmenDisabled ? "bg-light" : ""}
                            placeholder="Masukkan nilai TKDN keseluruhan"
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                    <Alert variant="info" className="mb-3">
                      <small><strong>TKDN dipilih:</strong> Silakan isi kedua field nilai TKDN di atas.</small>
                    </Alert>
                  </>
                )}

                {shouldShowImportFields() && (
                  <>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Nilai Tahun Berjalan Import (Rp) <span className="text-danger">*</span></Form.Label>
                          <Form.Control
                            type="text"
                            name="nilaiTahunBerjalanImport"
                            value={formData.nilaiTahunBerjalanImport}
                            onChange={(e) => handleRupiahChange(e, 'nilaiTahunBerjalanImport')}
                            required
                            disabled={isKomitmenDisabled}
                            className={isKomitmenDisabled ? "bg-light" : ""}
                            placeholder="Masukkan nilai Import untuk tahun ini"
                          />
                        </Form.Group>
                      </Col>

                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Nilai Keseluruhan Import (Rp) <span className="text-danger">*</span></Form.Label>
                          <Form.Control
                            type="text"
                            name="nilaiKeseluruhanImport"
                            value={formData.nilaiKeseluruhanImport}
                            onChange={(e) => handleRupiahChange(e, 'nilaiKeseluruhanImport')}
                            required
                            disabled={isKomitmenDisabled}
                            className={isKomitmenDisabled ? "bg-light" : ""}
                            placeholder="Masukkan nilai Import keseluruhan"
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                    <Alert variant="warning" className="mb-3">
                      <small><strong>Import dipilih:</strong> Silakan isi kedua field nilai Import di atas.</small>
                    </Alert>
                  </>
                )}

                <Form.Group className="mb-3">
                  <Form.Label>Catatan Komitmen</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    name="catatanKomitmen"
                    value={formData.catatanKomitmen}
                    onChange={handleFormChange}
                    placeholder="Catatan tambahan..."
                    disabled={isKomitmenDisabled}
                    className={isKomitmenDisabled ? "bg-light" : ""}
                  />
                </Form.Group>
              </Tab>

              <Tab
                eventKey="realisasi"
                title="Realisasi"
                disabled={!editMode || (editMode && selectedKomitmen?.approvalStatus !== 'approved')}
              >
                {!editMode ? (
                  <Alert variant="info" className="mt-3">
                    <FaExclamationTriangle className="me-2" />
                    <strong>Tab Realisasi Belum Tersedia</strong><br />
                    Silakan simpan komitmen terlebih dahulu. Setelah disetujui admin, Anda dapat menambahkan realisasi melalui tombol Edit.
                  </Alert>
                ) : editMode && selectedKomitmen?.approvalStatus !== 'approved' ? (
                  <Alert variant="warning" className="mt-3">
                    <FaExclamationTriangle className="me-2" />
                    <strong>Tab Realisasi Terkunci</strong><br />
                    Tab Realisasi hanya dapat diakses setelah komitmen disetujui oleh admin.
                  </Alert>
                ) : (
                  <>
                    <h6 className="fw-bold mb-3 mt-3 text-white bg-primary p-2">DATA KOMITMEN</h6>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Nama Pengadaan (Komitmen)</Form.Label>
                          <Form.Control
                            size="sm"
                            type="text"
                            value={formData.namaPaket}
                            disabled
                            className="bg-light"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Nilai Anggaran Keseluruhan (Komitmen)</Form.Label>
                          <Form.Control
                            size="sm"
                            type="text"
                            value={formData.komitmenKeseluruhan}
                            disabled
                            className="bg-light"
                          />
                        </Form.Group>
                      </Col>
                    </Row>

                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Nilai Anggaran Tahun Berjalan (Komitmen)</Form.Label>
                          <Form.Control
                            size="sm"
                            type="text"
                            value={formData.nilaiKomitmen}
                            disabled
                            className="bg-light"
                          />
                        </Form.Group>
                      </Col>

                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Metode Pemilihan (Komitmen)</Form.Label>
                          <Form.Control
                            size="sm"
                            type="text"
                            value={formData.usulanMetodePemilihan}
                            disabled
                            className="bg-light"
                          />
                        </Form.Group>
                      </Col>
                    </Row>

                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Jenis Pengadaan (Komitmen)</Form.Label>
                          <Form.Control
                            size="sm"
                            type="text"
                            value={formData.jenisPengadaan}
                            disabled
                            className="bg-light"
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                    <hr />
                    <h6 className="fw-bold mb-3 text-white bg-success p-2">DATA REALISASI (EDITABLE)</h6>
                    {editMode && (
                      <div className="d-flex justify-content-between align-items-center mb-3 p-3 bg-light border rounded">
                        <div>
                          {isAddingNewRealisasi ? (
                            <Badge bg="success" className="px-3 py-2">
                              Mode: Tambah Realisasi Baru
                            </Badge>
                          ) : (
                            <Badge bg="info" className="px-3 py-2">
                              <FaEdit className="me-2" /> Mode: Edit Realisasi Existing
                            </Badge>
                          )}
                        </div>

                        <div className="d-flex gap-2">
                          {!isAddingNewRealisasi && (
                            <Button
                              variant="success"
                              size="sm"
                              onClick={handleNewRealisasi}
                            >
                              <FaPlus className="me-1" /> New Realisasi
                            </Button>
                          )}

                          {isAddingNewRealisasi && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={handleCancelNewRealisasi}
                            >
                              <FaTimes className="me-1" /> Cancel (Kembali ke Edit)
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                    {isAddingNewRealisasi && (
                      <Alert variant="success" className="mb-3">
                        <strong>Mode Tambah Realisasi Baru:</strong> Anda sedang menambahkan data realisasi baru.
                        Data realisasi lama tidak akan terhapus.<br />
                        <small className="text-muted">
                          • Isi Nama Penyedia baru jika berbeda dengan realisasi sebelumnya<br />
                          • Klik "Cancel" untuk kembali ke mode edit existing
                        </small>
                      </Alert>
                    )}
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Nama Pengadaan (Realisasi)</Form.Label>
                          <Form.Control
                            size="sm"
                            type="text"
                            name="namaPengadaanRealisasi"
                            value={formData.namaPengadaanRealisasi || ''}
                            onChange={handleFormChange}
                            placeholder="Masukkan nama pengadaan realisasi"
                            disabled={isRealisasiDisabled}
                            className={isRealisasiDisabled ? "bg-light" : "bg-success bg-opacity-10"}
                          />
                        </Form.Group>
                      </Col>

                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Nilai Kontrak Keseluruhan (Rp) <span className="text-danger">*</span></Form.Label>
                          <Form.Control
                            type="text"
                            name="nilaiKontrakKeseluruhan"
                            value={formData.nilaiKontrakKeseluruhan}
                            onChange={(e) => handleRupiahChange(e, 'nilaiKontrakKeseluruhan')}
                            placeholder="Masukkan nilai kontrak keseluruhan"
                            disabled={isRealisasiDisabled}
                            className={isRealisasiDisabled ? "bg-light" : "bg-success bg-opacity-10"}
                            required
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Metode Pemilihan (Realisasi)</Form.Label>
                          <Form.Select
                            size="sm"
                            name="metodePemilihanRealisasi"
                            value={formData.metodePemilihanRealisasi || formData.usulanMetodePemilihan}
                            onChange={handleFormChange}
                            disabled={isRealisasiDisabled}
                            className={isRealisasiDisabled ? "bg-light" : "bg-success bg-opacity-10"}
                          >
                            <option value="Tender/Seleksi Umum">Tender/Seleksi Umum</option>
                            <option value="Tender/Seleksi Terbatas">Tender/Seleksi Terbatas</option>
                            <option value="Penunjukan Langsung">Penunjukan Langsung</option>
                            <option value="Pengadaan Langsung">Pengadaan Langsung</option>
                            <option value="Penetapan Langsung">Penetapan Langsung</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                    </Row>

                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Kualifikasi Penyedia</Form.Label>
                          <Form.Select
                            size="sm"
                            name="kualifikasiPenyedia"
                            value={formData.kualifikasiPenyedia || 'UMKM'}
                            onChange={handleFormChange}
                            disabled={isRealisasiDisabled}
                            className={isRealisasiDisabled ? "bg-light" : "bg-success bg-opacity-10"}
                          >
                            <option value="UMKM">UMKM</option>
                            <option value="Non UMKM">Non UMKM</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>

                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Nama Penyedia</Form.Label>
                          <Form.Control
                            size="sm"
                            type="text"
                            name="namaPenyedia"
                            value={formData.namaPenyedia || ''}
                            onChange={handleFormChange}
                            placeholder="Masukkan nama penyedia"
                            disabled={isRealisasiDisabled}
                            className={isRealisasiDisabled ? "bg-light" : "bg-success bg-opacity-10"}
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                    <hr className="my-4" />
                    <h6 className="fw-bold mb-3">Detail Realisasi per Periode</h6>
                    {/* Header Row */}
                    <Row className="mb-2 bg-light py-2 border rounded">
                      <Col md={2}>
                        <Form.Label className="fw-bold small mb-0">Nilai Realisasi (Rp)</Form.Label>
                      </Col>
                      <Col md={2}>
                        <Form.Label className="fw-bold small mb-0">Tanggal Invoice</Form.Label>
                      </Col>
                      <Col md={2}>
                        <Form.Label className="fw-bold small mb-0">Nomor Invoice</Form.Label>
                      </Col>
                      <Col md={2}>
                        <Form.Label className="fw-bold small mb-0">Bulan</Form.Label>
                      </Col>
                      <Col md={2}>
                        <Form.Label className="fw-bold small mb-0">Upload Dokumen</Form.Label>
                      </Col>
                      <Col md={2} className="text-center">
                        <Form.Label className="fw-bold small mb-0">Aksi</Form.Label>
                      </Col>
                    </Row>
                    {/* Detail Realisasi per Periode */}
                    {realisasiRows.map((row, index) => {
                      const isExistingRow = editMode
                        && isAddingNewRealisasi
                        && selectedKomitmen?.realisasiDetail?.some(
                          detail => detail.bulanRealisasi === row.bulanRealisasi &&
                            detail.nomorInvoice === row.nomorInvoice &&
                            detail.tanggalInvoice === row.tanggalInvoice
                        );

                      return (
                        <Row key={row.id} className={`mb-2 align-items-center border-bottom pb-2 ${isExistingRow ? 'opacity-75' : ''}`}>
                          <Col md={2}>
                            <Form.Control
                              type="text"
                              value={row.realisasi || ''}
                              onChange={(e) => handleRealisasiRupiahChange(index, 'realisasi', e.target.value)}
                              placeholder="0"
                              disabled={isExistingRow}
                              className={isExistingRow ? "bg-light" : "bg-success bg-opacity-10"}
                              size="sm"
                            />
                          </Col>
                          <Col md={2}>
                            <DatePicker
                              selected={row.tanggalInvoice ? new Date(row.tanggalInvoice) : null}
                              onChange={(date) => {
                                const formatted = date ? date.toISOString().split('T')[0] : '';
                                handleRealisasiChange(index, 'tanggalInvoice', formatted);
                              }}
                              dateFormat="dd/MM/yyyy"
                              locale={id}
                              placeholderText="dd/mm/yyyy"
                              className={`form-control form-control-sm ${isExistingRow ? "bg-light" : "bg-success bg-opacity-10"}`}
                              wrapperClassName="w-100"
                              disabled={isExistingRow}
                              showMonthDropdown
                              showYearDropdown
                              dropdownMode="select"
                              yearDropdownItemNumber={10}
                              scrollableYearDropdown
                              popperProps={{ strategy: 'fixed' }}
                            />
                          </Col>
                          <Col md={2}>
                            <Form.Control
                              type="text"
                              value={row.nomorInvoice || ''}
                              onChange={(e) => handleRealisasiChange(index, 'nomorInvoice', e.target.value)}
                              placeholder="INV-001"
                              disabled={isExistingRow}
                              className={isExistingRow ? "bg-light" : "bg-success bg-opacity-10"}
                              size="sm"
                            />
                          </Col>
                          <Col md={2}>
                            <Form.Select
                              value={row.bulanRealisasi || ''}
                              onChange={(e) => handleRealisasiChange(index, 'bulanRealisasi', e.target.value)}
                              disabled={isExistingRow}
                              className={isExistingRow ? "bg-light" : "bg-success bg-opacity-10"}
                              size="sm"
                            >
                              <option value="">Pilih Bulan</option>
                              {months.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                              ))}
                            </Form.Select>
                          </Col>
                          <Col md={2}>
                            {row.dokumen ? (
                              <Badge bg="success" className="w-100">File Terupload</Badge>
                            ) : (
                              <Form.Control
                                type="file"
                                onChange={(e) => handleRealisasiChange(index, 'dokumen', e.target.files[0])}
                                accept=".pdf,.jpg,.jpeg,.png"
                                disabled={isExistingRow}
                                size="sm"
                              />
                            )}
                          </Col>
                          <Col md={2} className="text-center">
                            {index === realisasiRows.length - 1 && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={addRealisasiRow}
                                className="me-1"
                              >
                                <FaPlus />
                              </Button>
                            )}
                            {realisasiRows.length > 1 && (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => removeRealisasiRow(index)}
                              >
                                <FaTimes />
                              </Button>
                            )}
                          </Col>
                        </Row>
                      );
                    })}

                    <hr className="my-4" />
                    <div className="mb-2">
                      <h6 className="text-success mb-2">Summary Per Periode (Tahun Berjalan)</h6>
                      <Row className="mb-3">
                        <Col md={4}>
                          <Alert variant="warning" className="mb-0">
                            <strong>Progress per Periode:</strong> {calculateSummaryPerPeriode().progress}%<br />
                            <small className="text-muted">
                              Detail Realisasi / Komitmen Tahun Ini
                            </small>
                          </Alert>
                        </Col>
                        <Col md={4}>
                          <Alert variant="info" className="mb-0">
                            <strong>Sisa Pembayaran per Periode:</strong> {calculateSummaryPerPeriode().sisa}<br />
                            <small className="text-muted">
                              Komitmen Tahun Ini - Detail Realisasi
                            </small>
                          </Alert>
                        </Col>
                        <Col md={4}>
                          <Alert variant="success" className="mb-0">
                            <strong>Total Realisasi per Periode:</strong> {calculateSummaryPerPeriode().total}<br />
                            <small className="text-muted">
                              SUM dari Detail Realisasi per Periode
                            </small>
                          </Alert>
                        </Col>
                      </Row>
                    </div>
                    <div className="mb-3">
                      <h6 className="text-success mb-2">
                        Summary Keseluruhan
                        {formData.jenisPaket === 'Multi Year (MY)' ? ' (Total Kontrak MY)' : ' (Total Kontrak)'}
                      </h6>
                      <Row>
                        <Col md={4}>
                          <Alert variant="warning" className="mb-0" style={{ borderLeft: '4px solid #28a745' }}>
                            <strong>Progress Keseluruhan:</strong> {calculateSummaryKeseluruhan().progress}%<br />
                            <small className="text-muted">
                              Total Realisasi / {formData.jenisPaket === 'Multi Year (MY)' ? 'Nilai Kontrak' : 'Nilai Kontrak/Komitmen'}
                            </small>
                          </Alert>
                        </Col>
                        <Col md={4}>
                          <Alert variant="info" className="mb-0" style={{ borderLeft: '4px solid #28a745' }}>
                            <strong>Sisa Pembayaran Keseluruhan:</strong> {calculateSummaryKeseluruhan().sisa}<br />
                            <small className="text-muted">
                              {formData.jenisPaket === 'Multi Year (MY)' ? 'Nilai Kontrak' : 'Nilai Kontrak/Komitmen'} - Total Realisasi
                            </small>
                          </Alert>
                        </Col>
                        <Col md={4}>
                          <Alert variant="success" className="mb-0" style={{ borderLeft: '4px solid #28a745' }}>
                            <strong>Total Realisasi Keseluruhan:</strong> {calculateSummaryKeseluruhan().total}<br />
                            <small className="text-muted">
                              {isAddingNewRealisasi
                                ? 'Realisasi Lama + Detail Realisasi Baru'
                                : 'Total dari Detail Realisasi'
                              }
                            </small>
                          </Alert>
                        </Col>
                      </Row>
                    </div>
                    <hr />
                    <h6 className="fw-bold mb-3">Nilai Rupiah</h6>
                    <Alert variant="success" className="mb-3">
                      <small>
                        <strong>Auto-Calculate:</strong> Nilai di bawah akan otomatis terisi berdasarkan <strong>Total Detail Realisasi per Periode</strong>
                        sesuai checkbox yang dipilih di Tab Komitmen Awal (PDN/TKDN/Import).
                      </small>
                    </Alert>
                    <Row>
                      <Col md={4}>
                        <Form.Group className="mb-3">
                          <Form.Label>Nilai PDN (Rp)</Form.Label>
                          <Form.Control
                            type="text"
                            name="nilaiPDN"
                            value={formData.nilaiPDN}
                            onChange={(e) => handleRupiahChange(e, 'nilaiPDN')}
                            placeholder="0"
                            disabled={!formData.pdnCheckbox}
                            className={formData.pdnCheckbox ? "bg-success bg-opacity-10" : "bg-light"}
                          />
                          {formData.pdnCheckbox && (
                            <Form.Text className="text-success">
                              Otomatis dari Total Detail Realisasi per Periode
                            </Form.Text>
                          )}
                          {!formData.pdnCheckbox && (
                            <Form.Text className="text-muted">
                              Checkbox PDN tidak dipilih di Tab Komitmen
                            </Form.Text>
                          )}
                        </Form.Group>
                      </Col>
                      <Col md={4}>
                        <Form.Group className="mb-3">
                          <Form.Label>Nilai TKDN (Rp)</Form.Label>
                          <Form.Control
                            type="text"
                            name="nilaiTKDN"
                            value={formData.nilaiTKDN}
                            onChange={(e) => handleRupiahChange(e, 'nilaiTKDN')}
                            placeholder="0"
                            disabled={!formData.tkdnCheckbox}
                            className={formData.tkdnCheckbox ? "bg-success bg-opacity-10" : "bg-light"}
                          />
                          {formData.tkdnCheckbox && (
                            <Form.Text className="text-success">
                              Otomatis dari Total Detail Realisasi per Periode
                            </Form.Text>
                          )}
                          {!formData.tkdnCheckbox && (
                            <Form.Text className="text-muted">
                              Checkbox TKDN tidak dipilih di Tab Komitmen
                            </Form.Text>
                          )}
                        </Form.Group>
                      </Col>
                      <Col md={4}>
                        <Form.Group className="mb-3">
                          <Form.Label>Nilai Impor (Rp)</Form.Label>
                          <Form.Control
                            type="text"
                            name="nilaiImpor"
                            value={formData.nilaiImpor}
                            onChange={(e) => handleRupiahChange(e, 'nilaiImpor')}
                            placeholder="0"
                            disabled={!formData.importCheckbox}
                            className={formData.importCheckbox ? "bg-success bg-opacity-10" : "bg-light"}
                          />
                          {formData.importCheckbox && (
                            <Form.Text className="text-success">
                              Otomatis dari Total Detail Realisasi per Periode
                            </Form.Text>
                          )}
                          {!formData.importCheckbox && (
                            <Form.Text className="text-muted">
                              Checkbox IMPORT tidak dipilih di Tab Komitmen
                            </Form.Text>
                          )}
                        </Form.Group>
                      </Col>
                    </Row>
                  </>
                )}
              </Tab>
            </Tabs>

            <div className="d-flex justify-content-end gap-2 mt-3">
              <Button variant="secondary" onClick={handleCloseFormModal}>Batal</Button>
              <Button variant="primary" type="submit" disabled={loading || (() => {
                const totalRencana = rencanaRows.reduce((sum, row) => sum + parseRupiahInput(row.nilaiRencana), 0);
                const refKomitmen = parseRupiahInput(formData.komitmenKeseluruhan) > 0
                  ? parseRupiahInput(formData.komitmenKeseluruhan)
                  : parseRupiahInput(formData.nilaiKomitmen);
                return refKomitmen > 0 && totalRencana > refKomitmen;
              })()}>
                {loading ? <Spinner animation="border" size="sm" /> : (editMode ? 'Update' : 'Simpan')}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
      {/* MODAL DETAIL */}
      <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="xl" centered>
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title>
            Detail Komitmen
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '80vh', overflowY: 'auto' }}>
          {selectedKomitmen && (
            <div>
              <Card className="mb-3 shadow-sm">
                <Card.Header className="bg-light">
                  <h6 className="mb-0 fw-bold">Informasi Paket</h6>
                </Card.Header>
                <Card.Body>
                  <Row className="mb-2">
                    <Col md={6}>
                      <strong>ID Paket Monitoring:</strong>
                      <p className="text-primary font-monospace mb-0">{selectedKomitmen.idPaketMonitoring || '-'}</p>
                    </Col>
                    <Col md={6}>
                      <strong>Jenis Paket:</strong>
                      <p className="mb-0">
                        <Badge bg="info">{selectedKomitmen.jenisPaket || '-'}</Badge>
                      </p>
                    </Col>
                  </Row>
                  <Row className="mb-2">
                    <Col md={6}>
                      <strong>ID RUP:</strong>
                      <p className="mb-0">{selectedKomitmen.idRUP || '-'}</p>
                    </Col>
                    <Col md={6}>
                      <strong>Nama AP:</strong>
                      <p className="mb-0">{selectedKomitmen.namaAP || '-'}</p>
                    </Col>
                  </Row>
                  <Row className="mb-2">
                    <Col md={12}>
                      <strong>Nama Paket:</strong>
                      <p className="text-dark fw-bold mb-0">{selectedKomitmen.namaPaket}</p>
                    </Col>
                  </Row>
                  <Row className="mb-2">
                    <Col md={4}>
                      <strong>Jenis Anggaran:</strong>
                      <p className="mb-0">
                        <Badge bg={selectedKomitmen.jenisAnggaran === 'Opex' ? 'success' : 'warning'}>
                          {selectedKomitmen.jenisAnggaran || '-'}
                        </Badge>
                      </p>
                    </Col>
                    <Col md={4}>
                      <strong>Jenis Pengadaan:</strong>
                      <p className="mb-0">{selectedKomitmen.jenisPengadaan || '-'}</p>
                    </Col>
                    <Col md={4}>
                      <strong>Status PaDi:</strong>
                      <p className="mb-0">
                        <Badge bg={selectedKomitmen.statusPadi === 'PaDi' ? 'primary' : 'secondary'}>
                          {selectedKomitmen.statusPadi || '-'}
                        </Badge>
                      </p>
                    </Col>
                  </Row>
                  <Row className="mb-2">
                    <Col md={12}>
                      <strong>Metode Pemilihan:</strong>
                      <p className="mb-0">{selectedKomitmen.usulanMetodePemilihan || '-'}</p>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              <Card className="mb-3 shadow-sm">
                <Card.Header className="bg-light">
                  <h6 className="mb-0 fw-bold">Nilai Komitmen</h6>
                </Card.Header>
                <Card.Body>
                  <Row className="mb-2">
                    <Col md={6}>
                      <strong>Komitmen Tahun Berjalan:</strong>
                      <p className="text-primary fw-bold fs-5 mb-0">{formatCurrency(selectedKomitmen.nilaiKomitmen)}</p>
                    </Col>
                    <Col md={6}>
                      <strong>Komitmen Keseluruhan:</strong>
                      <p className="text-success fw-bold fs-5 mb-0">{formatCurrency(selectedKomitmen.komitmenKeseluruhan)}</p>
                    </Col>
                  </Row>
                  <Row className="mb-2">
                    <Col md={6}>
                      <strong>Waktu Pemanfaatan Dari:</strong>
                      <p className="mb-0">{selectedKomitmen.waktuPemanfaatanDari || '-'}</p>
                    </Col>
                    <Col md={6}>
                      <strong>Waktu Pemanfaatan Sampai:</strong>
                      <p className="mb-0">{selectedKomitmen.waktuPemanfaatanSampai || '-'}</p>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {selectedKomitmen.rencanaDetail && selectedKomitmen.rencanaDetail.length > 0 && (
                <Card className="mb-3 shadow-sm">
                  <Card.Header className="bg-light">
                    <h6 className="mb-0 fw-bold">Rencana Realisasi</h6>
                  </Card.Header>
                  <Card.Body>
                    <Table striped bordered hover size="sm">
                      <thead className="table-light">
                        <tr>
                          <th style={{ width: '50px' }}>#</th>
                          {selectedKomitmen.jenisPaket === 'Multi Year (MY)' && <th>Tahun</th>}
                          <th>Nilai Rencana</th>
                          <th>Bulan</th>
                          <th>Keterangan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedKomitmen.rencanaDetail.map((detail, index) => (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            {selectedKomitmen.jenisPaket === 'Multi Year (MY)' && (
                              <td><Badge bg="info">{detail.tahunRencana}</Badge></td>
                            )}
                            <td className="text-end">{formatCurrency(detail.nilaiRencana)}</td>
                            <td>{months.find(m => m.value === parseInt(detail.bulanRencana))?.label || '-'}</td>
                            <td>{detail.keterangan || '-'}</td>
                          </tr>
                        ))}
                        <tr className="table-success fw-bold">
                          <td colSpan={selectedKomitmen.jenisPaket === 'Multi Year (MY)' ? "2" : "1"}>
                            TOTAL RENCANA
                          </td>
                          <td className="text-end">
                            {formatCurrency(
                              selectedKomitmen.rencanaDetail.reduce((sum, d) => sum + (d.nilaiRencana || 0), 0)
                            )}
                          </td>
                          <td colSpan="2"></td>
                        </tr>
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              )}

              <Card className="mb-3 shadow-sm">
                <Card.Header className="bg-light">
                  <h6 className="mb-0 fw-bold">Informasi Keuangan</h6>
                </Card.Header>
                <Card.Body>
                  <Row className="mb-2">
                    <Col md={4}>
                      <strong>PDN:</strong>
                      <p className="mb-1">
                        <Badge bg={selectedKomitmen.pdnCheckbox ? 'success' : 'secondary'}>
                          {selectedKomitmen.pdnCheckbox ? 'TRUE' : 'FALSE'}
                        </Badge>
                      </p>
                      {selectedKomitmen.pdnCheckbox && (
                        <div className="ms-3">
                          <small className="text-muted">Tahun Berjalan:</small>
                          <p className="mb-1">{formatCurrency(selectedKomitmen.nilaiTahunBerjalanPDN || 0)}</p>
                          <small className="text-muted">Keseluruhan:</small>
                          <p className="mb-0">{formatCurrency(selectedKomitmen.nilaiKeseluruhanPDN || 0)}</p>
                        </div>
                      )}
                    </Col>
                    <Col md={4}>
                      <strong>TKDN:</strong>
                      <p className="mb-1">
                        <Badge bg={selectedKomitmen.tkdnCheckbox ? 'success' : 'secondary'}>
                          {selectedKomitmen.tkdnCheckbox ? 'TRUE' : 'FALSE'}
                        </Badge>
                      </p>
                      {selectedKomitmen.tkdnCheckbox && (
                        <div className="ms-3">
                          <small className="text-muted">Tahun Berjalan:</small>
                          <p className="mb-1">{formatCurrency(selectedKomitmen.nilaiTahunBerjalanTKDN || 0)}</p>
                          <small className="text-muted">Keseluruhan:</small>
                          <p className="mb-0">{formatCurrency(selectedKomitmen.nilaiKeseluruhanTKDN || 0)}</p>
                        </div>
                      )}
                    </Col>
                    <Col md={4}>
                      <strong>Import:</strong>
                      <p className="mb-1">
                        <Badge bg={selectedKomitmen.importCheckbox ? 'success' : 'secondary'}>
                          {selectedKomitmen.importCheckbox ? 'TRUE' : 'FALSE'}
                        </Badge>
                      </p>
                      {selectedKomitmen.importCheckbox && (
                        <div className="ms-3">
                          <small className="text-muted">Tahun Berjalan:</small>
                          <p className="mb-1">{formatCurrency(selectedKomitmen.nilaiTahunBerjalanImport || 0)}</p>
                          <small className="text-muted">Keseluruhan:</small>
                          <p className="mb-0">{formatCurrency(selectedKomitmen.nilaiKeseluruhanImport || 0)}</p>
                        </div>
                      )}
                    </Col>
                  </Row>
                  {selectedKomitmen.targetNilaiTKDN > 0 && (
                    <Row className="mt-2">
                      <Col md={12}>
                        <strong>Target Nilai TKDN:</strong>
                        <p className="mb-0">{formatCurrency(selectedKomitmen.targetNilaiTKDN)}</p>
                      </Col>
                    </Row>
                  )}
                  {selectedKomitmen.nilaiAnggaranBelanja > 0 && (
                    <Row className="mt-2">
                      <Col md={12}>
                        <strong>Nilai Anggaran Belanja:</strong>
                        <p className="mb-0">{formatCurrency(selectedKomitmen.nilaiAnggaranBelanja)}</p>
                      </Col>
                    </Row>
                  )}
                  {selectedKomitmen.catatanKomitmen && (
                    <Row className="mt-2">
                      <Col md={12}>
                        <strong>Catatan Komitmen:</strong>
                        <p className="text-muted mb-0">{selectedKomitmen.catatanKomitmen}</p>
                      </Col>
                    </Row>
                  )}
                </Card.Body>
              </Card>

              <Card className="mb-3 shadow-sm">
                <Card.Header className="bg-light">
                  <h6 className="mb-0 fw-bold">Informasi Realisasi</h6>
                </Card.Header>
                <Card.Body>
                  <Row className="mb-3">
                    <Col md={3}>
                      <strong>Nilai Kontrak:</strong>
                      <p className="text-info fw-bold fs-5 mb-0">{formatCurrency(selectedKomitmen.nilaiKontrakKeseluruhan)}</p>
                    </Col>
                    <Col md={3}>
                      <strong>Realisasi:</strong>
                      <p className="text-success fw-bold fs-5 mb-0">{formatCurrency(selectedKomitmen.realisasi)}</p>
                    </Col>
                    <Col md={3}>
                      <strong>Sisa:</strong>
                      <p className="text-warning fw-bold fs-5 mb-0">
                        {formatCurrency((selectedKomitmen.nilaiKontrakKeseluruhan || 0) - (selectedKomitmen.realisasi || 0))}
                      </p>
                    </Col>
                    <Col md={3}>
                      <strong>Progress:</strong>
                      <p className="mb-0">
                        <Badge bg="primary" className="fs-6">{selectedKomitmen.progres || '0'}%</Badge>
                      </p>
                    </Col>
                  </Row>
                  {selectedKomitmen.namaPenyedia && (
                    <Row className="mb-2">
                      <Col md={6}>
                        <strong>Nama Penyedia:</strong>
                        <p className="mb-0">{selectedKomitmen.namaPenyedia}</p>
                      </Col>
                      <Col md={6}>
                        <strong>Kualifikasi:</strong>
                        <p className="mb-0">
                          <Badge bg={selectedKomitmen.kualifikasiPenyedia === 'UMKM' ? 'success' : 'info'}>
                            {selectedKomitmen.kualifikasiPenyedia || '-'}
                          </Badge>
                        </p>
                      </Col>
                    </Row>
                  )}
                  <Row className="mb-2">
                    <Col md={4}>
                      <strong>Nilai PDN:</strong>
                      <p className="mb-0">{formatCurrency(selectedKomitmen.nilaiPDN || 0)}</p>
                    </Col>
                    <Col md={4}>
                      <strong>Nilai TKDN:</strong>
                      <p className="mb-0">{formatCurrency(selectedKomitmen.nilaiKeseluruhanTKDN || selectedKomitmen.nilaiTKDN || 0)}</p>
                    </Col>
                    <Col md={4}>
                      <strong>Nilai Import:</strong>
                      <p className="mb-0">{formatCurrency(selectedKomitmen.nilaiImpor || 0)}</p>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {selectedKomitmen.realisasiDetail && selectedKomitmen.realisasiDetail.length > 0 && (
                <Card className="mb-3 shadow-sm">
                  <Card.Header className="bg-light">
                    <h6 className="mb-0 fw-bold">Detail Realisasi per Periode</h6>
                  </Card.Header>
                  <Card.Body>
                    <Table striped bordered hover size="sm">
                      <thead className="table-light">
                        <tr>
                          <th style={{ width: '50px' }}>#</th>
                          <th>Bulan</th>
                          <th>Nilai Realisasi</th>
                          <th>No. Invoice</th>
                          <th>Tgl Invoice</th>
                          <th>Penyedia</th>
                          <th>Kualifikasi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedKomitmen.realisasiDetail.map((detail, index) => (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            <td>{months.find(m => m.value === parseInt(detail.bulanRealisasi))?.label || '-'}</td>
                            <td className="text-end">{formatCurrency(detail.realisasi)}</td>
                            <td>{detail.nomorInvoice || '-'}</td>
                            <td>{detail.tanggalInvoice || '-'}</td>
                            <td>
                              {detail.namaPenyedia || selectedKomitmen.namaPenyedia || '-'}
                              {detail.namaPengadaanRealisasi && (
                                <><br /><small className="text-muted">{detail.namaPengadaanRealisasi}</small></>
                              )}
                            </td>
                            <td>
                              <Badge bg={detail.kualifikasiPenyedia === 'UMKM' ? 'success' : 'info'}>
                                {detail.kualifikasiPenyedia || selectedKomitmen.kualifikasiPenyedia || '-'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                        <tr className="table-success fw-bold">
                          <td colSpan="2">TOTAL REALISASI</td>
                          <td className="text-end">
                            {formatCurrency(
                              selectedKomitmen.realisasiDetail.reduce((sum, d) => sum + (d.realisasi || 0), 0)
                            )}
                          </td>
                          <td colSpan="4"></td>
                        </tr>
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              )}

              {selectedKomitmen.keterangan && (
                <Card className="mb-3 shadow-sm">
                  <Card.Header className="bg-light">
                    <h6 className="mb-0 fw-bold">📝 Keterangan</h6>
                  </Card.Header>
                  <Card.Body>
                    <p className="mb-0">{selectedKomitmen.keterangan}</p>
                  </Card.Body>
                </Card>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
            Tutup
          </Button>
        </Modal.Footer>
      </Modal>

      {/* MODAL IMPORT */}
      <Modal show={showImportModal} onHide={() => setShowImportModal(false)} size="xl" centered>
        <Modal.Header closeButton>
          <Modal.Title>Preview Import Data - AP: <Badge bg="primary">{userAP}</Badge></Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {importErrors.length > 0 && (
            <Alert variant="danger">
              <strong>Ditemukan {importErrors.length} error:</strong>
              <ul className="mb-0 mt-2">
                {importErrors.slice(0, 10).map((error, index) => (<li key={index}>{error}</li>))}
                {importErrors.length > 10 && (<li>... dan {importErrors.length - 10} error lainnya</li>)}
              </ul>
            </Alert>
          )}
          <Alert variant="info">
            <strong>Total data:</strong> {importPreview.length} baris untuk AP <Badge bg="primary">{userAP}</Badge><br />
            <small className="text-muted">⚠️ Setelah import, Anda akan diminta untuk mengisi Tab Realisasi untuk setiap data</small>
          </Alert>
          <div className="table-responsive">
            <Table striped bordered hover size="sm">
              <thead>
                <tr>
                  <th>#</th><th>ID Paket</th><th>Nama Paket</th><th>Komitmen</th><th>Jenis</th>
                </tr>
              </thead>
              <tbody>
                {importPreview.slice(0, 20).map((item, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td><small>{item['ID Paket Monitoring'] || 'Auto'}</small></td>
                    <td>{item['Nama Paket']}</td>
                    <td>{formatCurrency(item['Nilai Komitmen'])}</td>
                    <td><small>{item['Jenis Paket']}</small></td>
                  </tr>
                ))}
                {importPreview.length > 20 && (
                  <tr><td colSpan="5" className="text-center text-muted">... dan {importPreview.length - 20} baris lainnya</td></tr>
                )}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowImportModal(false)}>Batal</Button>
          <Button variant="primary" onClick={handleImportConfirm} disabled={importing || importErrors.length > 0}>
            {importing ? (<><Spinner animation="border" size="sm" className="me-2" />Importing...</>) : (<>Import {importPreview.length} Data</>)}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showImportRealisasiModal}
        onHide={() => { }}
        size="xl"
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header>
          <Modal.Title>
            Isi Tab Realisasi untuk Data Import ({currentImportIndex + 1}/{importedDataNeedRealisasi.length})
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <Alert variant="warning">
            <strong>⚠️ Wajib Diisi:</strong> Silakan lengkapi Tab Realisasi untuk data yang baru diimport.<br />
            <small>Data: <strong>{formData.namaPaket}</strong> | AP: <strong>{formData.namaAP}</strong></small>
          </Alert>

          <h6 className="fw-bold mb-3 mt-3 text-white bg-primary p-2">DATA KOMITMEN (VIEW ONLY)</h6>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Nama Pengadaan (Komitmen)</Form.Label>
                <Form.Control size="sm" type="text" value={formData.namaPaket} disabled className="bg-light" />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Nilai Anggaran Keseluruhan (Komitmen)</Form.Label>
                <Form.Control size="sm" type="text" value={formData.komitmenKeseluruhan} disabled className="bg-light" />
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Nilai Anggaran Tahun Berjalan (Komitmen)</Form.Label>
                <Form.Control size="sm" type="text" value={formData.nilaiKomitmen} disabled className="bg-light" />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Metode Pemilihan (Komitmen)</Form.Label>
                <Form.Control size="sm" type="text" value={formData.usulanMetodePemilihan} disabled className="bg-light" />
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Jenis Pengadaan (Komitmen)</Form.Label>
                <Form.Control size="sm" type="text" value={formData.jenisPengadaan} disabled className="bg-light" />
              </Form.Group>
            </Col>
          </Row>
          <hr />
          <h6 className="fw-bold mb-3 text-white bg-success p-2">DATA REALISASI (WAJIB DIISI)</h6>
          <Row>
            <Col md={12}>
              <Form.Group className="mb-3">
                <Form.Label>Nilai Kontrak Keseluruhan (Rp) <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  size="sm"
                  type="text"
                  name="nilaiKontrakKeseluruhan"
                  value={formData.nilaiKontrakKeseluruhan}
                  onChange={(e) => handleRupiahChange(e, 'nilaiKontrakKeseluruhan')}
                  placeholder="Masukkan nilai kontrak keseluruhan"
                  className="bg-success bg-opacity-10"
                  required
                />
              </Form.Group>
            </Col>
          </Row>
          <hr />
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Nama Pengadaan (Realisasi)</Form.Label>
                <Form.Control
                  size="sm" type="text" name="namaPengadaanRealisasi"
                  value={formData.namaPengadaanRealisasi || ''} onChange={handleFormChange}
                  placeholder="Masukkan nama pengadaan realisasi" className="bg-success bg-opacity-10"
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Metode Pemilihan (Realisasi)</Form.Label>
                <Form.Select size="sm" name="metodePemilihanRealisasi"
                  value={formData.metodePemilihanRealisasi || formData.usulanMetodePemilihan}
                  onChange={handleFormChange} className="bg-success bg-opacity-10">
                  <option value="Tender/Seleksi Umum">Tender/Seleksi Umum</option>
                  <option value="Tender/Seleksi Terbatas">Tender/Seleksi Terbatas</option>
                  <option value="Penunjukan Langsung">Penunjukan Langsung</option>
                  <option value="Pengadaan Langsung">Pengadaan Langsung</option>
                  <option value="Penetapan Langsung">Penetapan Langsung</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Kualifikasi Penyedia</Form.Label>
                <Form.Select size="sm" name="kualifikasiPenyedia" value={formData.kualifikasiPenyedia || 'UMKM'}
                  onChange={handleFormChange} className="bg-success bg-opacity-10">
                  <option value="UMKM">UMKM</option>
                  <option value="Non UMKM">Non UMKM</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Nama Penyedia <span className="text-danger">*</span></Form.Label>
                <Form.Control size="sm" type="text" name="namaPenyedia" value={formData.namaPenyedia || ''}
                  onChange={handleFormChange} placeholder="Masukkan nama penyedia" className="bg-success bg-opacity-10" />
              </Form.Group>
            </Col>
          </Row>
          <hr className="my-4" />
          <h6 className="fw-bold mb-3">Detail Realisasi per Periode <span className="text-danger">*</span></h6>
          <Row className="mb-2 bg-light py-2 border rounded">
            <Col md={2}><Form.Label className="fw-bold small mb-0">Nilai Realisasi (Rp)</Form.Label></Col>
            <Col md={2}><Form.Label className="fw-bold small mb-0">Bulan</Form.Label></Col>
            <Col md={2}><Form.Label className="fw-bold small mb-0">Nomor Invoice</Form.Label></Col>
            <Col md={2}><Form.Label className="fw-bold small mb-0">Tanggal Invoice</Form.Label></Col>
            <Col md={2}><Form.Label className="fw-bold small mb-0">Upload Dokumen</Form.Label></Col>
            <Col md={2} className="text-center"><Form.Label className="fw-bold small mb-0">Aksi</Form.Label></Col>
          </Row>

          {realisasiRows.map((row, index) => (
            <Row key={row.id} className="mb-2 align-items-center border-bottom pb-2">
              <Col md={2}>
                <Form.Control type="text" value={row.realisasi || ''}
                  onChange={(e) => handleRealisasiRupiahChange(index, 'realisasi', e.target.value)}
                  placeholder="0" className="bg-success bg-opacity-10" size="sm" />
              </Col>
              <Col md={2}>
                <Form.Select value={row.bulanRealisasi || ''}
                  onChange={(e) => handleRealisasiChange(index, 'bulanRealisasi', e.target.value)}
                  className="bg-success bg-opacity-10" size="sm">
                  <option value="">Pilih Bulan</option>
                  {months.map(m => (<option key={m.value} value={m.value}>{m.label}</option>))}
                </Form.Select>
              </Col>
              <Col md={2}>
                <Form.Control type="text" value={row.nomorInvoice || ''}
                  onChange={(e) => handleRealisasiChange(index, 'nomorInvoice', e.target.value)}
                  placeholder="INV-001" className="bg-success bg-opacity-10" size="sm" />
              </Col>
              <Col md={2}>
                <Form.Control type="date" value={row.tanggalInvoice || ''}
                  onChange={(e) => handleRealisasiChange(index, 'tanggalInvoice', e.target.value)}
                  className="bg-success bg-opacity-10" size="sm" />
              </Col>
              <Col md={2}>
                {row.dokumen ? (
                  <Badge bg="success" className="w-100">File Terupload</Badge>
                ) : (
                  <Form.Control type="file"
                    onChange={(e) => handleRealisasiChange(index, 'dokumen', e.target.files[0])}
                    accept=".pdf,.jpg,.jpeg,.png" size="sm" />
                )}
              </Col>
              <Col md={2} className="text-center">
                {index === realisasiRows.length - 1 && (
                  <Button variant="primary" size="sm" onClick={addRealisasiRow} className="me-1"><FaPlus /></Button>
                )}
                {realisasiRows.length > 1 && (
                  <Button variant="danger" size="sm" onClick={() => removeRealisasiRow(index)}><FaTimes /></Button>
                )}
              </Col>
            </Row>
          ))}
          <hr className="my-4" />
          <Row className="mb-3">
            <Col md={4}>
              <Alert variant="warning" className="mb-0">
                <strong>Progress:</strong> {formData.progres || '0'}%<br />
                <small className="text-muted">Otomatis dari Total Realisasi / {formData.jenisPaket === 'Multi Year (MY)' ? 'Nilai Kontrak' : 'Komitmen'}</small>
              </Alert>
            </Col>
            <Col md={4}>
              <Alert variant="info" className="mb-0">
                <strong>Sisa Pembayaran:</strong> {formData.sisaPembayaran || 'Rp 0'}<br />
                <small className="text-muted">Otomatis dari {formData.jenisPaket === 'Multi Year (MY)' ? 'Nilai Kontrak' : 'Komitmen'} - Total Realisasi</small>
              </Alert>
            </Col>
            <Col md={4}>
              <Alert variant="success" className="mb-0">
                <strong>Total Realisasi:</strong> {formatRupiahInput(
                  realisasiRows.reduce((sum, row) => sum + parseRupiahInput(row.realisasi), 0).toString()
                )}<br />
                <small className="text-muted">SUM dari Detail per Periode</small>
              </Alert>
            </Col>
          </Row>
          <hr />
          <h6 className="fw-bold mb-3">Nilai Rupiah (Optional)</h6>
          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Nilai PDN (Rp)</Form.Label>
                <Form.Control type="text" name="nilaiPDN" value={formData.nilaiPDN}
                  onChange={(e) => handleRupiahChange(e, 'nilaiPDN')} placeholder="0" className="bg-success bg-opacity-10" />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Nilai TKDN (Rp)</Form.Label>
                <Form.Control type="text" name="nilaiTKDN" value={formData.nilaiTKDN}
                  onChange={(e) => handleRupiahChange(e, 'nilaiTKDN')} placeholder="0" className="bg-success bg-opacity-10" />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Nilai Impor (Rp)</Form.Label>
                <Form.Control type="text" name="nilaiImpor" value={formData.nilaiImpor}
                  onChange={(e) => handleRupiahChange(e, 'nilaiImpor')} placeholder="0" className="bg-success bg-opacity-10" />
              </Form.Group>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer className="d-flex justify-content-between">
          <div>
            <small className="text-muted">
              Data {currentImportIndex + 1} dari {importedDataNeedRealisasi.length}
            </small>
          </div>
          <div className="d-flex gap-2">
            <Button variant="secondary" onClick={handleSkipImportedRealisasi}>
              Lewati (Isi Nanti)
            </Button>
            <Button variant="primary" onClick={handleSaveImportedRealisasi} disabled={loading}>
              {loading ? <Spinner animation="border" size="sm" /> : 'Simpan & Lanjut'}
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
      {/* MODAL REQUEST REVISI */}
      <Modal show={showRevisiModal} onHide={() => setShowRevisiModal(false)} centered>
        <Modal.Header closeButton className="bg-warning">
          <Modal.Title>
            <FaUndo className="me-2" />
            {selectedRevisiItem?.approvalStatus === 'draft' ? 'Tarik Submission' : 'Request Revisi Data Komitmen'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedRevisiItem && (
            <>
              <Alert variant="info" className="mb-3">
                <strong>Paket:</strong> {selectedRevisiItem.namaPaket}<br />
                <strong>ID:</strong> <span className="font-monospace">{selectedRevisiItem.idPaketMonitoring}</span>
              </Alert>
              {selectedRevisiItem.approvalStatus === 'draft' ? (
                <Alert variant="warning" className="mb-3">
                  <small>
                    <FaExclamationTriangle className="me-1" />
                    Komitmen ini sedang <strong>menunggu approval admin</strong>. Dengan menarik submission,
                    status akan langsung berubah ke <strong>"Rejected"</strong> sehingga Anda dapat mengedit
                    dan submit ulang tanpa perlu menunggu admin.
                  </small>
                </Alert>
              ) : (
                <Alert variant="warning" className="mb-3">
                  <small>
                    <FaExclamationTriangle className="me-1" />
                    Dengan mengajukan request revisi, status komitmen akan berubah menjadi <strong>"Request Revisi"</strong>.
                    Admin akan mereview permintaan Anda dan membuka akses edit data komitmen awal jika disetujui.
                  </small>
                </Alert>
              )}
              <Form.Group>
                <Form.Label>
                  {selectedRevisiItem.approvalStatus === 'draft' ? 'Alasan Penarikan' : 'Catatan / Alasan Revisi'}{' '}
                  <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={revisiNote}
                  onChange={(e) => setRevisiNote(e.target.value)}
                  placeholder={
                    selectedRevisiItem.approvalStatus === 'draft'
                      ? "Jelaskan alasan penarikan submission..."
                      : "Jelaskan apa yang perlu direvisi dan alasannya..."
                  }
                  maxLength={500}
                />
                <Form.Text className="text-muted">
                  {revisiNote.length}/500 karakter
                </Form.Text>
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRevisiModal(false)}>
            Batal
          </Button>
          <Button
            variant="warning"
            onClick={handleSubmitRevisi}
            disabled={submittingRevisi || !revisiNote.trim()}
          >
            {submittingRevisi
              ? <><Spinner animation="border" size="sm" className="me-1" /> Memproses...</>
              : selectedRevisiItem?.approvalStatus === 'draft'
                ? <><FaUndo className="me-1" /> Tarik Submission</>
                : <><FaUndo className="me-1" /> Kirim Request Revisi</>
            }
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default PICKomitmen;
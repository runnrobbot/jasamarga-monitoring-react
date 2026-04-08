import { useState, useEffect } from 'react';
import { Container, Card, Row, Col, Form, Button, Alert, Badge, Spinner, Modal, Tabs, Tab, Table } from 'react-bootstrap';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import NavigationBar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import { FaSave, FaCog, FaDownload, FaUpload, FaInfoCircle, FaCheckCircle, FaDatabase, FaFileExcel, FaBell, FaBuilding, FaCalendarAlt, FaEdit, FaTrash, FaPlus, FaClock, FaTimes } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import * as XLSX from 'xlsx';
import 'react-toastify/dist/ReactToastify.css';

import NotificationManager from '../../components/NotificationManager';
import { createAnnouncement } from '../../utils/notificationService';

const AdminSettings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [backupProgress, setBackupProgress] = useState(0);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [activeTab, setActiveTab] = useState('general');
  
  const [masterAPList, setMasterAPList] = useState([]);
  const [schedules, setSchedules] = useState({});
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    apId: '',
    namaAP: '',
    tanggalBuka: '',
    tanggalTutup: '',
    isActive: true,
    keterangan: ''
  });

  const [showBulkActivateModal, setShowBulkActivateModal] = useState(false);
  const [showBulkDeactivateModal, setShowBulkDeactivateModal] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    tanggalBuka: '',
    tanggalTutup: '',
    keterangan: ''
  });
  
  const [settings, setSettings] = useState({
    appName: 'Jasa Marga AP Monitoring',
    appVersion: '2.0.0',
    tahunAnggaran: new Date().getFullYear().toString(),
    autoBackup: false,
    maintenanceMode: false,
    backupLocation: 'local',
    language: 'id',
    dateFormat: 'DD/MM/YYYY',
    currency: 'IDR',
    maxFileSize: 10,
    allowedFileTypes: 'xlsx,xls,csv',
    sessionTimeout: 30,
    showWelcomeMessage: true,
    theme: 'light',
  });
  
  const [dbStats, setDbStats] = useState({
    users: 0,
    komitmen: 0,
    masterAP: 0,
    settings: 0
  });

  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    loadSettings();
    loadDatabaseStats();
    loadMasterAP();
    loadSchedules();
  }, []);

  useEffect(() => {
    if (refreshCounter > 0) {
      loadSchedules();
    }
  }, [refreshCounter]);

  const loadMasterAP = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'masterAP'));
      const apList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).filter(ap => ap.isActive);
      setMasterAPList(apList);
    } catch (error) {
      console.error('Error loading Master AP:', error);
      toast.error('Gagal memuat Master AP');
    }
  };

  const loadSchedules = async () => {
    try {
      const scheduleDoc = await getDoc(doc(db, 'settings', 'apSchedules'));
      if (scheduleDoc.exists()) {
        const data = scheduleDoc.data();
        setSchedules(data);
      } else {
        setSchedules({});
      }
    } catch (error) {
      console.error('Error loading schedules:', error);
      toast.error('Gagal memuat schedules');
    }
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    
    if (!scheduleForm.apId || !scheduleForm.tanggalBuka || !scheduleForm.tanggalTutup) {
      toast.error('Mohon lengkapi semua field!');
      return;
    }

    const tanggalBuka = new Date(scheduleForm.tanggalBuka);
    const tanggalTutup = new Date(scheduleForm.tanggalTutup);

    if (tanggalTutup <= tanggalBuka) {
      toast.error('Tanggal tutup harus setelah tanggal buka!');
      return;
    }

    try {
      setLoading(true);
      
      const newSchedule = {
        apId: scheduleForm.apId,
        namaAP: scheduleForm.namaAP,
        tanggalBuka: scheduleForm.tanggalBuka,
        tanggalTutup: scheduleForm.tanggalTutup,
        isActive: scheduleForm.isActive,
        keterangan: scheduleForm.keterangan,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid || 'admin'
      };

      const updatedSchedules = {
        ...schedules,
        [scheduleForm.apId]: newSchedule
      };

      await setDoc(doc(db, 'settings', 'apSchedules'), updatedSchedules);
      setSchedules({ ...updatedSchedules });
      
      toast.success(`Schedule untuk ${scheduleForm.namaAP} berhasil disimpan!`);
      
      try {
        await createAnnouncement(
          user.uid,
          `📅 Schedule ${scheduleForm.namaAP} Diupdate`,
          `Periode input: ${new Date(scheduleForm.tanggalBuka).toLocaleDateString('id-ID')} - ${new Date(scheduleForm.tanggalTutup).toLocaleDateString('id-ID')}. ${scheduleForm.keterangan}`,
          'pic',
          'high'
        );
      } catch (notifError) {
        console.warn('Gagal mengirim pengumuman:', notifError);
      }
      
      handleCloseScheduleModal();
      setRefreshCounter(prev => prev + 1);
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast.error('Gagal menyimpan schedule: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSchedule = async (apId) => {
    if (!window.confirm('Hapus schedule untuk AP ini?')) return;

    try {
      setLoading(true);
      const updatedSchedules = { ...schedules };
      delete updatedSchedules[apId];
      
      await setDoc(doc(db, 'settings', 'apSchedules'), updatedSchedules);
      setSchedules({ ...updatedSchedules });
      
      toast.success('Schedule berhasil dihapus!');
      setRefreshCounter(prev => prev + 1);
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast.error('Gagal menghapus schedule: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenScheduleModal = (ap = null) => {
    if (ap) {
      const existingSchedule = schedules[ap.id];
      setScheduleForm({
        apId: ap.id,
        namaAP: ap.namaAP,
        tanggalBuka: existingSchedule?.tanggalBuka || '',
        tanggalTutup: existingSchedule?.tanggalTutup || '',
        isActive: existingSchedule?.isActive !== undefined ? existingSchedule.isActive : true,
        keterangan: existingSchedule?.keterangan || ''
      });
      setEditingSchedule(ap);
    } else {
      setScheduleForm({
        apId: '',
        namaAP: '',
        tanggalBuka: '',
        tanggalTutup: '',
        isActive: true,
        keterangan: ''
      });
      setEditingSchedule(null);
    }
    setShowScheduleModal(true);
  };

  const handleCloseScheduleModal = () => {
    setShowScheduleModal(false);
    setEditingSchedule(null);
    setScheduleForm({
      apId: '',
      namaAP: '',
      tanggalBuka: '',
      tanggalTutup: '',
      isActive: true,
      keterangan: ''
    });
  };

  const handleOpenBulkActivate = () => {
    setBulkForm({
      tanggalBuka: '',
      tanggalTutup: '',
      keterangan: ''
    });
    setShowBulkActivateModal(true);
  };

  const handleOpenBulkDeactivate = () => {
    setShowBulkDeactivateModal(true);
  };

  const handleBulkActivateConfirm = async () => {
    if (!bulkForm.tanggalBuka || !bulkForm.tanggalTutup) {
      toast.error('Tanggal Buka dan Tanggal Tutup wajib diisi!');
      return;
    }

    const tanggalBuka = new Date(bulkForm.tanggalBuka);
    const tanggalTutup = new Date(bulkForm.tanggalTutup);

    if (tanggalTutup <= tanggalBuka) {
      toast.error('Tanggal tutup harus setelah tanggal buka!');
      return;
    }

    try {
      setLoading(true);
      
      const updatedSchedules = {};
      let updatedCount = 0;

      for (const ap of masterAPList) {
        const existingSchedule = schedules[ap.id];
        
        updatedSchedules[ap.id] = {
          apId: ap.id,
          namaAP: ap.namaAP,
          tanggalBuka: bulkForm.tanggalBuka,
          tanggalTutup: bulkForm.tanggalTutup,
          isActive: true,
          keterangan: bulkForm.keterangan || (existingSchedule?.keterangan || ''),
          updatedAt: new Date().toISOString(),
          updatedBy: user?.uid || 'admin'
        };
        
        updatedCount++;
      }

      await setDoc(doc(db, 'settings', 'apSchedules'), updatedSchedules);
      
      setSchedules({ ...updatedSchedules });
      
      toast.success(`${updatedCount} AP berhasil diaktifkan!`);
      
      try {
        await createAnnouncement(
          user.uid,
          'Schedule Semua AP Diaktifkan',
          `Admin telah mengaktifkan schedule untuk ${updatedCount} AP. Periode: ${new Date(bulkForm.tanggalBuka).toLocaleDateString('id-ID')} - ${new Date(bulkForm.tanggalTutup).toLocaleDateString('id-ID')}. Silakan cek periode input Anda.`,
          'pic',
          'high'
        );
      } catch (notifError) {
        console.warn('Gagal mengirim pengumuman:', notifError);
      }

      setShowBulkActivateModal(false);
      setRefreshCounter(prev => prev + 1);
      
    } catch (error) {
      console.error('Error bulk activate:', error);
      toast.error('Gagal mengaktifkan schedule: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDeactivateConfirm = async () => {
    try {
      setLoading(true);
      
      const updatedSchedules = Object.keys(schedules).reduce((acc, apId) => {
        const schedule = schedules[apId];
        acc[apId] = {
          ...schedule,
          isActive: false,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.uid || 'admin'
        };
        return acc;
      }, {});

      const deactivatedCount = Object.keys(schedules).length;

      if (deactivatedCount === 0) {
        toast.info('Tidak ada schedule yang perlu dinonaktifkan');
        setLoading(false);
        setShowBulkDeactivateModal(false);
        return;
      }

      await setDoc(doc(db, 'settings', 'apSchedules'), updatedSchedules);
      
      setSchedules({ ...updatedSchedules });
      
      toast.warning(`${deactivatedCount} AP berhasil dinonaktifkan!`);
      
      try {
        await createAnnouncement(
          user.uid,
          '🚫 Schedule Semua AP Dinonaktifkan',
          `Admin telah menonaktifkan schedule untuk ${deactivatedCount} AP. Input data ditutup sementara.`,
          'pic',
          'high'
        );
      } catch (notifError) {
        console.warn('Gagal mengirim pengumuman:', notifError);
      }

      setShowBulkDeactivateModal(false);
      setRefreshCounter(prev => prev + 1);
      
    } catch (error) {
      console.error('Error bulk deactivate:', error);
      toast.error('Gagal menonaktifkan schedule: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getScheduleStatus = (apId) => {
    const schedule = schedules[apId];
    if (!schedule) return { status: 'no-schedule', message: 'Belum ada schedule', color: 'secondary' };
    if (!schedule.isActive) return { status: 'disabled', message: 'Schedule dinonaktifkan', color: 'danger' };

    const now = new Date();
    const tanggalBuka = new Date(schedule.tanggalBuka);
    const tanggalTutup = new Date(schedule.tanggalTutup);

    if (now < tanggalBuka) {
      return { 
        status: 'not-open', 
        message: `Belum dibuka (${tanggalBuka.toLocaleDateString('id-ID')})`, 
        color: 'warning' 
      };
    } else if (now > tanggalTutup) {
      return { 
        status: 'closed', 
        message: `Sudah ditutup (${tanggalTutup.toLocaleDateString('id-ID')})`, 
        color: 'danger' 
      };
    } else {
      return { 
        status: 'open', 
        message: `Aktif hingga ${tanggalTutup.toLocaleDateString('id-ID')}`, 
        color: 'success' 
      };
    }
  };

  const loadSettings = async () => {
    try {
      setInitialLoading(true);
      const settingsDoc = await getDoc(doc(db, 'settings', 'app'));
      if (settingsDoc.exists()) {
        setSettings(prev => ({
          ...prev,
          ...settingsDoc.data()
        }));
      } else {
        await handleSave(null, true);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Gagal memuat pengaturan');
    } finally {
      setInitialLoading(false);
    }
  };

  const loadDatabaseStats = async () => {
    try {
      const collections = ['users', 'komitmen', 'masterAP', 'settings'];
      const stats = {};
      
      for (const collectionName of collections) {
        const snapshot = await getDocs(collection(db, collectionName));
        stats[collectionName] = snapshot.size;
      }
      
      setDbStats(stats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async (e, silent = false) => {
    if (e) e.preventDefault();
    setLoading(true);
    
    try {
      const settingsData = {
        ...settings,
        updatedAt: new Date(),
        updatedBy: user?.uid || 'system'
      };
      
      await setDoc(doc(db, 'settings', 'app'), settingsData);
      
      if (!silent) {
        toast.success('Pengaturan berhasil disimpan!');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Gagal menyimpan pengaturan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMaintenanceToggle = async (e) => {
    const enabled = e.target.checked;
    
    setSettings(prev => ({ ...prev, maintenanceMode: enabled }));
    
    try {
      await setDoc(doc(db, 'settings', 'app'), {
        ...settings,
        maintenanceMode: enabled,
        updatedAt: new Date(),
        updatedBy: user?.uid || 'system'
      });

      if (enabled) {
        await createAnnouncement(
          user.uid,
          '⚠️ Mode Maintenance Aktif',
          'Sistem sedang dalam mode maintenance. Akses dibatasi untuk admin saja.',
          'all',
          'high'
        );
        toast.warning('Mode maintenance diaktifkan!');
      } else {
        await createAnnouncement(
          user.uid,
          'Sistem Kembali Normal',
          'Mode maintenance telah selesai. Sistem kembali normal.',
          'all',
          'medium'
        );
        toast.success('Mode maintenance dinonaktifkan!');
      }
    } catch (error) {
      console.error('Error toggling maintenance:', error);
      toast.error('Gagal mengubah mode maintenance');
    }
  };

  const handleReset = async () => {
    if (window.confirm('⚠️ Reset semua pengaturan ke default?')) {
      const defaultSettings = {
        appName: 'Jasa Marga AP Monitoring',
        appVersion: '2.0.0',
        tahunAnggaran: new Date().getFullYear().toString(),
        autoBackup: false,
        maintenanceMode: false,
        backupLocation: 'local',
        language: 'id',
        dateFormat: 'DD/MM/YYYY',
        currency: 'IDR',
        maxFileSize: 10,
        allowedFileTypes: 'xlsx,xls,csv',
        sessionTimeout: 30,
        showWelcomeMessage: true,
        theme: 'light'
      };
      
      setSettings(defaultSettings);
      
      try {
        await setDoc(doc(db, 'settings', 'app'), {
          ...defaultSettings,
          updatedAt: new Date(),
          updatedBy: user?.uid || 'system'
        });
        toast.success('Pengaturan berhasil di-reset!');
      } catch (error) {
        console.error('Error resetting settings:', error);
        toast.error('Gagal reset pengaturan');
      }
    }
  };

  const handleBackupNow = async () => {
    try {
      setLoading(true);
      setBackupProgress(0);
      toast.info('Memulai backup database...');

      const collections = ['users', 'komitmen', 'masterAP', 'settings', 'notifications'];
      const backupData = {
        metadata: {
          backupDate: new Date().toISOString(),
          backupBy: user?.uid || 'admin',
          version: settings.appVersion,
          collections: collections
        }
      };

      let progress = 0;
      const progressStep = 80 / collections.length;

      for (const collectionName of collections) {
        const snapshot = await getDocs(collection(db, collectionName));
        
        const data = snapshot.docs.map(doc => {
          const docData = doc.data();
          const plainData = { id: doc.id };
          
          for (const [key, value] of Object.entries(docData)) {
            if (value && typeof value === 'object' && value.toDate) {
              plainData[key] = value.toDate().toISOString();
            } else if (typeof value === 'object' && value !== null) {
              plainData[key] = JSON.stringify(value);
            } else {
              plainData[key] = value;
            }
          }
          
          return plainData;
        });
        
        backupData[collectionName] = data;
        progress += progressStep;
        setBackupProgress(Math.round(progress));
      }

      setBackupProgress(90);

      const wb = XLSX.utils.book_new();
      const metadataSheet = XLSX.utils.json_to_sheet([backupData.metadata]);
      XLSX.utils.book_append_sheet(wb, metadataSheet, 'Metadata');

      for (const collectionName of collections) {
        const data = backupData[collectionName];
        if (data && data.length > 0) {
          const ws = XLSX.utils.json_to_sheet(data);
          const wscols = Object.keys(data[0]).map(() => ({ wch: 20 }));
          ws['!cols'] = wscols;
          XLSX.utils.book_append_sheet(wb, ws, collectionName);
        }
      }

      setBackupProgress(95);

      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `Backup_v2_${timestamp}.xlsx`;
      XLSX.writeFile(wb, filename);

      setBackupProgress(100);

      const totalDocs = collections.reduce((sum, col) => 
        sum + (backupData[col]?.length || 0), 0
      );

      toast.success(`Backup berhasil! (${totalDocs} documents)`);
      
      await loadDatabaseStats();
      
      setTimeout(() => {
        setBackupProgress(0);
        setLoading(false);
      }, 2000);

    } catch (error) {
      toast.error('Gagal membuat backup: ' + error.message);
      setLoading(false);
      setBackupProgress(0);
    }
  };

  const handleExportSettings = () => {
    try {
      const exportData = {
        ...settings,
        exportedAt: new Date().toISOString(),
        exportedBy: user?.uid || 'admin'
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `settings_${timestamp}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', filename);
      linkElement.click();
      
      toast.success(`Pengaturan di-export: ${filename}`);
    } catch (error) {
      toast.error('Gagal export pengaturan');
    }
  };

  const handleImportSettings = () => {
    setShowImportModal(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type === 'application/json') {
        setImportFile(file);
      } else {
        toast.error('File harus berformat JSON!');
      }
    }
  };

  const handleImportSubmit = async () => {
    if (!importFile) {
      toast.error('Pilih file terlebih dahulu!');
      return;
    }

    try {
      setLoading(true);
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const importedData = JSON.parse(e.target.result);
          
          if (!importedData.appName || !importedData.tahunAnggaran) {
            toast.error('Format file tidak valid!');
            return;
          }
          
          delete importedData.exportedAt;
          delete importedData.exportedBy;
          delete importedData.updatedAt;
          delete importedData.updatedBy;
          
          setSettings(prev => ({
            ...prev,
            ...importedData
          }));
          
          toast.success('Pengaturan berhasil di-import! Klik "Simpan" untuk menyimpan.');
          setShowImportModal(false);
          setImportFile(null);
        } catch (parseError) {
          toast.error('Format file tidak valid');
        } finally {
          setLoading(false);
        }
      };
      
      reader.readAsText(importFile);
    } catch (error) {
      toast.error('Gagal import pengaturan');
      setLoading(false);
    }
  };

  const years = [];
  const currentYear = new Date().getFullYear();
  for (let i = currentYear - 2; i <= currentYear + 5; i++) {
    years.push(i.toString());
  }

  if (initialLoading) {
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
              minHeight: '100vh'
            }}
          >
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" size="lg" />
              <p className="mt-3 text-muted">Memuat pengaturan...</p>
            </div>
          </Container>
        </div>
      </>
    );
  }

  return (
    <>
      <NavigationBar />
      <ToastContainer position="top-right" autoClose={3000} />
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
          <div className="mb-4">
            <h2 className="fw-bold mb-1">
              <FaCog className="me-2" />
              Pengaturan Sistem
            </h2>
            <p className="text-muted mb-0">Konfigurasi dan manajemen sistem monitoring AP</p>
          </div>

          <Row className="g-3 mb-4">
            <Col md={3}>
              <Card className="shadow-sm border-start border-primary border-4">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h6 className="text-muted mb-1">Total Users</h6>
                      <h3 className="mb-0">{dbStats.users}</h3>
                    </div>
                    <FaDatabase size={32} className="text-primary" />
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="shadow-sm border-start border-success border-4">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h6 className="text-muted mb-1">Komitmen</h6>
                      <h3 className="mb-0">{dbStats.komitmen}</h3>
                    </div>
                    <FaFileExcel size={32} className="text-success" />
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="shadow-sm border-start border-warning border-4">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h6 className="text-muted mb-1">Master AP</h6>
                      <h3 className="mb-0">{dbStats.masterAP}</h3>
                    </div>
                    <FaBuilding size={32} className="text-warning" />
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="shadow-sm border-start border-info border-4">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h6 className="text-muted mb-1">Settings</h6>
                      <h3 className="mb-0">{dbStats.settings}</h3>
                    </div>
                    <FaCog size={32} className="text-info" />
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-4">
            <Tab eventKey="general" title={<span><FaCog className="me-2" />Umum</span>}>
              <Form onSubmit={handleSave}>
                <Row className="g-4">
                  <Col md={6}>
                    <Card className="shadow-sm h-100">
                      <Card.Header className="bg-primary text-white">
                        <h5 className="mb-0">Pengaturan Umum</h5>
                      </Card.Header>
                      <Card.Body>
                        <Form.Group className="mb-3">
                          <Form.Label>Nama Aplikasi</Form.Label>
                          <Form.Control
                            type="text"
                            name="appName"
                            value={settings.appName}
                            onChange={handleChange}
                            required
                          />
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Label>Versi Aplikasi</Form.Label>
                          <Form.Control
                            type="text"
                            name="appVersion"
                            value={settings.appVersion}
                            onChange={handleChange}
                            required
                          />
                          <Form.Text className="text-muted">
                            Current: v2.0.0 (Refactored)
                          </Form.Text>
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Label>Tahun Anggaran</Form.Label>
                          <Form.Select
                            name="tahunAnggaran"
                            value={settings.tahunAnggaran}
                            onChange={handleChange}
                          >
                            {years.map(year => (
                              <option key={year} value={year}>{year}</option>
                            ))}
                          </Form.Select>
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Check
                            type="switch"
                            name="maintenanceMode"
                            label={
                              <span>
                                Mode Maintenance {settings.maintenanceMode && <Badge bg="danger" className="ms-2">AKTIF</Badge>}
                              </span>
                            }
                            checked={settings.maintenanceMode}
                            onChange={handleMaintenanceToggle}
                          />
                          <Form.Text className="text-muted">
                            Nonaktifkan akses untuk semua user (kecuali admin)
                          </Form.Text>
                        </Form.Group>

                        {settings.maintenanceMode && (
                          <Alert variant="danger">
                            <FaInfoCircle className="me-2" />
                            <strong>Perhatian:</strong> Mode maintenance aktif!
                          </Alert>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>

                  <Col md={6}>
                    <Card className="shadow-sm h-100">
                      <Card.Header className="bg-warning text-dark">
                        <h5 className="mb-0">Tampilan & Format</h5>
                      </Card.Header>
                      <Card.Body>
                        <Form.Group className="mb-3">
                          <Form.Label>Bahasa</Form.Label>
                          <Form.Select
                            name="language"
                            value={settings.language}
                            onChange={handleChange}
                          >
                            <option value="id">Bahasa Indonesia</option>
                            <option value="en">English</option>
                          </Form.Select>
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Label>Format Tanggal</Form.Label>
                          <Form.Select
                            name="dateFormat"
                            value={settings.dateFormat}
                            onChange={handleChange}
                          >
                            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                          </Form.Select>
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Label>Mata Uang</Form.Label>
                          <Form.Select
                            name="currency"
                            value={settings.currency}
                            onChange={handleChange}
                          >
                            <option value="IDR">Rupiah (IDR)</option>
                            <option value="USD">Dollar (USD)</option>
                          </Form.Select>
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Label>Theme</Form.Label>
                          <Form.Select
                            name="theme"
                            value={settings.theme}
                            onChange={handleChange}
                          >
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                            <option value="auto">Auto</option>
                          </Form.Select>
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Check
                            type="switch"
                            name="showWelcomeMessage"
                            label="Tampilkan Pesan Selamat Datang"
                            checked={settings.showWelcomeMessage}
                            onChange={handleChange}
                          />
                        </Form.Group>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>

                <div className="mt-4 d-flex justify-content-end gap-2">
                  <Button 
                    variant="outline-secondary" 
                    type="button" 
                    onClick={handleReset}
                    disabled={loading}
                  >
                    Reset ke Default
                  </Button>
                  <Button 
                    variant="primary" 
                    type="submit" 
                    disabled={loading}
                    size="lg"
                  >
                    <FaSave className="me-2" />
                    {loading ? 'Menyimpan...' : 'Simpan Pengaturan'}
                  </Button>
                </div>
              </Form>
            </Tab>

            <Tab eventKey="schedule" title={<span><FaCalendarAlt className="me-2" />Schedule AP</span>}>
              <Card className="shadow-sm">
                <Card.Header className="bg-primary text-white d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">
                    <FaCalendarAlt className="me-2" />
                    Manajemen Schedule Per AP
                  </h5>
                  <div className="d-flex gap-2">
                    <Button 
                      variant="success" 
                      size="sm"
                      onClick={handleOpenBulkActivate}
                      disabled={loading}
                    >
                      <FaCheckCircle className="me-2" />
                      Aktifkan Semua
                    </Button>
                    <Button 
                      variant="danger" 
                      size="sm"
                      onClick={handleOpenBulkDeactivate}
                      disabled={loading}
                    >
                      <FaTimes className="me-2" />
                      Tutup Semua
                    </Button>
                    <Button 
                      variant="light" 
                      size="sm"
                      onClick={() => handleOpenScheduleModal()}
                    >
                      <FaPlus className="me-2" />
                      Tambah Schedule
                    </Button>
                  </div>
                </Card.Header>
                <Card.Body>
                  <Alert variant="info" className="mb-4">
                    <FaInfoCircle className="me-2" />
                    <strong>Cara Kerja Schedule:</strong>
                    <ul className="mb-0 mt-2">
                      <li>Setiap AP memiliki periode input data</li>
                      <li>PIC tidak bisa input/import jika belum dibuka atau sudah ditutup</li>
                      <li>Pengumuman otomatis dikirim saat schedule diupdate</li>
                    </ul>
                  </Alert>

                  <div className="table-responsive">
                    <Table striped bordered hover>
                      <thead className="table-dark">
                        <tr>
                          <th>No</th>
                          <th>Nama AP</th>
                          <th>Singkatan</th>
                          <th>Tanggal Buka</th>
                          <th>Tanggal Tutup</th>
                          <th>Status</th>
                          <th>Keterangan</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {masterAPList.length === 0 ? (
                          <tr>
                            <td colSpan="8" className="text-center">Tidak ada data Master AP</td>
                          </tr>
                        ) : (
                          masterAPList.map((ap, index) => {
                            const schedule = schedules[ap.id];
                            const status = getScheduleStatus(ap.id);
                            return (
                              <tr key={ap.id}>
                                <td>{index + 1}</td>
                                <td><strong>{ap.namaAP}</strong></td>
                                <td><Badge bg="secondary">{ap.singkatanAP}</Badge></td>
                                <td>
                                  {schedule?.tanggalBuka ? (
                                    <span className="text-success">
                                      <FaClock className="me-1" />
                                      {new Date(schedule.tanggalBuka).toLocaleDateString('id-ID')}
                                    </span>
                                  ) : (
                                    <span className="text-muted">-</span>
                                  )}
                                </td>
                                <td>
                                  {schedule?.tanggalTutup ? (
                                    <span className="text-danger">
                                      <FaClock className="me-1" />
                                      {new Date(schedule.tanggalTutup).toLocaleDateString('id-ID')}
                                    </span>
                                  ) : (
                                    <span className="text-muted">-</span>
                                  )}
                                </td>
                                <td>
                                  <Badge bg={status.color}>{status.message}</Badge>
                                </td>
                                <td>
                                  <small className="text-muted">{schedule?.keterangan || '-'}</small>
                                </td>
                                <td>
                                  <div className="d-flex gap-1">
                                    <Button 
                                      variant="warning" 
                                      size="sm"
                                      onClick={() => handleOpenScheduleModal(ap)}
                                      title="Edit Schedule"
                                    >
                                      <FaEdit />
                                    </Button>
                                    {schedule && (
                                      <Button 
                                        variant="danger" 
                                        size="sm"
                                        onClick={() => handleDeleteSchedule(ap.id)}
                                        title="Hapus Schedule"
                                      >
                                        <FaTrash />
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </Table>
                  </div>
                </Card.Body>
              </Card>
            </Tab>

            <Tab eventKey="backup" title={<span><FaDatabase className="me-2" />Backup</span>}>
              <Row className="g-4">
                <Col md={6}>
                  <Card className="shadow-sm h-100">
                    <Card.Header className="bg-success text-white">
                      <h5 className="mb-0">Backup & Keamanan</h5>
                    </Card.Header>
                    <Card.Body>
                      <Form.Group className="mb-3">
                        <Form.Check
                          type="switch"
                          name="autoBackup"
                          label="Auto Backup Harian"
                          checked={settings.autoBackup}
                          onChange={handleChange}
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Lokasi Backup</Form.Label>
                        <Form.Select
                          name="backupLocation"
                          value={settings.backupLocation}
                          onChange={handleChange}
                        >
                          <option value="local">Local Download</option>
                          <option value="firebase">Firebase Storage</option>
                        </Form.Select>
                      </Form.Group>

                      <div className="d-grid gap-2">
                        <Button 
                          variant="success" 
                          onClick={handleBackupNow}
                          disabled={loading}
                        >
                          <FaDownload className="me-2" />
                          {loading ? 'Processing...' : 'Backup Sekarang'}
                        </Button>
                        {backupProgress > 0 && (
                          <div>
                            <div className="progress">
                              <div 
                                className="progress-bar progress-bar-striped progress-bar-animated" 
                                style={{ width: `${backupProgress}%` }}
                              >
                                {backupProgress}%
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>

                <Col md={6}>
                  <Card className="shadow-sm h-100">
                    <Card.Header className="bg-dark text-white">
                      <h5 className="mb-0">Import/Export Pengaturan</h5>
                    </Card.Header>
                    <Card.Body>
                      <div className="d-grid gap-2 mb-3">
                        <Button 
                          variant="outline-primary" 
                          onClick={handleExportSettings}
                        >
                          <FaDownload className="me-2" />
                          Export Pengaturan (JSON)
                        </Button>
                        
                        <Button 
                          variant="outline-success" 
                          onClick={handleImportSettings}
                        >
                          <FaUpload className="me-2" />
                          Import Pengaturan (JSON)
                        </Button>
                      </div>

                      <Alert variant="info" className="mb-0">
                        <small>
                          <FaInfoCircle className="me-2" />
                          <strong>Gunakan untuk:</strong>
                          <ul className="mb-0 mt-2">
                            <li>Backup pengaturan</li>
                            <li>Transfer antar environment</li>
                          </ul>
                        </small>
                      </Alert>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </Tab>

            <Tab eventKey="announcements" title={<span><FaBell className="me-2" />Pengumuman</span>}>
              <Card className="shadow-sm">
                <Card.Header className="bg-primary text-white">
                  <h5 className="mb-0">
                    <FaBell className="me-2" />
                    Kelola Pengumuman
                  </h5>
                </Card.Header>
                <Card.Body>
                  <Alert variant="info" className="mb-4">
                    <FaInfoCircle className="me-2" />
                    <strong>Cara Menggunakan:</strong>
                    <ul className="mb-0 mt-2">
                      <li>Buat pengumuman untuk semua user atau role tertentu</li>
                      <li>Pilih prioritas: Tinggi, Sedang, Rendah</li>
                      <li>Pengumuman muncul langsung di notification bell</li>
                    </ul>
                  </Alert>

                  <NotificationManager />
                </Card.Body>
              </Card>
            </Tab>

            <Tab eventKey="info" title={<span><FaInfoCircle className="me-2" />Info Sistem</span>}>
              <Card className="shadow-sm">
                <Card.Header className="bg-light">
                  <h5 className="mb-0">Informasi Sistem</h5>
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={4}>
                      <p className="mb-2"><strong>Versi Aplikasi:</strong> {settings.appVersion}</p>
                      <p className="mb-2"><strong>Database:</strong> Firebase Firestore</p>
                      <p className="mb-2"><strong>Authentication:</strong> Firebase Auth</p>
                      <p className="mb-0"><strong>Storage:</strong> Firebase Storage</p>
                    </Col>
                    <Col md={4}>
                      <p className="mb-2"><strong>Last Updated:</strong> {new Date().toLocaleDateString('id-ID')}</p>
                      <p className="mb-2"><strong>Environment:</strong> Production</p>
                      <p className="mb-2"><strong>Region:</strong> Asia Southeast</p>
                      <p className="mb-0"><strong>Timezone:</strong> GMT+7</p>
                    </Col>
                    <Col md={4}>
                      <p className="mb-2"><strong>Framework:</strong> React 18 + Vite</p>
                      <p className="mb-2"><strong>UI Library:</strong> Bootstrap 5</p>
                      <p className="mb-2"><strong>Charts:</strong> Chart.js</p>
                      <p className="mb-0"><strong>Icons:</strong> React Icons</p>
                    </Col>
                  </Row>
                  <hr />
                  <Row>
                    <Col md={12}>
                      <p className="mb-0 small text-muted">
                        <FaInfoCircle className="me-2" />
                        © 2026 PT Jasa Marga (Persero) Tbk - AP Monitoring System v{settings.appVersion}
                      </p>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </Tab>
          </Tabs>
        </Container>
      </div>

      <Modal show={showScheduleModal} onHide={handleCloseScheduleModal} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <FaCalendarAlt className="me-2" />
            {editingSchedule ? 'Edit Schedule' : 'Tambah Schedule'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSaveSchedule}>
          <Modal.Body>
            <Alert variant="warning">
              <FaInfoCircle className="me-2" />
              Schedule ini mengontrol akses input data untuk AP yang dipilih.
            </Alert>

            <Form.Group className="mb-3">
              <Form.Label>Pilih AP <span className="text-danger">*</span></Form.Label>
              <Form.Select
                value={scheduleForm.apId}
                onChange={(e) => {
                  const selectedAP = masterAPList.find(ap => ap.id === e.target.value);
                  setScheduleForm(prev => ({
                    ...prev,
                    apId: e.target.value,
                    namaAP: selectedAP?.namaAP || ''
                  }));
                }}
                required
                disabled={!!editingSchedule}
              >
                <option value="">-- Pilih AP --</option>
                {masterAPList.map(ap => (
                  <option key={ap.id} value={ap.id}>
                    {ap.namaAP}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Tanggal Buka <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="date"
                    value={scheduleForm.tanggalBuka}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, tanggalBuka: e.target.value }))}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Tanggal Tutup <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="date"
                    value={scheduleForm.tanggalTutup}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, tanggalTutup: e.target.value }))}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Check
                type="switch"
                label="Schedule Aktif"
                checked={scheduleForm.isActive}
                onChange={(e) => setScheduleForm(prev => ({ ...prev, isActive: e.target.checked }))}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Keterangan</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={scheduleForm.keterangan}
                onChange={(e) => setScheduleForm(prev => ({ ...prev, keterangan: e.target.value }))}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseScheduleModal}>
              Batal
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              <FaSave className="me-2" />
              {loading ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showBulkActivateModal} onHide={() => setShowBulkActivateModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <FaCheckCircle className="me-2 text-success" />
            Aktifkan Schedule Semua AP
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="success">
            <FaInfoCircle className="me-2" />
            <strong>Perhatian:</strong> Semua AP ({masterAPList.length} AP) akan diaktifkan dengan periode yang sama.
          </Alert>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Tanggal Buka <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="date"
                  value={bulkForm.tanggalBuka}
                  onChange={(e) => setBulkForm(prev => ({ ...prev, tanggalBuka: e.target.value }))}
                  required
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Tanggal Tutup <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="date"
                  value={bulkForm.tanggalTutup}
                  onChange={(e) => setBulkForm(prev => ({ ...prev, tanggalTutup: e.target.value }))}
                  required
                />
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-3">
            <Form.Label>Keterangan</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={bulkForm.keterangan}
              onChange={(e) => setBulkForm(prev => ({ ...prev, keterangan: e.target.value }))}
              placeholder="Contoh: Periode input data Q1 2026"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBulkActivateModal(false)}>
            Batal
          </Button>
          <Button variant="success" onClick={handleBulkActivateConfirm} disabled={loading}>
            <FaCheckCircle className="me-2" />
            {loading ? 'Processing...' : `Aktifkan ${masterAPList.length} AP`}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showBulkDeactivateModal} onHide={() => setShowBulkDeactivateModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaTimes className="me-2 text-danger" />
            Nonaktifkan Schedule Semua AP
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="danger">
            <FaInfoCircle className="me-2" />
            <strong>⚠️ Peringatan:</strong> Semua PIC tidak akan bisa input data setelah schedule dinonaktifkan!
          </Alert>

          <p className="mb-0">
            Apakah Anda yakin ingin menonaktifkan schedule untuk <strong>{Object.keys(schedules).length} AP</strong>?
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBulkDeactivateModal(false)}>
            Batal
          </Button>
          <Button variant="danger" onClick={handleBulkDeactivateConfirm} disabled={loading}>
            <FaTimes className="me-2" />
            {loading ? 'Processing...' : 'Ya, Nonaktifkan Semua'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showImportModal} onHide={() => setShowImportModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Import Pengaturan</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Control
            type="file"
            accept=".json"
            onChange={handleFileChange}
          />
          {importFile && (
            <Alert variant="success" className="mt-3 mb-0">
              <FaCheckCircle className="me-2" />
              {importFile.name}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowImportModal(false)}>
            Batal
          </Button>
          <Button variant="primary" onClick={handleImportSubmit} disabled={!importFile || loading}>
            Import
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default AdminSettings;
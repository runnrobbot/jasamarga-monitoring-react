import { useState, useEffect } from 'react';
import { Container, Card, Table, Button, Modal, Form, Badge, Alert, Spinner } from 'react-bootstrap';
import { FaBuilding, FaPlus, FaEdit, FaTrash, FaSave, FaTimes, FaSync, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { toast } from 'react-toastify';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';

const DEFAULT_AP_LIST = [
  { namaAP: 'PT Cinere Serpong Jaya', singkatanAP: 'CSJ', isDefault: true },
  { namaAP: 'PT Jasamarga Akses Patimban', singkatanAP: 'JAP', isDefault: true },
  { namaAP: 'PT Jasamarga Balikpapan Samarinda', singkatanAP: 'JBS', isDefault: true },
  { namaAP: 'PT Jasamarga Bali Tol', singkatanAP: 'JBT', isDefault: true },
  { namaAP: 'PT Jasamarga Gempol Pasuruan', singkatanAP: 'JGP', isDefault: true },
  { namaAP: 'PT Jasamarga Jogja Bawen', singkatanAP: 'JJB', isDefault: true },
  { namaAP: 'PT Jasamarga Jalanlayang Cikampek', singkatanAP: 'JJC', isDefault: true },
  { namaAP: 'PT Jasamarga Japek Selatan', singkatanAP: 'JJS', isDefault: true },
  { namaAP: 'PT Jasamarga Kunciran Cengkareng', singkatanAP: 'JKC', isDefault: true },
  { namaAP: 'PT Jasamarga Manado Bitung', singkatanAP: 'JMB', isDefault: true },
  { namaAP: 'PT Jasamarga Jogja Solo', singkatanAP: 'JMJ', isDefault: true },
  { namaAP: 'PT Jasamarga Kualanamu Tol', singkatanAP: 'JMKT', isDefault: true },
  { namaAP: 'PT Jasamarga Related Business', singkatanAP: 'JMRB', isDefault: true },
  { namaAP: 'PT Jasamarga Tollroad Maintenance', singkatanAP: 'JMTM', isDefault: true },
  { namaAP: 'PT Jasamarga Tollroad Operator', singkatanAP: 'JMTO', isDefault: true },
  { namaAP: 'PT Jasamarga Ngawi Kertosono Kediri', singkatanAP: 'JNK', isDefault: true },
  { namaAP: 'PT Jasamarga Probolinggo Banyuwangi', singkatanAP: 'JPB', isDefault: true },
  { namaAP: 'PT Jasamarga Pandaan Malang', singkatanAP: 'JPM', isDefault: true },
  { namaAP: 'PT Jasamarga Pandaan Tol', singkatanAP: 'JPT', isDefault: true },
  { namaAP: 'PT Jasamarga Semarang Batang', singkatanAP: 'JSB', isDefault: true },
  { namaAP: 'PT Jasamarga Surabaya Mojokerto', singkatanAP: 'JSM', isDefault: true },
  { namaAP: 'PT Jasamarga Solo Ngawi', singkatanAP: 'JSN', isDefault: true },
  { namaAP: 'PT Jasamarga Transjawa Tol', singkatanAP: 'JTT', isDefault: true },
  { namaAP: 'PT Marga Lingkar Jakarta', singkatanAP: 'MLJ', isDefault: true },
  { namaAP: 'PT Marga Sarana Jabar', singkatanAP: 'MSJ', isDefault: true },
  { namaAP: 'PT Marga Trans Nusantara', singkatanAP: 'MTN', isDefault: true },
  { namaAP: 'PT Trans Marga Jateng', singkatanAP: 'YMJ', isDefault: true }
];


const MasterAP = () => {
  const [apList, setApList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentAP, setCurrentAP] = useState(null);
  const [showInitModal, setShowInitModal] = useState(false);
  
  // Form states
  const [namaAP, setNamaAP] = useState('');
  const [singkatanAP, setSingkatanAP] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchAPList();
  }, []);

  // Fetch all AP
  const fetchAPList = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, 'masterAP'));
      const aps = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort: default first, then custom, alphabetically
      aps.sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return a.namaAP.localeCompare(b.namaAP);
      });
      
      setApList(aps);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching AP list:', error);
      toast.error('Gagal memuat data AP');
      setLoading(false);
    }
  };

  // Initialize 28 default AP
  const handleInitializeDefaults = async () => {
    try {
      setLoading(true);
      setShowInitModal(false);

      // Check if already exists
      const existing = await getDocs(collection(db, 'masterAP'));
      if (existing.size > 0) {
        const confirm = window.confirm(
          `Sudah ada ${existing.size} AP di database. Tetap inisialisasi 28 AP default? Data yang sama akan di-skip.`
        );
        if (!confirm) {
          setLoading(false);
          return;
        }
      }

      let added = 0;
      let skipped = 0;

      for (const ap of DEFAULT_AP_LIST) {
        // Check if exists
        const q = query(
          collection(db, 'masterAP'),
          where('namaAP', '==', ap.namaAP)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          await addDoc(collection(db, 'masterAP'), {
            namaAP: ap.namaAP,
            singkatanAP: ap.singkatanAP,
            isDefault: true,
            isActive: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          added++;
        } else {
          skipped++;
        }
      }

      toast.success(
        `Inisialisasi selesai! ${added} AP ditambahkan, ${skipped} sudah ada.`
      );
      
      fetchAPList();
    } catch (error) {
      console.error('Error initializing defaults:', error);
      toast.error('Gagal inisialisasi AP default');
      setLoading(false);
    }
  };

  // Open modal for create
  const handleCreate = () => {
    setEditMode(false);
    setCurrentAP(null);
    setNamaAP('');
    setSingkatanAP('');
    setIsActive(true);
    setShowModal(true);
  };

  // Open modal for edit
  const handleEdit = (ap) => {
    setEditMode(true);
    setCurrentAP(ap);
    setNamaAP(ap.namaAP);
    setSingkatanAP(ap.singkatanAP);
    setIsActive(ap.isActive !== false);
    setShowModal(true);
  };

  // Save (create or update)
  const handleSave = async () => {
    try {
      // Validation
      if (!namaAP.trim()) {
        toast.error('Nama AP harus diisi!');
        return;
      }
      if (!singkatanAP.trim()) {
        toast.error('Singkatan AP harus diisi!');
        return;
      }
      if (singkatanAP.length > 10) {
        toast.error('Singkatan AP maksimal 10 karakter!');
        return;
      }

      setLoading(true);

      if (editMode) {
        // Update
        await updateDoc(doc(db, 'masterAP', currentAP.id), {
          namaAP: namaAP.trim(),
          singkatanAP: singkatanAP.trim().toUpperCase(),
          isActive,
          updatedAt: serverTimestamp()
        });
        toast.success('AP berhasil diupdate!');
      } else {
        // Create - check duplicate
        const q = query(
          collection(db, 'masterAP'),
          where('namaAP', '==', namaAP.trim())
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          toast.error('Nama AP sudah ada!');
          setLoading(false);
          return;
        }

        await addDoc(collection(db, 'masterAP'), {
          namaAP: namaAP.trim(),
          singkatanAP: singkatanAP.trim().toUpperCase(),
          isDefault: false,
          isActive,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast.success('AP berhasil ditambahkan!');
      }

      setShowModal(false);
      fetchAPList();
    } catch (error) {
      console.error('Error saving AP:', error);
      toast.error('Gagal menyimpan AP');
      setLoading(false);
    }
  };

  // Delete
  const handleDelete = async (ap) => {
    // Cannot delete default AP
    if (ap.isDefault) {
      toast.error('AP default tidak bisa dihapus!');
      return;
    }

    if (!window.confirm(`Hapus AP "${ap.namaAP}"? Data ini tidak bisa dikembalikan!`)) {
      return;
    }

    try {
      setLoading(true);
      await deleteDoc(doc(db, 'masterAP', ap.id));
      toast.success('AP berhasil dihapus!');
      fetchAPList();
    } catch (error) {
      console.error('Error deleting AP:', error);
      toast.error('Gagal menghapus AP');
      setLoading(false);
    }
  };

  // Toggle active status
  const handleToggleActive = async (ap) => {
    try {
      await updateDoc(doc(db, 'masterAP', ap.id), {
        isActive: !ap.isActive,
        updatedAt: serverTimestamp()
      });
      toast.success(`AP ${!ap.isActive ? 'diaktifkan' : 'dinonaktifkan'}`);
      fetchAPList();
    } catch (error) {
      console.error('Error toggling active:', error);
      toast.error('Gagal mengubah status');
    }
  };

  return (
    <>
      <Navbar />
      <div className="d-flex">
        <Sidebar />
        <main className="main-content">
          <Container fluid className="py-4">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h2 className="fw-bold mb-1">
                  <FaBuilding className="me-2" />
                  Master Area Pengelola (AP)
                </h2>
                <p className="text-muted mb-0">
                  Kelola daftar Area Pengelola untuk assignment PIC
                </p>
              </div>
              <div className="d-flex gap-2">
                <Button 
                  variant="outline-primary" 
                  onClick={() => setShowInitModal(true)}
                  disabled={loading}
                >
                  <FaSync className="me-2" />
                  Inisialisasi 28 AP
                </Button>
                <Button 
                  variant="primary" 
                  onClick={handleCreate}
                  disabled={loading}
                >
                  <FaPlus className="me-2" />
                  Tambah AP Custom
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="row mb-4">
              <div className="col-md-3">
                <Card className="border-0 shadow-sm">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <small className="text-muted">Total AP</small>
                        <h3 className="mb-0">{apList.length}</h3>
                      </div>
                      <FaBuilding size={32} className="text-primary opacity-25" />
                    </div>
                  </Card.Body>
                </Card>
              </div>
              <div className="col-md-3">
                <Card className="border-0 shadow-sm">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <small className="text-muted">AP Default</small>
                        <h3 className="mb-0">
                          {apList.filter(ap => ap.isDefault).length}
                        </h3>
                      </div>
                      <FaCheckCircle size={32} className="text-success opacity-25" />
                    </div>
                  </Card.Body>
                </Card>
              </div>
              <div className="col-md-3">
                <Card className="border-0 shadow-sm">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <small className="text-muted">AP Custom</small>
                        <h3 className="mb-0">
                          {apList.filter(ap => !ap.isDefault).length}
                        </h3>
                      </div>
                      <FaPlus size={32} className="text-info opacity-25" />
                    </div>
                  </Card.Body>
                </Card>
              </div>
              <div className="col-md-3">
                <Card className="border-0 shadow-sm">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <small className="text-muted">AP Aktif</small>
                        <h3 className="mb-0">
                          {apList.filter(ap => ap.isActive !== false).length}
                        </h3>
                      </div>
                      <FaCheckCircle size={32} className="text-success opacity-25" />
                    </div>
                  </Card.Body>
                </Card>
              </div>
            </div>

            {/* Table */}
            <Card className="shadow-sm">
              <Card.Header className="bg-white py-3">
                <h5 className="mb-0 fw-bold">Daftar Area Pengelola</h5>
              </Card.Header>
              <Card.Body>
                {loading ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-2 text-muted">Memuat data...</p>
                  </div>
                ) : apList.length === 0 ? (
                  <Alert variant="warning" className="text-center mb-0">
                    <p className="mb-3">Belum ada data AP.</p>
                    <Button 
                      variant="primary" 
                      onClick={() => setShowInitModal(true)}
                    >
                      <FaSync className="me-2" />
                      Inisialisasi 28 AP Default
                    </Button>
                  </Alert>
                ) : (
                  <div className="table-responsive">
                    <Table hover>
                      <thead className="table-light">
                        <tr>
                          <th style={{ width: '50px' }}>No</th>
                          <th>Nama AP</th>
                          <th style={{ width: '120px' }}>Singkatan</th>
                          <th style={{ width: '100px' }}>Type</th>
                          <th style={{ width: '100px' }}>Status</th>
                          <th style={{ width: '150px' }} className="text-center">
                            Aksi
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {apList.map((ap, index) => (
                          <tr key={ap.id}>
                            <td>{index + 1}</td>
                            <td className="fw-medium">{ap.namaAP}</td>
                            <td>
                              <Badge bg="secondary" className="font-monospace">
                                {ap.singkatanAP}
                              </Badge>
                            </td>
                            <td>
                              {ap.isDefault ? (
                                <Badge bg="success">Default</Badge>
                              ) : (
                                <Badge bg="info">Custom</Badge>
                              )}
                            </td>
                            <td>
                              <Badge 
                                bg={ap.isActive !== false ? 'success' : 'secondary'}
                                style={{ cursor: 'pointer' }}
                                onClick={() => handleToggleActive(ap)}
                                title="Klik untuk toggle"
                              >
                                {ap.isActive !== false ? 'Aktif' : 'Nonaktif'}
                              </Badge>
                            </td>
                            <td className="text-center">
                              <div className="d-flex gap-2 justify-content-center">
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() => handleEdit(ap)}
                                  title="Edit"
                                >
                                  <FaEdit />
                                </Button>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  onClick={() => handleDelete(ap)}
                                  disabled={ap.isDefault}
                                  title={
                                    ap.isDefault 
                                      ? 'AP default tidak bisa dihapus' 
                                      : 'Hapus'
                                  }
                                >
                                  <FaTrash />
                                </Button>
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
        </main>
      </div>

      {/* Create/Edit Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {editMode ? 'Edit AP' : 'Tambah AP Custom'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>
                Nama AP <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="text"
                placeholder="Contoh: Jakarta-Cikampek"
                value={namaAP}
                onChange={(e) => setNamaAP(e.target.value)}
                disabled={editMode && currentAP?.isDefault}
              />
              {editMode && currentAP?.isDefault && (
                <Form.Text className="text-muted">
                  Nama AP default tidak bisa diubah
                </Form.Text>
              )}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                Singkatan AP <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="text"
                placeholder="Contoh: JKC"
                value={singkatanAP}
                onChange={(e) => setSingkatanAP(e.target.value.toUpperCase())}
                maxLength={10}
              />
              <Form.Text className="text-muted">
                Maksimal 10 karakter, akan otomatis uppercase
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Check
                type="switch"
                id="isActive"
                label="Status Aktif"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <Form.Text className="text-muted">
                AP nonaktif tidak akan muncul di dropdown selection
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            <FaTimes className="me-2" />
            Batal
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={loading}>
            <FaSave className="me-2" />
            {loading ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Initialize Confirmation Modal */}
      <Modal 
        show={showInitModal} 
        onHide={() => setShowInitModal(false)} 
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Inisialisasi 28 AP Default</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning">
            <FaExclamationTriangle className="me-2" />
            <strong>Perhatian!</strong>
          </Alert>
          <p>
            Anda akan menginisialisasi <strong>28 Area Pengelola default</strong> 
            ke database. AP yang sudah ada akan di-skip.
          </p>
          <p className="mb-0 text-muted small">
            Daftar AP: Jakarta-Cikampek, Cikampek-Palimanan, Palimanan-Kanci, 
            Kanci-Pejagan, dan 24 AP lainnya.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowInitModal(false)}>
            Batal
          </Button>
          <Button variant="primary" onClick={handleInitializeDefaults}>
            <FaSync className="me-2" />
            Ya, Inisialisasi
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default MasterAP;
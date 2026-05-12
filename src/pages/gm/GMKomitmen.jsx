/**
 * GMKomitmen.jsx
 *
 * Halaman review komitmen untuk General Manager.
 * GM dapat melihat semua komitmen dari AP-nya dan mereview
 * komitmen dengan status 'pending_gm':
 *   • Setujui → approvalStatus: 'pending_admin' (diteruskan ke Admin)
 *   • Tolak   → approvalStatus: 'rejected_gm'   (dikembalikan ke PIC)
 */

import { useState, useEffect } from 'react';
import {
  Container, Card, Button, Table, Modal, Form, Badge, Spinner,
  InputGroup, Alert, Row, Col,
} from 'react-bootstrap';
import {
  collection, query, orderBy, doc, updateDoc, onSnapshot,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import NavigationBar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import {
  FaEye, FaSearch, FaCheckCircle, FaTimesCircle, FaClock, FaBuilding,
} from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { addNotification } from '../../utils/notificationService';
import KomitmenDetailModal from '../../components/komitmen/KomitmenDetailModal';

const formatCurrency = (value) => {
  if (!value && value !== 0) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
};

// ─────────────────────────────────────────────────────────────────────────────
const GMKomitmen = () => {
  const { user } = useAuth();
  const userAP = user?.namaAP || '';

  // ── Data state ──────────────────────────────────────────────────────────────
  const [komitmenList, setKomitmenList] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Filter state ────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending_gm');

  // ── Detail modal ────────────────────────────────────────────────────────────
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedKomitmen, setSelectedKomitmen] = useState(null);

  // ── Review modal ────────────────────────────────────────────────────────────
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewItem, setReviewItem] = useState(null);
  const [reviewAction, setReviewAction] = useState('approve'); // 'approve' | 'reject'
  const [reviewNote, setReviewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'komitmen'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q,
      (snap) => {
        setKomitmenList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => { console.error(err); toast.error('Gagal memuat data'); setLoading(false); }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    let filtered = [...komitmenList];

    // Always filter by GM's AP
    if (userAP) filtered = filtered.filter(item => item.namaAP === userAP);

    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.namaPaket?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.idPaketMonitoring?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.createdByName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      if (filterStatus === 'selesai') {
        filtered = filtered.filter(item => item.status === 'selesai');
      } else {
        filtered = filtered.filter(item => item.approvalStatus === filterStatus);
      }
    }

    setFilteredList(filtered);
  }, [komitmenList, searchTerm, filterStatus, userAP]);

  // ── Badge helper ────────────────────────────────────────────────────────────
  const renderBadge = (item) => {
    if (item.status === 'selesai') return <Badge bg="dark">Selesai</Badge>;
    switch (item.approvalStatus) {
      case 'pending_gm':    return <Badge bg="warning" className="text-dark">Menunggu Review GM</Badge>;
      case 'pending_admin': return <Badge bg="info" className="text-dark">Menunggu Admin</Badge>;
      case 'approved':      return <Badge bg="success">Approved</Badge>;
      case 'rejected':      return <Badge bg="danger">Rejected Admin</Badge>;
      case 'rejected_gm':   return <Badge bg="danger">Ditolak GM</Badge>;
      case 'revision_requested': return <Badge bg="warning" className="text-dark">Request Revisi</Badge>;
      default:              return <Badge bg="secondary">Pending</Badge>;
    }
  };

  // ── Review handlers ─────────────────────────────────────────────────────────
  const handleOpenReview = (item, action) => {
    setReviewItem(item);
    setReviewAction(action);
    setReviewNote('');
    setShowReviewModal(true);
  };

  // ── Bulk Selection ─────────────────────────────────────
  const toggleSelectAll = () => {
    const pendingIds = filteredList.filter(i => i.approvalStatus === 'pending_gm').map(i => i.id);
    setSelectedIds(prev => prev.length === pendingIds.length && pendingIds.length > 0 ? [] : pendingIds);
  };
  const toggleSelectOne = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Setujui ${selectedIds.length} komitmen sekaligus?`)) return;
    setBulkLoading(true);
    try {
      await Promise.all(selectedIds.map(id => updateDoc(doc(db, 'komitmen', id), {
        approvalStatus: 'pending_admin',
        gmApprovedBy: user?.email || '',
        gmApprovedByName: user?.nama || user?.username || '',
        gmApprovedAt: new Date(),
        gmNote: 'Disetujui (bulk approve GM)',
        updatedAt: new Date(), updatedBy: user?.email || ''
      })));
      toast.success(`${selectedIds.length} komitmen disetujui dan diteruskan ke Admin`);
      setSelectedIds([]);
    } catch { toast.error('Gagal bulk approve'); }
    finally { setBulkLoading(false); }
  };

  const handleBulkReject = async () => {
    if (selectedIds.length === 0) return;
    const note = window.prompt(`Alasan penolakan untuk ${selectedIds.length} komitmen:`);
    if (!note?.trim()) { toast.error('Alasan wajib diisi'); return; }
    setBulkLoading(true);
    try {
      await Promise.all(selectedIds.map(id => updateDoc(doc(db, 'komitmen', id), {
        approvalStatus: 'rejected_gm',
        gmRejectedBy: user?.email || '',
        gmRejectedByName: user?.nama || user?.username || '',
        gmRejectedAt: new Date(),
        gmNote: note.trim(), approvalNote: note.trim(),
        updatedAt: new Date(), updatedBy: user?.email || ''
      })));
      toast.warning(`${selectedIds.length} komitmen ditolak dan dikembalikan ke PIC`);
      setSelectedIds([]);
    } catch { toast.error('Gagal bulk reject'); }
    finally { setBulkLoading(false); }
  };

  const handleSubmitReview = async () => {
    if (!reviewItem) return;
    if (reviewAction === 'reject' && !reviewNote.trim()) {
      toast.error('Alasan penolakan wajib diisi');
      return;
    }
    setSubmitting(true);
    try {
      let updateData;
      if (reviewAction === 'approve') {
        updateData = {
          approvalStatus: 'pending_admin',
          gmApprovedBy: user?.email || '',
          gmApprovedByName: user?.nama || user?.username || '',
          gmApprovedAt: new Date(),
          gmNote: reviewNote.trim() || 'Disetujui oleh General Manager.',
          updatedAt: new Date(),
          updatedBy: user?.email || '',
        };
      } else {
        updateData = {
          approvalStatus: 'rejected_gm',
          gmRejectedBy: user?.email || '',
          gmRejectedByName: user?.nama || user?.username || '',
          gmRejectedAt: new Date(),
          gmNote: reviewNote.trim(),
          approvalNote: reviewNote.trim(),
          updatedAt: new Date(),
          updatedBy: user?.email || '',
        };
      }

      await updateDoc(doc(db, 'komitmen', reviewItem.id), updateData);

      if (reviewAction === 'approve') {
        toast.success(`Komitmen "${reviewItem.namaPaket}" disetujui dan diteruskan ke Admin.`);
        // Notify PIC
        if (reviewItem.idUser) {
          await addNotification(
            reviewItem.idUser, 'success',
            'Komitmen Disetujui GM',
            `Komitmen "${reviewItem.namaPaket}" telah disetujui GM dan diteruskan ke Admin untuk approval final.`,
            { komitmenId: reviewItem.id, action: 'gm_approved' }
          );
        }
      } else {
        toast.warning(`Komitmen "${reviewItem.namaPaket}" ditolak dan dikembalikan ke PIC.`);
        if (reviewItem.idUser) {
          await addNotification(
            reviewItem.idUser, 'warning',
            'Komitmen Ditolak GM',
            `Komitmen "${reviewItem.namaPaket}" ditolak oleh General Manager. Alasan: ${reviewNote.trim()}`,
            { komitmenId: reviewItem.id, action: 'gm_rejected', reason: reviewNote.trim() }
          );
        }
      }

      setShowReviewModal(false);
      setReviewItem(null);
      setReviewNote('');
    } catch (err) {
      toast.error('Gagal memproses review: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Stats ───────────────────────────────────────────────────────────────────
  const myAP = komitmenList.filter(k => k.namaAP === userAP);
  const pendingCount = myAP.filter(k => k.approvalStatus === 'pending_gm').length;
  const approvedCount = myAP.filter(k => k.approvalStatus === 'approved').length;
  const rejectedCount = myAP.filter(k => k.approvalStatus === 'rejected_gm').length;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <NavigationBar />
      <div className="d-flex">
        <Sidebar />
        <Container fluid className="responsive-shift" style={{ paddingTop: '100px', paddingLeft: '1.5rem', paddingRight: '1.5rem', paddingBottom: '1.5rem', minHeight: '100vh' }}>
          <ToastContainer position="top-right" autoClose={3000} />

          {/* ── Header ── */}
          <Card className="shadow-sm mb-4">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h2 className="fw-bold mb-1">
                    <FaBuilding className="me-2 text-warning" />
                    Review Komitmen
                  </h2>
                  <p className="text-muted mb-0">
                    AP: <strong>{userAP}</strong> — Review dan setujui komitmen dari PIC sebelum diteruskan ke Admin
                  </p>
                </div>
              </div>

              {/* ── Stats row ── */}
              <Row className="mt-3 g-2">
                <Col xs={6} md={3}>
                  <div className="p-3 rounded bg-warning bg-opacity-10 text-center">
                    <div className="fw-bold fs-4 text-warning">{pendingCount}</div>
                    <small className="text-muted">Menunggu Review</small>
                  </div>
                </Col>
                <Col xs={6} md={3}>
                  <div className="p-3 rounded bg-success bg-opacity-10 text-center">
                    <div className="fw-bold fs-4 text-success">{approvedCount}</div>
                    <small className="text-muted">Final Approved</small>
                  </div>
                </Col>
                <Col xs={6} md={3}>
                  <div className="p-3 rounded bg-danger bg-opacity-10 text-center">
                    <div className="fw-bold fs-4 text-danger">{rejectedCount}</div>
                    <small className="text-muted">Saya Tolak</small>
                  </div>
                </Col>
                <Col xs={6} md={3}>
                  <div className="p-3 rounded bg-primary bg-opacity-10 text-center">
                    <div className="fw-bold fs-4 text-primary">{myAP.length}</div>
                    <small className="text-muted">Total Semua</small>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* ── Filters ── */}
          <Card className="shadow-sm mb-3">
            <Card.Body>
              <Row className="g-2">
                <Col md={8}>
                  <InputGroup>
                    <InputGroup.Text><FaSearch /></InputGroup.Text>
                    <Form.Control
                      placeholder="Cari nama paket, ID, atau nama pembuat..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </InputGroup>
                </Col>
                <Col md={4}>
                  <Form.Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="all">Semua Status</option>
                    <option value="pending_gm">Menunggu Review GM</option>
                    <option value="pending_admin">Sudah Saya Setujui</option>
                    <option value="approved">Final Approved</option>
                    <option value="rejected_gm">Saya Tolak</option>
                    <option value="rejected">Rejected Admin</option>
                    <option value="selesai">Selesai</option>
                  </Form.Select>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* ── Table ── */}
          <Card className="shadow-sm">
            <Card.Body className="p-0">
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="warning" />
                  <p className="mt-2 text-muted">Memuat data...</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table striped bordered hover className="mb-0">
                    {selectedIds.length > 0 && (
                      <div className="alert alert-primary d-flex align-items-center gap-2 py-2 mb-2">
                        <strong>{selectedIds.length} dipilih</strong>
                        <Button size="sm" variant="success" disabled={bulkLoading} onClick={handleBulkApprove}>
                          {bulkLoading ? <Spinner size="sm" animation="border" /> : '✓ Setujui Semua'}
                        </Button>
                        <Button size="sm" variant="danger" disabled={bulkLoading} onClick={handleBulkReject}>
                          {bulkLoading ? <Spinner size="sm" animation="border" /> : '✗ Tolak Semua'}
                        </Button>
                        <Button size="sm" variant="outline-secondary" onClick={() => setSelectedIds([])}>Batal Pilih</Button>
                      </div>
                    )}
                    <thead className="table-dark">
                      <tr>
                        <th style={{width:'40px'}}>
                          <Form.Check
                            type="checkbox"
                            checked={selectedIds.length > 0 && selectedIds.length === filteredList.filter(i => i.approvalStatus === 'pending_gm').length}
                            onChange={toggleSelectAll}
                            title="Pilih semua pending GM"
                          />
                        </th>
                        <th>#</th>
                        <th>ID Paket</th>
                        <th>Nama Paket</th>
                        <th>Dibuat Oleh</th>
                        <th>Nilai Komitmen</th>
                        <th>Realisasi</th>
                        <th>Status</th>
                        <th>Catatan GM</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredList.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="text-center py-4 text-muted">
                            {filterStatus === 'pending_gm'
                              ? 'Tidak ada komitmen yang perlu di-review'
                              : 'Tidak ada data'}
                          </td>
                        </tr>
                      ) : (
                        filteredList.map((item, index) => (
                          <tr key={item.id} className={selectedIds.includes(item.id) ? 'table-primary' : ''}>
                            <td>
                              {item.approvalStatus === 'pending_gm' && (
                                <Form.Check type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelectOne(item.id)} />
                              )}
                            </td>
                            <td>{index + 1}</td>
                            <td><small className="font-monospace">{item.idPaketMonitoring}</small></td>
                            <td>
                              <div>{item.namaPaket}</div>
                              <small className="text-muted">{item.jenisPaket}</small>
                            </td>
                            <td>
                              <div className="fw-medium">{item.createdByName || '-'}</div>
                              <small className="text-muted">{item.createdBy}</small>
                            </td>
                            <td className="fw-bold text-primary">{formatCurrency(item.nilaiKomitmen)}</td>
                            <td className="fw-bold text-success">{formatCurrency(item.realisasi)}</td>
                            <td>{renderBadge(item)}</td>
                            <td>
                              {item.gmNote && (
                                <small className="text-muted" style={{ maxWidth: 150, display: 'block', whiteSpace: 'pre-wrap' }}>
                                  {item.gmNote}
                                </small>
                              )}
                            </td>
                            <td>
                              <div className="d-flex gap-1">
                                <Button
                                  variant="info" size="sm"
                                  onClick={() => { setSelectedKomitmen(item); setShowDetailModal(true); }}
                                  title="Lihat Detail"
                                >
                                  <FaEye />
                                </Button>
                                {item.approvalStatus === 'pending_gm' && (
                                  <>
                                    <Button
                                      variant="success" size="sm"
                                      onClick={() => handleOpenReview(item, 'approve')}
                                      title="Setujui"
                                    >
                                      <FaCheckCircle />
                                    </Button>
                                    <Button
                                      variant="danger" size="sm"
                                      onClick={() => handleOpenReview(item, 'reject')}
                                      title="Tolak"
                                    >
                                      <FaTimesCircle />
                                    </Button>
                                  </>
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

          {/* ── Detail Modal ── */}
          {showDetailModal && selectedKomitmen && (
            <KomitmenDetailModal
              show={showDetailModal}
              onHide={() => { setShowDetailModal(false); setSelectedKomitmen(null); }}
              selectedKomitmen={selectedKomitmen}
              userRole="gm"
            />
          )}

          {/* ── Review Modal ── */}
          <Modal show={showReviewModal} onHide={() => setShowReviewModal(false)} centered backdrop="static">
            <Modal.Header closeButton className={`border-0 ${reviewAction === 'approve' ? 'bg-success bg-opacity-10' : 'bg-danger bg-opacity-10'}`}>
              <Modal.Title>
                {reviewAction === 'approve' ? (
                  <><FaCheckCircle className="me-2 text-success" />Setujui Komitmen</>
                ) : (
                  <><FaTimesCircle className="me-2 text-danger" />Tolak Komitmen</>
                )}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {reviewItem && (
                <>
                  <Alert variant={reviewAction === 'approve' ? 'success' : 'danger'}>
                    <strong>Komitmen:</strong> {reviewItem.namaPaket}<br />
                    <strong>ID:</strong> {reviewItem.idPaketMonitoring}<br />
                    <strong>Nilai:</strong> {formatCurrency(reviewItem.nilaiKomitmen)}
                  </Alert>

                  {reviewAction === 'approve' ? (
                    <p className="text-muted">
                      Komitmen ini akan diteruskan ke <strong>Admin</strong> untuk approval final.
                      PIC akan mendapat notifikasi.
                    </p>
                  ) : (
                    <p className="text-muted">
                      Komitmen ini akan <strong>dikembalikan ke PIC</strong> untuk diperbaiki.
                      PIC akan mendapat notifikasi beserta alasan penolakan.
                    </p>
                  )}

                  <Form.Group>
                    <Form.Label>
                      Catatan {reviewAction === 'reject' && <span className="text-danger">*</span>}
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={reviewNote}
                      onChange={e => setReviewNote(e.target.value)}
                      placeholder={reviewAction === 'approve'
                        ? 'Catatan persetujuan (opsional)...'
                        : 'Alasan penolakan (wajib diisi)...'}
                    />
                  </Form.Group>
                </>
              )}
            </Modal.Body>
            <Modal.Footer className="border-0">
              <Button variant="secondary" onClick={() => setShowReviewModal(false)} disabled={submitting}>
                Batal
              </Button>
              <Button
                variant={reviewAction === 'approve' ? 'success' : 'danger'}
                onClick={handleSubmitReview}
                disabled={submitting}
              >
                {submitting ? (
                  <><Spinner animation="border" size="sm" className="me-2" />Memproses...</>
                ) : reviewAction === 'approve' ? (
                  <><FaCheckCircle className="me-2" />Setujui & Teruskan ke Admin</>
                ) : (
                  <><FaTimesCircle className="me-2" />Tolak & Kembalikan ke PIC</>
                )}
              </Button>
            </Modal.Footer>
          </Modal>

        </Container>
      </div>
    </>
  );
};

export default GMKomitmen;
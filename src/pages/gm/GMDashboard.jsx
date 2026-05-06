import { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card, Badge, Spinner } from 'react-bootstrap';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import NavigationBar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import StatCard from '../../components/StatCard';
import { FaClipboardList, FaCheckCircle, FaTimesCircle, FaClock, FaBuilding } from 'react-icons/fa';

import totalPaketIcon from '../../../public/icon/total_paket.png';
import komitmenKeseluruhanIcon from '../../../public/icon/komitmen_keseluruhan.png';
import realisasiIcon from '../../../public/icon/realisasi.png';

const formatCurrency = (value) => {
  if (!value && value !== 0) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
};

const GMDashboard = () => {
  const { user } = useAuth();
  const userAP = user?.namaAP || '';

  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userAP) { setLoading(false); return; }
    setLoading(true);
    const q = query(collection(db, 'komitmen'), where('namaAP', '==', userAP));
    const unsub = onSnapshot(q, snap => {
      setRawData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, err => { console.error(err); setLoading(false); });
    return () => unsub();
  }, [userAP]);

  const stats = useMemo(() => {
    const total = rawData.length;
    const pendingGM = rawData.filter(d => d.approvalStatus === 'pending_gm').length;
    const pendingAdmin = rawData.filter(d => d.approvalStatus === 'pending_admin').length;
    const approved = rawData.filter(d => d.approvalStatus === 'approved').length;
    const rejectedGM = rawData.filter(d => d.approvalStatus === 'rejected_gm').length;
    const selesai = rawData.filter(d => d.status === 'selesai').length;
    const totalKomitmen = rawData.reduce((s, d) => s + (d.nilaiKomitmen || 0), 0);
    const totalRealisasi = rawData.reduce((s, d) => s + (d.realisasi || 0), 0);
    return { total, pendingGM, pendingAdmin, approved, rejectedGM, selesai, totalKomitmen, totalRealisasi };
  }, [rawData]);

  const pendingItems = rawData.filter(d => d.approvalStatus === 'pending_gm');

  return (
    <>
      <NavigationBar />
      <div className="d-flex">
        <Sidebar />
        <Container fluid style={{ marginLeft: '250px', paddingTop: '100px', paddingLeft: '1.5rem', paddingRight: '1.5rem', paddingBottom: '1.5rem', minHeight: '100vh' }}>
          
          {/* Header */}
          <Card className="shadow-sm mb-4 border-0" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
            <Card.Body className="text-white py-4">
              <div className="d-flex align-items-center gap-3">
                <FaBuilding size={36} />
                <div>
                  <h3 className="fw-bold mb-1">Dashboard General Manager</h3>
                  <p className="mb-0 opacity-75">
                    {userAP} — {user?.singkatanAP}
                  </p>
                </div>
              </div>
            </Card.Body>
          </Card>

          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="warning" />
              <p className="mt-2 text-muted">Memuat data...</p>
            </div>
          ) : (
            <>
              {/* Stats */}
              <Row className="g-3 mb-4">
                <Col lg={3} md={6}>
                  <Card className="border-0 shadow-sm h-100">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <p className="text-muted small mb-1">Total Komitmen</p>
                          <h3 className="fw-bold mb-0">{stats.total}</h3>
                        </div>
                        <img src={totalPaketIcon} alt="total" style={{ width: 40, height: 40 }} />
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col lg={3} md={6}>
                  <Card className="border-0 shadow-sm h-100 border-start border-warning border-4">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <p className="text-muted small mb-1">Menunggu Review Saya</p>
                          <h3 className="fw-bold mb-0 text-warning">{stats.pendingGM}</h3>
                          <small className="text-muted">Perlu ditindaklanjuti</small>
                        </div>
                        <FaClock size={36} className="text-warning opacity-50" />
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col lg={3} md={6}>
                  <Card className="border-0 shadow-sm h-100 border-start border-success border-4">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <p className="text-muted small mb-1">Approved (Final)</p>
                          <h3 className="fw-bold mb-0 text-success">{stats.approved}</h3>
                        </div>
                        <FaCheckCircle size={36} className="text-success opacity-50" />
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col lg={3} md={6}>
                  <Card className="border-0 shadow-sm h-100 border-start border-danger border-4">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <p className="text-muted small mb-1">Saya Tolak</p>
                          <h3 className="fw-bold mb-0 text-danger">{stats.rejectedGM}</h3>
                        </div>
                        <FaTimesCircle size={36} className="text-danger opacity-50" />
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              <Row className="g-3 mb-4">
                <Col lg={6}>
                  <Card className="border-0 shadow-sm h-100">
                    <Card.Body>
                      <p className="text-muted small mb-1">Total Nilai Komitmen (AP {userAP})</p>
                      <h4 className="fw-bold text-primary">{formatCurrency(stats.totalKomitmen)}</h4>
                    </Card.Body>
                  </Card>
                </Col>
                <Col lg={6}>
                  <Card className="border-0 shadow-sm h-100">
                    <Card.Body>
                      <p className="text-muted small mb-1">Total Realisasi</p>
                      <h4 className="fw-bold text-success">{formatCurrency(stats.totalRealisasi)}</h4>
                      <small className="text-muted">
                        {stats.totalKomitmen > 0
                          ? `${((stats.totalRealisasi / stats.totalKomitmen) * 100).toFixed(1)}% dari total komitmen`
                          : '—'}
                      </small>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Pending review list */}
              {pendingItems.length > 0 && (
                <Card className="border-0 shadow-sm">
                  <Card.Header className="bg-warning bg-opacity-10 border-0">
                    <h6 className="fw-bold mb-0 text-warning">
                      <FaClock className="me-2" />
                      Komitmen Menunggu Review Anda ({pendingItems.length})
                    </h6>
                  </Card.Header>
                  <Card.Body className="p-0">
                    <div className="table-responsive">
                      <table className="table table-hover mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>#</th>
                            <th>ID Paket</th>
                            <th>Nama Paket</th>
                            <th>Dibuat Oleh</th>
                            <th>Nilai Komitmen</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingItems.map((item, i) => (
                            <tr key={item.id}>
                              <td>{i + 1}</td>
                              <td><small className="font-monospace">{item.idPaketMonitoring}</small></td>
                              <td>{item.namaPaket}</td>
                              <td><small>{item.createdByName || item.createdBy || '-'}</small></td>
                              <td>{formatCurrency(item.nilaiKomitmen)}</td>
                              <td><Badge bg="warning" className="text-dark">Menunggu Review GM</Badge></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-3 text-end">
                      <a href="/gm/komitmen" className="btn btn-warning btn-sm">
                        Buka Halaman Review →
                      </a>
                    </div>
                  </Card.Body>
                </Card>
              )}

              {pendingItems.length === 0 && (
                <Card className="border-0 shadow-sm">
                  <Card.Body className="text-center py-5">
                    <FaCheckCircle size={48} className="text-success mb-3 opacity-50" />
                    <h5 className="text-muted">Tidak ada komitmen yang perlu di-review</h5>
                    <p className="text-muted small">Semua komitmen dari AP Anda sudah diproses.</p>
                  </Card.Body>
                </Card>
              )}
            </>
          )}
        </Container>
      </div>
    </>
  );
};

export default GMDashboard;

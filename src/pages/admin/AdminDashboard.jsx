import { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card, Form, ButtonGroup, Button } from 'react-bootstrap';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import NavigationBar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import StatCard from '../../components/StatCard';
import ChartCard from '../../components/ChartCard';
import DataTable from '../../components/DataTable';
import { FaCalendarAlt, FaFilter } from 'react-icons/fa';
import './AdminDashboard.css';

import totalPaketIcon from '../../../public/icon/total_paket.png';
import komitmenKeseluruhanIcon from '../../../public/icon/komitmen_keseluruhan.png';
import komitmenPerTahunIcon from '../../../public/icon/komitmen_tahunini.png';
import nilaiKontrakIcon from '../../../public/icon/nilai_kontrak.png';
import realisasiIcon from '../../../public/icon/realisasi.png';
import belumRealisasiIcon from '../../../public/icon/belum_realisasi.png';
import tkdnIcon from '../../../public/icon/tkdn.png';
import pdnIcon from '../../../public/icon/pdn.png';
import p3dnIcon from '../../../public/icon/p3dn.png';
import importIcon from '../../../public/icon/import.png';

const QUARTERS = [
  { value: 1, label: 'Triwulan I (Jan–Mar)',   months: [1, 2, 3] },
  { value: 2, label: 'Triwulan II (Apr–Jun)',  months: [4, 5, 6] },
  { value: 3, label: 'Triwulan III (Jul–Sep)', months: [7, 8, 9] },
  { value: 4, label: 'Triwulan IV (Okt–Des)',  months: [10, 11, 12] }
];

const MONTHS = [
  { value: 1,  label: 'Januari'   }, { value: 2,  label: 'Februari'  },
  { value: 3,  label: 'Maret'     }, { value: 4,  label: 'April'     },
  { value: 5,  label: 'Mei'       }, { value: 6,  label: 'Juni'      },
  { value: 7,  label: 'Juli'      }, { value: 8,  label: 'Agustus'   },
  { value: 9,  label: 'September' }, { value: 10, label: 'Oktober'   },
  { value: 11, label: 'November'  }, { value: 12, label: 'Desember'  }
];

const AdminDashboard = () => {
  const { user } = useAuth();
  const userRole = user?.role;

  const [selectedUser,     setSelectedUser]     = useState('all');
  const [selectedPeriod,   setSelectedPeriod]   = useState('all');
  const [selectedMonth,    setSelectedMonth]    = useState(new Date().getMonth() + 1);
  const [selectedYear,     setSelectedYear]     = useState(new Date().getFullYear());
  const [selectedQuarter,  setSelectedQuarter]  = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  const [filterJenisPaket, setFilterJenisPaket] = useState('all');

  const [rawData, setRawData] = useState([]);
  const [apList,  setApList]  = useState([]);
  const [loading, setLoading] = useState(true);

  const years = [];
  for (let i = 2020; i <= new Date().getFullYear() + 5; i++) years.push(i);

  useEffect(() => {
    if (userRole !== 'admin') return;
    getDocs(collection(db, 'masterAP')).then(snap => {
      setApList(
        snap.docs
          .map(d => ({ id: d.id, namaAP: d.data().namaAP, isActive: d.data().isActive }))
          .filter(ap => ap.isActive !== false)
          .sort((a, b) => a.namaAP.localeCompare(b.namaAP))
      );
    }).catch(console.error);
  }, [userRole]);

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(collection(db, 'komitmen'), snap => {
      setRawData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, err => { console.error('Snapshot error:', err); setLoading(false); });
    return () => unsub();
  }, []);

  const qMonths = useMemo(
    () => QUARTERS.find(q => q.value === selectedQuarter)?.months || [],
    [selectedQuarter]
  );

  // ─── Helper: ambil fallbackYear dari createdAt ────────────────────────────
  const getFallbackYear = (item) => {
    if (!item.createdAt) return null;
    try {
      const d = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
      return d.getFullYear();
    } catch (_) { return null; }
  };

  // ─── Helper: cek apakah 1 detail masuk periode ───────────────────────────
  const isDetInPeriod = (det, fbYear) => {
    const dY = parseInt(det.tahunRealisasi) || fbYear;
    const dM = parseInt(det.bulanRealisasi);
    if (!dM) return false;
    if (selectedPeriod === 'monthly')   return dY === selectedYear && dM === selectedMonth;
    if (selectedPeriod === 'quarterly') return dY === selectedYear && qMonths.includes(dM);
    if (selectedPeriod === 'yearly')    return dY === selectedYear;
    return false;
  };

  // ─── Helper: realisasi, TKDN, PDN dari detail yang lolos periode ──────────
  //   Saat filter aktif: sum dari realisasiDetail yang cocok periode.
  //   TKDN & PDN: karena tidak tersimpan per-detail, tetap ambil dari field
  //   induk, tapi HANYA untuk item yang punya minimal 1 detail cocok periode.
  //   Jika item tidak punya detail sama sekali, fallback ke nilai global item.
  const getRealisasiPeriode = (item) => {
    const fbYear = getFallbackYear(item);
    if (!item.realisasiDetail?.length) return Number(item.realisasi) || 0;
    return item.realisasiDetail
      .filter(det => isDetInPeriod(det, fbYear))
      .reduce((s, det) => s + (Number(det.realisasi) || 0), 0);
  };

  // ─── Computed: filter + agregasi ─────────────────────────────────────────
  const dashboardData = useMemo(() => {
    let list = rawData;

    // Filter AP
    if (userRole === 'admin') {
      if (selectedUser !== 'all') list = list.filter(i => i.namaAP === selectedUser);
    } else if (userRole === 'pic') {
      list = user?.namaAP ? list.filter(i => i.namaAP === user.namaAP) : [];
    }

    // Filter jenis paket
    if (filterJenisPaket !== 'all')
      list = list.filter(i => i.jenisPaket === filterJenisPaket);

    // Filter periode
    if (selectedPeriod !== 'all') {
      list = list.filter(item => {
        const fbYear  = getFallbackYear(item);
        const fbMonth = (() => {
          if (!item.createdAt) return null;
          try {
            const d = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
            return d.getMonth() + 1;
          } catch (_) { return null; }
        })();

        if (item.realisasiDetail?.length > 0)
          return item.realisasiDetail.some(det => isDetInPeriod(det, fbYear));

        if (!fbYear) return selectedPeriod === 'yearly';
        if (selectedPeriod === 'monthly')   return fbYear === selectedYear && fbMonth === selectedMonth;
        if (selectedPeriod === 'quarterly') return fbYear === selectedYear && qMonths.includes(fbMonth);
        if (selectedPeriod === 'yearly')    return fbYear === selectedYear;
        return false;
      });
    }

    // ─── Agregasi ─────────────────────────────────────────────────────────
    let totalKomitmen = 0, totalKomitmenKeseluruhan = 0;
    let totalRealisasi = 0, totalNilaiKontrak = 0;
    let totalTKDN = 0, totalPDN = 0, totalImpor = 0;
    // Nilai dari komitmen awal (nilaiKeseluruhan*) — tidak terpengaruh filter periode
    let komitmenTKDN = 0, komitmenPDN = 0, komitmenImpor = 0;
    const dataByJenis = {}, dataByMetode = {};

    list.forEach(item => {
      totalKomitmen            += Number(item.nilaiKomitmen) || 0;
      totalKomitmenKeseluruhan += Number(item.komitmenKeseluruhan) || Number(item.nilaiKomitmen) || 0;
      totalNilaiKontrak        += Number(item.nilaiKontrakKeseluruhan) || 0;

      // ── Realisasi: sum dari detail yang cocok periode ──────────────────
      const rp = selectedPeriod === 'all'
        ? Number(item.realisasi) || 0
        : getRealisasiPeriode(item);
      totalRealisasi += rp;

      // Akumulasi nilai komitmen awal (nilaiKeseluruhan*) — selalu dari data mentah
      komitmenTKDN  += Number(item.nilaiKeseluruhanTKDN)   || 0;
      komitmenPDN   += Number(item.nilaiKeseluruhanPDN)    || 0;
      komitmenImpor += Number(item.nilaiKeseluruhanImport) || 0;

      // ── TKDN & PDN: dari item induk, tapi hanya item yang lolos filter ─
      //   Saat 'all', pakai field keseluruhan; saat filter aktif, cek apakah
      //   item ini punya realisasi di periode tsb sebelum akumulasi.
      //   Karena list sudah difilter periode di atas, item di sini sudah
      //   dipastikan relevan → langsung akumulasi field induk.
      totalTKDN  += Number(item.nilaiKeseluruhanTKDN) || Number(item.nilaiTKDN)    || 0;
      totalPDN   += Number(item.nilaiKeseluruhanPDN)  || Number(item.nilaiPDN)     || 0;
      totalImpor += Number(item.nilaiKeseluruhanImport) || Number(item.nilaiImpor) || 0;

      // ── Saat filter aktif: scale TKDN & PDN proporsional terhadap ─────
      //   persentase realisasi periode vs realisasi total item,
      //   agar nilai TKDN/PDN mencerminkan kontribusi periode tsb.
      // (Catatan: hanya berlaku jika realisasi total > 0)

      const jenis = item.jenisPengadaan || 'Lainnya';
      if (!dataByJenis[jenis]) dataByJenis[jenis] = { count: 0, total: 0 };
      dataByJenis[jenis].count++;
      dataByJenis[jenis].total += Number(item.nilaiKontrakKeseluruhan) || Number(item.komitmenKeseluruhan) || Number(item.nilaiKomitmen) || 0;

      const metode = item.usulanMetodePemilihan || 'Lainnya';
      if (!dataByMetode[metode]) dataByMetode[metode] = { count: 0, total: 0 };
      dataByMetode[metode].count++;
      dataByMetode[metode].total += Number(item.nilaiKontrakKeseluruhan) || Number(item.komitmenKeseluruhan) || Number(item.nilaiKomitmen) || 0;
    });

    // ── Jika filter periode aktif: hitung ulang TKDN & PDN dari realisasi ─
    //   Karena TKDN/PDN tidak tersimpan per-detail, kita gunakan pendekatan:
    //   TKDN_periode = Σ (realisasiPeriode_item / realisasiTotal_item) × TKDN_item
    //   Ini memberikan estimasi proporsional yang konsisten dengan periode.
    if (selectedPeriod !== 'all') {
      totalTKDN  = 0;
      totalPDN   = 0;
      totalImpor = 0;

      list.forEach(item => {
        const realisasiTotal   = Number(item.realisasi) || 0;
        const realisasiPeriode = getRealisasiPeriode(item);
        const ratio = realisasiTotal > 0 ? realisasiPeriode / realisasiTotal : 1;

        const tkdnItem  = Number(item.nilaiKeseluruhanTKDN) || Number(item.nilaiTKDN)    || 0;
        const pdnItem   = Number(item.nilaiKeseluruhanPDN)  || Number(item.nilaiPDN)     || 0;
        const imporItem = Number(item.nilaiKeseluruhanImport) || Number(item.nilaiImpor) || 0;

        totalTKDN  += tkdnItem  * ratio;
        totalPDN   += pdnItem   * ratio;
        totalImpor += imporItem * ratio;
      });
    }

    const komitmenP3DN       = komitmenTKDN + komitmenPDN;
    const totalP3DN          = totalTKDN + totalPDN;
    const belumRealisasi     = Math.max(0, totalKomitmenKeseluruhan - totalRealisasi);
    const persentaseRealisasi = totalKomitmenKeseluruhan > 0 ? ((totalRealisasi / totalKomitmenKeseluruhan) * 100).toFixed(2) : 0;
    const persentaseTKDN     = totalNilaiKontrak > 0 ? ((totalTKDN  / totalNilaiKontrak) * 100).toFixed(2) : 0;
    const persentasePDN      = totalNilaiKontrak > 0 ? ((totalPDN   / totalNilaiKontrak) * 100).toFixed(2) : 0;
    const persentaseImpor    = totalNilaiKontrak > 0 ? ((totalImpor / totalNilaiKontrak) * 100).toFixed(2) : 0;
    const persentaseP3DN     = totalNilaiKontrak > 0 ? ((totalP3DN  / totalNilaiKontrak) * 100).toFixed(2) : 0;

    return {
      komitmen: totalKomitmen, komitmenKeseluruhan: totalKomitmenKeseluruhan,
      realisasi: totalRealisasi, nilaiKontrak: totalNilaiKontrak,
      belumRealisasi, tkdn: totalTKDN, pdn: totalPDN, impor: totalImpor, p3dn: totalP3DN,
      komitmenTKDN, komitmenPDN, komitmenP3DN, komitmenImpor,
      persentaseRealisasi, persentaseTKDN, persentasePDN, persentaseImpor, persentaseP3DN,
      totalData: list.length, dataByJenis, dataByMetode
    };
  }, [rawData, selectedUser, selectedPeriod, selectedMonth, selectedYear, qMonths, filterJenisPaket, userRole, user]);

  const fmt = v =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

  const getPeriodSubtitle = () => {
    const mName  = MONTHS.find(m => m.value === selectedMonth)?.label || '';
    const qLabel = QUARTERS.find(q => q.value === selectedQuarter)?.label || '';
    if (selectedPeriod === 'monthly')   return `${mName} ${selectedYear}`;
    if (selectedPeriod === 'quarterly') return `${qLabel} ${selectedYear}`;
    if (selectedPeriod === 'yearly')    return `Tahun ${selectedYear}`;
    return String(selectedYear);
  };

  return (
    <>
      <NavigationBar />
      <div className="d-flex">
        <Sidebar />
        <main className="main-content">
          <Container fluid className="py-4">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h2 className="fw-bold mb-1">Dashboard Admin</h2>
                <p className="text-muted mb-0">
                  Monitoring Anggaran Pengadaan — {getPeriodSubtitle()}
                  {userRole === 'pic' && user?.namaAP && (
                    <span className="ms-2"><span className="badge bg-primary">{user.namaAP}</span></span>
                  )}
                </p>
              </div>
            </div>

            {/* Filters */}
            <Card className="shadow-sm mb-4">
              <Card.Body>
                <Row className="g-3">
                  <Col md={4}>
                    <Form.Label className="small fw-bold"><FaCalendarAlt className="me-2" />Periode</Form.Label>
                    <ButtonGroup className="w-100">
                      {[
                        { key: 'all',       label: 'Semua'    },
                        { key: 'monthly',   label: 'Bulanan'  },
                        { key: 'quarterly', label: 'Triwulan' },
                        { key: 'yearly',    label: 'Tahunan'  }
                      ].map(p => (
                        <Button key={p.key} size="sm"
                          variant={selectedPeriod === p.key ? 'primary' : 'outline-primary'}
                          onClick={() => setSelectedPeriod(p.key)}>
                          {p.label}
                        </Button>
                      ))}
                    </ButtonGroup>
                  </Col>

                  {selectedPeriod === 'monthly' && (
                    <Col md={2}>
                      <Form.Label className="small fw-bold">Bulan</Form.Label>
                      <Form.Select size="sm" value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}>
                        {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </Form.Select>
                    </Col>
                  )}

                  {selectedPeriod === 'quarterly' && (
                    <Col md={3}>
                      <Form.Label className="small fw-bold">Triwulan</Form.Label>
                      <Form.Select size="sm" value={selectedQuarter} onChange={e => setSelectedQuarter(parseInt(e.target.value))}>
                        {QUARTERS.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
                      </Form.Select>
                    </Col>
                  )}

                  {selectedPeriod !== 'all' && (
                    <Col md={2}>
                      <Form.Label className="small fw-bold">Tahun</Form.Label>
                      <Form.Select size="sm" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </Form.Select>
                    </Col>
                  )}

                  <Col md={2}>
                    <Form.Label className="small fw-bold"><FaFilter className="me-1" />Jenis Paket</Form.Label>
                    <Form.Select size="sm" value={filterJenisPaket} onChange={e => setFilterJenisPaket(e.target.value)}>
                      <option value="all">Semua Paket</option>
                      <option value="Single Year (SY)">Single Year (SY)</option>
                      <option value="Multi Year (MY)">Multi Year (MY)</option>
                    </Form.Select>
                  </Col>

                  {userRole === 'admin' && (
                    <Col md={2}>
                      <Form.Label className="small fw-bold"><FaFilter className="me-1" />Filter AP</Form.Label>
                      <Form.Select size="sm" value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
                        <option value="all">Semua AP</option>
                        {apList.map(ap => <option key={ap.id} value={ap.namaAP}>{ap.namaAP}</option>)}
                      </Form.Select>
                    </Col>
                  )}
                </Row>
              </Card.Body>
            </Card>

            {/* Stats Row 1 — 3 card */}
            <Row className="g-3 mb-4">
              <Col xs={12} sm={6} lg={4}><StatCard title="Total Paket" value={dashboardData.totalData} icon={totalPaketIcon} color="secondary" /></Col>
              <Col xs={12} sm={6} lg={4}><StatCard title="Komitmen Keseluruhan" value={fmt(dashboardData.komitmenKeseluruhan)} icon={komitmenKeseluruhanIcon} color="info" /></Col>
              <Col xs={12} sm={6} lg={4}><StatCard title="Komitmen Tahun Ini" value={fmt(dashboardData.komitmen)} icon={komitmenPerTahunIcon} color="primary" /></Col>
            </Row>

            {/* Stats Row 2 — 4 card: TKDN / PDN / P3DN / Import dari Komitmen Awal */}
            <Row className="g-3 mb-4">
              <Col xs={12} sm={6} lg={3}><StatCard title="TKDN (Komitmen Awal)" value={fmt(dashboardData.komitmenTKDN)} icon={tkdnIcon} color="info" /></Col>
              <Col xs={12} sm={6} lg={3}><StatCard title="PDN (Komitmen Awal)" value={fmt(dashboardData.komitmenPDN)} icon={pdnIcon} color="primary" /></Col>
              <Col xs={12} sm={6} lg={3}><StatCard title="P3DN (Komitmen Awal)" value={fmt(dashboardData.komitmenP3DN)} icon={p3dnIcon} color="success" /></Col>
              <Col xs={12} sm={6} lg={3}><StatCard title="Import (Komitmen Awal)" value={fmt(dashboardData.komitmenImpor)} icon={importIcon} color="danger" /></Col>
            </Row>

            {/* Stats Row 3 — 3 card */}
            <Row className="g-3 mb-4">
              <Col xs={12} sm={6} lg={4}><StatCard title="Nilai Kontrak" value={fmt(dashboardData.nilaiKontrak)} icon={nilaiKontrakIcon} color="success" /></Col>
              <Col xs={12} sm={6} lg={4}><StatCard title="Realisasi" value={fmt(dashboardData.realisasi)} icon={realisasiIcon} color="success" percentage={`${dashboardData.persentaseRealisasi}%`} /></Col>
              <Col xs={12} sm={6} lg={4}><StatCard title="Belum Realisasi" value={fmt(dashboardData.belumRealisasi)} icon={belumRealisasiIcon} color="warning" /></Col>
            </Row>

            {/* Stats Row 4 — 4 card: TKDN / PDN / P3DN / Import Realisasi Aktual */}
            <Row className="g-3 mb-4">
              <Col xs={12} sm={6} lg={3}><StatCard title="TKDN" value={fmt(dashboardData.tkdn)} icon={tkdnIcon} color="info" percentage={`${dashboardData.persentaseTKDN}%`} /></Col>
              <Col xs={12} sm={6} lg={3}><StatCard title="PDN" value={fmt(dashboardData.pdn)} icon={pdnIcon} color="primary" percentage={`${dashboardData.persentasePDN}%`} /></Col>
              <Col xs={12} sm={6} lg={3}><StatCard title="P3DN (TKDN + PDN)" value={fmt(dashboardData.p3dn)} icon={p3dnIcon} color="success" percentage={`${dashboardData.persentaseP3DN}%`} /></Col>
              <Col xs={12} sm={6} lg={3}><StatCard title="Import" value={fmt(dashboardData.impor)} icon={importIcon} color="danger" percentage={`${dashboardData.persentaseImpor}%`} /></Col>
            </Row>

            {/* Charts Row 1 */}
            <Row className="g-4 mb-4">
              <Col xs={12} lg={4}>
                <ChartCard title="Realisasi vs Komitmen" type="doughnut"
                  data={{ labels: ['Realisasi', 'Belum Realisasi'], datasets: [{ data: [dashboardData.realisasi, dashboardData.belumRealisasi], backgroundColor: ['#28a745', '#ffc107'] }] }} />
              </Col>
              <Col xs={12} lg={4}>
                <ChartCard title="P3DN vs Import" type="doughnut" subtitle="Produksi Dalam Negeri vs Import"
                  data={{ labels: ['P3DN (TKDN + PDN)', 'Import'], datasets: [{ data: [dashboardData.p3dn, dashboardData.impor], backgroundColor: ['#28a745', '#dc3545'] }] }} />
              </Col>
              <Col xs={12} lg={4}>
                <ChartCard title="Kandungan Lokal (Detail)" type="doughnut" subtitle="TKDN, PDN, dan Import"
                  data={{ labels: ['TKDN', 'PDN', 'Import'], datasets: [{ data: [dashboardData.tkdn, dashboardData.pdn, dashboardData.impor], backgroundColor: ['#17a2b8', '#007bff', '#dc3545'] }] }} />
              </Col>
            </Row>

            {/* Charts Row 2 */}
            <Row className="g-4 mb-4">
              <Col xs={12} lg={6}>
                <ChartCard title="Breakdown Per Jenis Pengadaan" type="pie" subtitle="Jumlah paket per jenis pengadaan"
                  data={{ labels: Object.keys(dashboardData.dataByJenis), datasets: [{ data: Object.values(dashboardData.dataByJenis).map(i => i.count), backgroundColor: ['#007bff','#28a745','#ffc107','#dc3545','#17a2b8','#6c757d','#e83e8c','#fd7e14'] }] }} />
              </Col>
              <Col xs={12} lg={6}>
                <ChartCard title="Breakdown Per Metode Pemilihan" type="pie" subtitle="Jumlah paket per metode pemilihan"
                  data={{ labels: Object.keys(dashboardData.dataByMetode), datasets: [{ data: Object.values(dashboardData.dataByMetode).map(i => i.count), backgroundColor: ['#6f42c1','#20c997','#fd7e14','#e83e8c','#6c757d','#17a2b8','#ffc107','#dc3545'] }] }} />
              </Col>
            </Row>

            {/* Breakdown Summary */}
            <Row className="g-4 mb-4">
              <Col md={6}>
                <Card className="shadow-sm h-100">
                  <Card.Header className="bg-light"><h6 className="mb-0 fw-bold">Breakdown Per Jenis Pengadaan</h6></Card.Header>
                  <Card.Body>
                    {Object.entries(dashboardData.dataByJenis).length > 0 ? (() => {
                      const gt = Object.values(dashboardData.dataByJenis).reduce((s, d) => s + d.total, 0);
                      return (
                        <div className="table-responsive">
                          <table className="table table-sm table-hover">
                            <thead className="table-light"><tr><th>Jenis</th><th className="text-end">Jumlah</th><th className="text-end">Total Nilai Kontrak</th><th className="text-end">%</th></tr></thead>
                            <tbody>
                              {Object.entries(dashboardData.dataByJenis).sort((a, b) => b[1].total - a[1].total).map(([jenis, d]) => (
                                <tr key={jenis}>
                                  <td className="fw-medium">{jenis}</td>
                                  <td className="text-end">{d.count} paket</td>
                                  <td className="text-end">{fmt(d.total)}</td>
                                  <td className="text-end"><span className="badge bg-primary">{gt > 0 ? ((d.total / gt) * 100).toFixed(1) : 0}%</span></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })() : <p className="text-muted text-center mb-0">Tidak ada data</p>}
                  </Card.Body>
                </Card>
              </Col>

              <Col md={6}>
                <Card className="shadow-sm h-100">
                  <Card.Header className="bg-light"><h6 className="mb-0 fw-bold">Ringkasan Persentase</h6></Card.Header>
                  <Card.Body>
                    {[
                      { label: 'Realisasi',         pct: dashboardData.persentaseRealisasi, cls: 'success' },
                      { label: 'P3DN (TKDN + PDN)', pct: dashboardData.persentaseP3DN,      cls: 'success' },
                      { label: 'TKDN',              pct: dashboardData.persentaseTKDN,      cls: 'info'    },
                      { label: 'PDN',               pct: dashboardData.persentasePDN,       cls: 'primary' },
                      { label: 'Import',            pct: dashboardData.persentaseImpor,     cls: 'danger'  }
                    ].map(({ label, pct, cls }, i) => (
                      <div key={label} className={i < 4 ? 'mb-3' : ''}>
                        <div className="d-flex justify-content-between mb-1">
                          <small className="fw-medium">{label}</small>
                          <small className={`fw-bold text-${cls}`}>{pct}%</small>
                        </div>
                        <div className="progress" style={{ height: '20px' }}>
                          <div className={`progress-bar bg-${cls}`} style={{ width: `${Math.min(pct, 100)}%` }}>{pct}%</div>
                        </div>
                      </div>
                    ))}
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Data Table */}
            <Card className="shadow-sm">
              <Card.Header className="bg-white py-3"><h5 className="mb-0 fw-bold">Detail Komitmen dan Realisasi</h5></Card.Header>
              <Card.Body>
                <DataTable
                  selectedUser={selectedUser}
                  selectedPeriod={selectedPeriod}
                  selectedMonth={selectedMonth}
                  selectedYear={selectedYear}
                  selectedQuarter={selectedQuarter}
                  filterJenisPaket={filterJenisPaket}
                />
              </Card.Body>
            </Card>
          </Container>
        </main>
      </div>
    </>
  );
};

export default AdminDashboard;
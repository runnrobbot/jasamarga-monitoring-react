import { useState, useEffect, useMemo } from 'react';
import { Table, Spinner, Badge } from 'react-bootstrap';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';

const QUARTERS = [
  { value: 1, months: [1, 2, 3] },
  { value: 2, months: [4, 5, 6] },
  { value: 3, months: [7, 8, 9] },
  { value: 4, months: [10, 11, 12] }
];

const DataTable = ({
  selectedUser,
  selectedPeriod = 'all',
  selectedMonth,
  selectedYear,
  selectedQuarter = 1,
  filterJenisPaket = 'all'
}) => {
  const { user } = useAuth();
  const userRole = user?.role;

  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);

  // ─── Effect 1: Firestore snapshot (tidak berubah saat filter ganti) ────────
  useEffect(() => {
    if (userRole === 'pic' && !user?.namaAP) {
      setRawData([]);
      setLoading(false);
      return;
    }

    const komitmenQuery = userRole === 'pic'
      ? query(collection(db, 'komitmen'), where('namaAP', '==', user.namaAP), orderBy('createdAt', 'desc'))
      : query(collection(db, 'komitmen'), orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(komitmenQuery, (snap) => {
      setRawData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error('DataTable snapshot error:', err);
      setRawData([]);
      setLoading(false);
    });

    return () => unsub();
  }, [userRole, user?.namaAP]);

  // ─── Helper: bulan-bulan triwulan ─────────────────────────────────────────
  const qMonths = useMemo(
    () => QUARTERS.find(q => q.value === selectedQuarter)?.months || [],
    [selectedQuarter]
  );

  // ─── Helper: apakah item masuk periode terpilih ───────────────────────────
  const isItemInPeriod = (item) => {
    if (selectedPeriod === 'all') return true;

    let fallbackYear = null, fallbackMonth = null;
    if (item.createdAt) {
      try {
        const d = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
        fallbackYear = d.getFullYear();
        fallbackMonth = d.getMonth() + 1;
      } catch (_) {}
    }

    // Punya realisasiDetail → pakai detail, JANGAN fallback ke createdAt
    if (item.realisasiDetail?.length > 0) {
      return item.realisasiDetail.some(det => {
        const dYear = parseInt(det.tahunRealisasi) || fallbackYear;
        const dMonth = parseInt(det.bulanRealisasi);
        if (!dMonth) return false;
        if (selectedPeriod === 'monthly')   return dYear === selectedYear && dMonth === selectedMonth;
        if (selectedPeriod === 'quarterly') return dYear === selectedYear && qMonths.includes(dMonth);
        if (selectedPeriod === 'yearly')    return dYear === selectedYear;
        return false;
      });
    }

    // Tidak ada detail → fallback ke createdAt
    if (!fallbackYear) return false;
    if (selectedPeriod === 'monthly')   return fallbackYear === selectedYear && fallbackMonth === selectedMonth;
    if (selectedPeriod === 'quarterly') return fallbackYear === selectedYear && qMonths.includes(fallbackMonth);
    if (selectedPeriod === 'yearly')    return fallbackYear === selectedYear;
    return false;
  };

  // ─── Helper: realisasi sesuai periode ─────────────────────────────────────
  const getRealisasiPeriode = (item) => {
    if (selectedPeriod === 'all') return Number(item.realisasi) || 0;
    if (!item.realisasiDetail?.length) return Number(item.realisasi) || 0;

    let fallbackYear = null;
    if (item.createdAt) {
      try {
        const d = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
        fallbackYear = d.getFullYear();
      } catch (_) {}
    }

    return item.realisasiDetail
      .filter(det => {
        const dYear = parseInt(det.tahunRealisasi) || fallbackYear;
        const dMonth = parseInt(det.bulanRealisasi);
        if (!dMonth) return false;
        if (selectedPeriod === 'monthly')   return dYear === selectedYear && dMonth === selectedMonth;
        if (selectedPeriod === 'quarterly') return dYear === selectedYear && qMonths.includes(dMonth);
        if (selectedPeriod === 'yearly')    return dYear === selectedYear;
        return false;
      })
      .reduce((s, det) => s + (Number(det.realisasi) || 0), 0);
  };

  // ─── Effect 2: terapkan semua filter ke rawData ───────────────────────────
  const data = useMemo(() => {
    let list = rawData;

    // Filter AP (admin only)
    if (userRole === 'admin' && selectedUser !== 'all')
      list = list.filter(item => item.namaAP === selectedUser);

    // Filter jenis paket (SY / MY)
    if (filterJenisPaket !== 'all')
      list = list.filter(item => item.jenisPaket === filterJenisPaket);

    // Filter periode (pakai realisasiDetail)
    list = list.filter(isItemInPeriod);

    return list;
  }, [rawData, selectedUser, filterJenisPaket, selectedPeriod, selectedMonth, selectedYear, qMonths, userRole]);

  // ─── Formatters ───────────────────────────────────────────────────────────
  const formatCurrency = (v) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);

  const formatDate = (ts) => {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-2 text-muted">Memuat data...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-5">
        <p className="text-muted mb-1">Tidak ada data untuk filter yang dipilih</p>
        {userRole === 'pic' && user?.namaAP && (
          <small className="text-muted d-block mt-2">
            AP: <Badge bg="primary">{user.namaAP}</Badge>
          </small>
        )}
        {userRole === 'admin' && selectedUser !== 'all' && (
          <small className="text-muted d-block mt-2">
            Filter AP: <Badge bg="info">{selectedUser}</Badge>
          </small>
        )}
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <Table hover className="align-middle">
        <thead className="table-light">
          <tr>
            <th>No</th>
            <th>ID Paket</th>
            <th>Nama Paket</th>
            {userRole === 'admin' && selectedUser === 'all' && <th>AP</th>}
            <th>Jenis Paket</th>
            <th>Komitmen</th>
            <th>Realisasi{selectedPeriod !== 'all' ? ' (Periode)' : ''}</th>
            <th>Belum Realisasi</th>
            <th>TKDN</th>
            <th>PDN</th>
            <th>Import</th>
            <th>Tanggal</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => {
            const acuanNilai = Number(item.nilaiKontrakKeseluruhan) ||
              (item.jenisPaket === 'Multi Year (MY)' ? Number(item.komitmenKeseluruhan) : Number(item.nilaiKomitmen)) ||
              Number(item.nilaiKomitmen) || 0;

            const realisasiPeriode = getRealisasiPeriode(item);
            const belumRealisasi   = Math.max(0, acuanNilai - realisasiPeriode);
            const persentase       = acuanNilai > 0
              ? ((realisasiPeriode / acuanNilai) * 100).toFixed(2)
              : 0;

            return (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td><small className="font-monospace">{item.idPaketMonitoring || item.idKontrak || '-'}</small></td>
                <td className="fw-medium">{item.namaPaket || '-'}</td>

                {userRole === 'admin' && selectedUser === 'all' && (
                  <td><Badge bg="info" className="font-monospace">{item.singkatanAP || item.namaAP || '-'}</Badge></td>
                )}

                <td>
                  <Badge bg={item.jenisPaket === 'Multi Year (MY)' ? 'warning' : 'secondary'} text="dark">
                    {item.jenisPaket === 'Multi Year (MY)' ? 'MY' : 'SY'}
                  </Badge>
                </td>

                <td>{formatCurrency(item.nilaiKomitmen)}</td>

                <td className="text-success fw-medium">
                  {formatCurrency(realisasiPeriode)}
                  <br />
                  <small className="text-muted">({persentase}%)</small>
                </td>

                <td className="text-warning">{formatCurrency(belumRealisasi)}</td>
                <td>{formatCurrency(item.nilaiKeseluruhanTKDN || item.nilaiTKDN || 0)}</td>
                <td>{formatCurrency(item.nilaiKeseluruhanPDN  || item.nilaiPDN  || 0)}</td>
                <td>{formatCurrency(item.nilaiKeseluruhanImport || item.nilaiImpor || 0)}</td>
                <td><small>{formatDate(item.createdAt)}</small></td>

                <td>
                  {item.completionStatus === 'selesai' ? (
                    <Badge bg="success">✅ Selesai</Badge>
                  ) : item.approvalStatus === 'rejected' ? (
                    <Badge bg="danger">Ditolak</Badge>
                  ) : item.approvalStatus === 'approved' ? (
                    <Badge bg={persentase >= 100 ? 'success' : persentase >= 50 ? 'warning' : 'primary'}>
                      {persentase >= 100 ? 'Lunas' : persentase >= 50 ? 'Proses' : 'Disetujui'}
                    </Badge>
                  ) : (
                    <Badge bg="secondary">Pending</Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      <div className="text-muted small mt-3 d-flex justify-content-between align-items-center">
        <span>Total: <strong>{data.length}</strong> paket</span>
        {userRole === 'pic' && user?.namaAP && (
          <span>Filter otomatis: <Badge bg="primary">{user.namaAP}</Badge></span>
        )}
        {userRole === 'admin' && selectedUser !== 'all' && (
          <span>Filter AP: <Badge bg="info">{selectedUser}</Badge></span>
        )}
      </div>
    </div>
  );
};

export default DataTable;
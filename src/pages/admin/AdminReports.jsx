import { useState, useEffect } from 'react';
import { Container, Card, Row, Col, Button, Form, Spinner, Alert, Badge, Table } from 'react-bootstrap';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import NavigationBar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import { FaFileExcel, FaCalendarAlt, FaFilter } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import * as XLSX from 'xlsx';
import 'react-toastify/dist/ReactToastify.css';
import { addNotification } from '../../utils/notificationService';

const AdminReports = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [komitmenData, setKomitmenData] = useState([]);
  const [uniqueAPs, setUniqueAPs] = useState([]);

  const [periodType, setPeriodType] = useState('monthly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');

  const [filterAP, setFilterAP] = useState('all');
  const [filterJenisPaket, setFilterJenisPaket] = useState('all');
  const [filterJenisAnggaran, setFilterJenisAnggaran] = useState('all');
  const [filterJenisPengadaan, setFilterJenisPengadaan] = useState('all');
  const [filterApprovalStatus, setFilterApprovalStatus] = useState('all');

  const months = [
    { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' }, { value: 4, label: 'April' },
    { value: 5, label: 'Mei' }, { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' }, { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' }, { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' }, { value: 12, label: 'Desember' }
  ];

  const quarters = [
    { value: 1, label: 'Triwulan I (Jan-Mar)', months: [1, 2, 3] },
    { value: 2, label: 'Triwulan II (Apr-Jun)', months: [4, 5, 6] },
    { value: 3, label: 'Triwulan III (Jul-Sep)', months: [7, 8, 9] },
    { value: 4, label: 'Triwulan IV (Okt-Des)', months: [10, 11, 12] }
  ];

  const years = [];
  for (let i = 2020; i <= new Date().getFullYear() + 1; i++) years.push(i);

  const jenisPengadaanOptions = ['Barang', 'Jasa Konsultasi', 'Jasa Lainnya', 'Pekerjaan Konstruksi'];

  useEffect(() => { fetchKomitmen(); }, []);

  useEffect(() => {
    if (komitmenData.length > 0) {
      const aps = [...new Set(komitmenData.map(item => item.namaAP).filter(Boolean))];
      setUniqueAPs(aps.sort());
    }
  }, [komitmenData]);

  const fetchKomitmen = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(query(collection(db, 'komitmen'), orderBy('createdAt', 'desc')));
      setKomitmenData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat data');
      setLoading(false);
    }
  };

  const formatCurrency = (v) => {
    if (!v) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);
  };

  const getMonthName = (month) => months.find(m => m.value === month)?.label || '';
  const getQuarterName = (q) => quarters.find(x => x.value === q)?.label || '';

  const getPeriodLabel = () => {
    switch (periodType) {
      case 'monthly': return `${getMonthName(selectedMonth)} ${selectedYear}`;
      case 'quarterly': return `${getQuarterName(selectedQuarter)} ${selectedYear}`;
      case 'yearly': return `Tahun ${selectedYear}`;
      case 'custom': return `${customDateFrom} s/d ${customDateTo}`;
      default: return '';
    }
  };

  // ─── Helper: cek apakah 1 realisasiDetail cocok periode ───────────────────
  const isDetailInPeriod = (detail, fallbackYear) => {
    const dYear = parseInt(detail.tahunRealisasi) || fallbackYear;
    const dMonth = parseInt(detail.bulanRealisasi);
    if (!dMonth) return false;

    switch (periodType) {
      case 'monthly':
        return dYear === selectedYear && dMonth === selectedMonth;
      case 'quarterly':
        return dYear === selectedYear &&
          (quarters.find(q => q.value === selectedQuarter)?.months || []).includes(dMonth);
      case 'yearly':
        return dYear === selectedYear;
      case 'custom': {
        if (!customDateFrom || !customDateTo) return false;
        const d = new Date(dYear, dMonth - 1, 1);
        return d >= new Date(customDateFrom) && d <= new Date(customDateTo);
      }
      default: return false;
    }
  };

  // ─── Filter periode: jika ada realisasiDetail → pakai detail saja,
  //     jika tidak ada → fallback ke createdAt ─────────────────────────────
  const filterByPeriod = (item) => {
    let fallbackYear = null, fallbackMonth = null;
    if (item.createdAt) {
      try {
        const d = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
        fallbackYear = d.getFullYear();
        fallbackMonth = d.getMonth() + 1;
      } catch (_) {}
    }

    if (item.realisasiDetail && item.realisasiDetail.length > 0) {
      // Punya detail → gunakan detail, JANGAN fallback ke createdAt
      return item.realisasiDetail.some(det => isDetailInPeriod(det, fallbackYear));
    }

    // Tidak ada detail → fallback ke createdAt
    if (!fallbackYear || !fallbackMonth) return false;
    switch (periodType) {
      case 'monthly':
        return fallbackYear === selectedYear && fallbackMonth === selectedMonth;
      case 'quarterly':
        return fallbackYear === selectedYear &&
          (quarters.find(q => q.value === selectedQuarter)?.months || []).includes(fallbackMonth);
      case 'yearly':
        return fallbackYear === selectedYear;
      case 'custom': {
        if (!customDateFrom || !customDateTo) return false;
        const d = new Date(fallbackYear, fallbackMonth - 1, 1);
        return d >= new Date(customDateFrom) && d <= new Date(customDateTo);
      }
      default: return false;
    }
  };

  // ─── Realisasi khusus periode (bukan global item.realisasi) ───────────────
  const getRealisasiPeriode = (item) => {
    let fallbackYear = null;
    if (item.createdAt) {
      try {
        const d = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
        fallbackYear = d.getFullYear();
      } catch (_) {}
    }

    if (!item.realisasiDetail || item.realisasiDetail.length === 0) {
      // Tidak ada detail → pakai global (fallback)
      return parseFloat(item.realisasi) || 0;
    }

    return item.realisasiDetail
      .filter(det => isDetailInPeriod(det, fallbackYear))
      .reduce((sum, det) => sum + (parseFloat(det.realisasi) || 0), 0);
  };

  const getFilteredData = () => {
    return komitmenData.filter(item => {
      if (!filterByPeriod(item)) return false;
      if (filterAP !== 'all' && item.namaAP !== filterAP) return false;
      if (filterJenisPaket !== 'all' && item.jenisPaket !== filterJenisPaket) return false;
      if (filterJenisAnggaran !== 'all' && item.jenisAnggaran !== filterJenisAnggaran) return false;
      if (filterJenisPengadaan !== 'all' && item.jenisPengadaan !== filterJenisPengadaan) return false;

      if (filterApprovalStatus !== 'all') {
        if (filterApprovalStatus === 'selesai') {
          // "Selesai" ditentukan dari completionStatus yang di-set admin di AdminKomitmen
          if (item.completionStatus !== 'selesai') return false;
        } else {
          if (item.approvalStatus !== filterApprovalStatus) return false;
        }
      }

      return true;
    });
  };

  const generateExcelReport = async () => {
    try {
      setLoading(true);
      const filteredData = getFilteredData();

      if (filteredData.length === 0) {
        toast.warning('Tidak ada data untuk periode yang dipilih');
        setLoading(false);
        return;
      }

      const excelData = filteredData.map((item, idx) => {
        const nilaiKontrak = parseFloat(item.nilaiKontrakKeseluruhan) || 0;
        const realisasiPeriode = getRealisasiPeriode(item);
        const progress = nilaiKontrak > 0 ? ((realisasiPeriode / nilaiKontrak) * 100).toFixed(2) : 0;
        const sisa = nilaiKontrak - realisasiPeriode;

        const vendors = item.realisasiDetail?.map(d => d.namaPenyedia).filter(Boolean) || [];
        const vendorList = [...new Set(vendors)].join(', ') || item.namaPenyedia || '-';

        let tahunBuat = '-', bulanBuat = '-';
        if (item.createdAt) {
          const d = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
          tahunBuat = d.getFullYear();
          bulanBuat = d.getMonth() + 1;
        }

        return {
          'No': idx + 1,
          'ID Paket Monitoring': item.idPaketMonitoring || '-',
          'Jenis Paket': item.jenisPaket || '-',
          'ID RUP': item.idRUP || '-',
          'Nama AP': item.namaAP || '-',
          'Nama Paket': item.namaPaket || '-',
          'Jenis Anggaran': item.jenisAnggaran || '-',
          'Jenis Pengadaan': item.jenisPengadaan || '-',
          'Metode Pemilihan': item.usulanMetodePemilihan || '-',
          'Status PaDi': item.statusPadi || '-',
          'Komitmen Tahun Berjalan (Rp)': parseFloat(item.nilaiKomitmen) || 0,
          'Komitmen Keseluruhan (Rp)': parseFloat(item.komitmenKeseluruhan) || 0,
          'Waktu Pemanfaatan Dari': item.waktuPemanfaatanDari || '-',
          'Waktu Pemanfaatan Sampai': item.waktuPemanfaatanSampai || '-',
          'Nilai Kontrak Keseluruhan (Rp)': nilaiKontrak,
          [`Realisasi Periode ${getPeriodLabel()} (Rp)`]: realisasiPeriode,
          'Progress Periode (%)': parseFloat(progress),
          'Sisa Pembayaran Periode (Rp)': sisa,
          'PDN Checkbox': item.pdnCheckbox ? 'Ya' : 'Tidak',
          'TKDN Checkbox': item.tkdnCheckbox ? 'Ya' : 'Tidak',
          'Import Checkbox': item.importCheckbox ? 'Ya' : 'Tidak',
          'Nilai Tahun Berjalan PDN (Rp)': parseFloat(item.nilaiTahunBerjalanPDN) || 0,
          'Nilai Keseluruhan PDN (Rp)': parseFloat(item.nilaiKeseluruhanPDN) || 0,
          'Nilai Tahun Berjalan TKDN (Rp)': parseFloat(item.nilaiTahunBerjalanTKDN) || 0,
          'Nilai Keseluruhan TKDN (Rp)': parseFloat(item.nilaiKeseluruhanTKDN) || 0,
          'Nilai Tahun Berjalan Import (Rp)': parseFloat(item.nilaiTahunBerjalanImport) || 0,
          'Nilai Keseluruhan Import (Rp)': parseFloat(item.nilaiKeseluruhanImport) || 0,
          'Target Nilai TKDN (Rp)': parseFloat(item.targetNilaiTKDN) || 0,
          'Nilai Anggaran Belanja (Rp)': parseFloat(item.nilaiAnggaranBelanja) || 0,
          'PDN Realisasi (Rp)': parseFloat(item.nilaiPDN) || 0,
          'TKDN Realisasi (Rp)': parseFloat(item.nilaiTKDN) || 0,
          'Import Realisasi (Rp)': parseFloat(item.nilaiImpor) || 0,
          'Nama Penyedia': vendorList,
          'Kualifikasi Penyedia': item.kualifikasiPenyedia || '-',
          'Approval Status': item.approvalStatus || 'draft',
          'Completion Status': item.completionStatus || '-',
          'Approved By': item.approvedBy || '-',
          'Approval Note': item.approvalNote || '-',
          'Tahun Buat': tahunBuat,
          'Bulan Buat': bulanBuat,
          'Catatan Komitmen': item.catatanKomitmen || '-',
          'Keterangan': item.keterangan || '-',
          'Created By': item.createdBy || '-',
          'Updated By': item.updatedBy || '-'
        };
      });

      // Sheet 2: Detail Realisasi — hanya yang cocok periode
      const realisasiDetailData = [];
      filteredData.forEach((item, idx) => {
        let fallbackYear = null;
        if (item.createdAt) {
          try {
            const d = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
            fallbackYear = d.getFullYear();
          } catch (_) {}
        }
        (item.realisasiDetail || [])
          .filter(det => isDetailInPeriod(det, fallbackYear))
          .forEach((det, di) => {
            realisasiDetailData.push({
              'No Komitmen': idx + 1,
              'ID Paket': item.idPaketMonitoring || '-',
              'Nama Paket': item.namaPaket || '-',
              'Nama AP': item.namaAP || '-',
              'No Detail': di + 1,
              'Tahun Realisasi': det.tahunRealisasi || '-',
              'Bulan Realisasi': getMonthName(parseInt(det.bulanRealisasi)),
              'Nilai Realisasi (Rp)': parseFloat(det.realisasi) || 0,
              'Nomor Invoice': det.nomorInvoice || '-',
              'Tanggal Invoice': det.tanggalInvoice || '-',
              'Nama Penyedia': det.namaPenyedia || item.namaPenyedia || '-',
              'Kualifikasi Penyedia': det.kualifikasiPenyedia || item.kualifikasiPenyedia || '-',
              'Nama Pengadaan': det.namaPengadaanRealisasi || '-',
              'Metode Pemilihan': det.metodePemilihanRealisasi || '-'
            });
          });
      });

      // Sheet 3: Rencana Realisasi
      const rencanaDetailData = [];
      filteredData.forEach((item, idx) => {
        (item.rencanaDetail || []).forEach((det, di) => {
          rencanaDetailData.push({
            'No Komitmen': idx + 1,
            'ID Paket': item.idPaketMonitoring || '-',
            'Nama Paket': item.namaPaket || '-',
            'Nama AP': item.namaAP || '-',
            'No Detail': di + 1,
            'Tahun Rencana': det.tahunRencana || '-',
            'Nilai Rencana (Rp)': parseFloat(det.nilaiRencana) || 0,
            'Bulan Rencana': getMonthName(parseInt(det.bulanRencana)),
            'Keterangan': det.keterangan || '-'
          });
        });
      });

      // Sheet 4: Ringkasan — gunakan realisasi periode
      const totalKomitmen = filteredData.reduce((s, i) => s + (parseFloat(i.nilaiKomitmen) || 0), 0);
      const totalKomitmenKeseluruhan = filteredData.reduce((s, i) => s + (parseFloat(i.komitmenKeseluruhan) || 0), 0);
      const totalNilaiKontrak = filteredData.reduce((s, i) => s + (parseFloat(i.nilaiKontrakKeseluruhan) || 0), 0);
      const totalRealisasiPeriode = filteredData.reduce((s, i) => s + getRealisasiPeriode(i), 0);
      const totalPDN = filteredData.reduce((s, i) => s + (parseFloat(i.nilaiPDN) || 0), 0);
      const totalTKDN = filteredData.reduce((s, i) => s + (parseFloat(i.nilaiTKDN) || 0), 0);
      const totalImport = filteredData.reduce((s, i) => s + (parseFloat(i.nilaiImpor) || 0), 0);

      const summaryData = [
        { 'Keterangan': `RINGKASAN LAPORAN - ${getPeriodLabel()}`, 'Nilai': '', 'Satuan': '' },
        { 'Keterangan': '', 'Nilai': '', 'Satuan': '' },
        { 'Keterangan': 'TOTAL DATA', 'Nilai': '', 'Satuan': '' },
        { 'Keterangan': 'Total Paket', 'Nilai': filteredData.length, 'Satuan': 'paket' },
        { 'Keterangan': '', 'Nilai': '', 'Satuan': '' },
        { 'Keterangan': 'NILAI KONTRAK & REALISASI', 'Nilai': '', 'Satuan': '' },
        { 'Keterangan': 'Total Komitmen Tahun Berjalan', 'Nilai': totalKomitmen, 'Satuan': 'Rupiah' },
        { 'Keterangan': 'Total Komitmen Keseluruhan', 'Nilai': totalKomitmenKeseluruhan, 'Satuan': 'Rupiah' },
        { 'Keterangan': 'Total Nilai Kontrak', 'Nilai': totalNilaiKontrak, 'Satuan': 'Rupiah' },
        { 'Keterangan': `Total Realisasi ${getPeriodLabel()}`, 'Nilai': totalRealisasiPeriode, 'Satuan': 'Rupiah' },
        { 'Keterangan': 'Persentase Realisasi Periode', 'Nilai': totalNilaiKontrak > 0 ? ((totalRealisasiPeriode / totalNilaiKontrak) * 100).toFixed(2) : 0, 'Satuan': '%' },
        { 'Keterangan': '', 'Nilai': '', 'Satuan': '' },
        { 'Keterangan': 'KANDUNGAN LOKAL & IMPORT', 'Nilai': '', 'Satuan': '' },
        { 'Keterangan': 'Total PDN', 'Nilai': totalPDN, 'Satuan': 'Rupiah' },
        { 'Keterangan': 'Total TKDN', 'Nilai': totalTKDN, 'Satuan': 'Rupiah' },
        { 'Keterangan': 'Total P3DN (PDN + TKDN)', 'Nilai': totalPDN + totalTKDN, 'Satuan': 'Rupiah' },
        { 'Keterangan': 'Total Import', 'Nilai': totalImport, 'Satuan': 'Rupiah' },
        { 'Keterangan': '', 'Nilai': '', 'Satuan': '' },
        { 'Keterangan': 'BREAKDOWN PER JENIS PENGADAAN', 'Nilai': '', 'Satuan': '' }
      ];

      const pengadaanMap = {};
      filteredData.forEach(item => {
        const k = item.jenisPengadaan || 'Tidak Tercatat';
        if (!pengadaanMap[k]) pengadaanMap[k] = { count: 0, total: 0 };
        pengadaanMap[k].count++;
        pengadaanMap[k].total += (parseFloat(item.nilaiKontrakKeseluruhan) || 0);
      });
      Object.entries(pengadaanMap).forEach(([k, d]) => {
        summaryData.push({ 'Keterangan': `${k} (${d.count} paket)`, 'Nilai': d.total, 'Satuan': 'Rupiah' });
        summaryData.push({ 'Keterangan': `  Persentase ${k}`, 'Nilai': totalNilaiKontrak > 0 ? ((d.total / totalNilaiKontrak) * 100).toFixed(2) : 0, 'Satuan': '%' });
      });

      summaryData.push({ 'Keterangan': '', 'Nilai': '', 'Satuan': '' });
      summaryData.push({ 'Keterangan': 'BREAKDOWN PER AP', 'Nilai': '', 'Satuan': '' });
      const apMap = {};
      filteredData.forEach(item => {
        const k = item.namaAP || 'Tidak Tercatat';
        if (!apMap[k]) apMap[k] = { count: 0, total: 0, realisasi: 0 };
        apMap[k].count++;
        apMap[k].total += (parseFloat(item.nilaiKontrakKeseluruhan) || 0);
        apMap[k].realisasi += getRealisasiPeriode(item);
      });
      Object.entries(apMap).forEach(([k, d]) => {
        summaryData.push({ 'Keterangan': `${k} (${d.count} paket)`, 'Nilai': d.total, 'Satuan': 'Rupiah' });
        summaryData.push({ 'Keterangan': `  Realisasi Periode ${k}`, 'Nilai': d.realisasi, 'Satuan': 'Rupiah' });
        summaryData.push({ 'Keterangan': `  Progress ${k}`, 'Nilai': d.total > 0 ? ((d.realisasi / d.total) * 100).toFixed(2) : 0, 'Satuan': '%' });
      });

      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.json_to_sheet(excelData);
      ws1['!cols'] = Object.keys(excelData[0] || {}).map(() => ({ wch: 20 }));
      XLSX.utils.book_append_sheet(wb, ws1, 'Data Komitmen');

      if (realisasiDetailData.length > 0) {
        const ws2 = XLSX.utils.json_to_sheet(realisasiDetailData);
        ws2['!cols'] = Object.keys(realisasiDetailData[0] || {}).map(() => ({ wch: 18 }));
        XLSX.utils.book_append_sheet(wb, ws2, 'Detail Realisasi');
      }
      if (rencanaDetailData.length > 0) {
        const ws3 = XLSX.utils.json_to_sheet(rencanaDetailData);
        ws3['!cols'] = Object.keys(rencanaDetailData[0] || {}).map(() => ({ wch: 18 }));
        XLSX.utils.book_append_sheet(wb, ws3, 'Rencana Realisasi');
      }

      const ws4 = XLSX.utils.json_to_sheet(summaryData);
      ws4['!cols'] = [{ wch: 45 }, { wch: 25 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws4, 'Ringkasan');

      let filename = filterAP !== 'all'
        ? `Laporan_${filterAP.replace(/\s/g, '_')}_${getPeriodLabel().replace(/\s/g, '_')}.xlsx`
        : `Laporan_${getPeriodLabel().replace(/\s/g, '_')}.xlsx`;

      XLSX.writeFile(wb, filename);

      await addNotification(
        user?.uid || '', 'success', 'Laporan Berhasil Dibuat',
        `Laporan ${getPeriodLabel()} telah selesai dibuat. Total ${filteredData.length} data.`,
        { action: 'report_generated', periodType, totalRecords: filteredData.length, filename }
      );

      toast.success(`Excel berhasil di-download: ${filename}`);
      setLoading(false);
    } catch (err) {
      console.error(err);
      toast.error('Gagal generate Excel: ' + err.message);
      setLoading(false);
    }
  };

  const filteredPreview = getFilteredData();

  // Badge helper untuk preview
  const getStatusBadge = (item) => {
    if (item.completionStatus === 'selesai') return <Badge bg="success">Selesai</Badge>;
    if (item.approvalStatus === 'rejected') return <Badge bg="danger">Rejected</Badge>;
    if (item.approvalStatus === 'approved') return <Badge bg="primary">Approved</Badge>;
    return <Badge bg="warning" text="dark">Pending</Badge>;
  };

  return (
    <>
      <NavigationBar />
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="d-flex">
        <Sidebar />
        <Container
          fluid
          style={{ marginLeft: '250px', paddingTop: '100px', paddingLeft: '1.5rem', paddingRight: '1.5rem', paddingBottom: '1.5rem', minHeight: '100vh' }}
        >
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h2 className="fw-bold mb-1">Laporan</h2>
              <p className="text-muted mb-0">Generate dan download laporan monitoring AP — {getPeriodLabel()}</p>
            </div>
          </div>

          {/* ── Filter Card ─────────────────────────────────────────── */}
          <Card className="shadow-sm mb-4">
            <Card.Body>
              {/* Baris periode */}
              <Row className="g-3 mb-3">
                <Col xs={12} md={3}>
                  <Form.Label className="small fw-bold"><FaCalendarAlt className="me-2" />Tipe Periode</Form.Label>
                  <Form.Select value={periodType} onChange={e => setPeriodType(e.target.value)}>
                    <option value="monthly">Bulanan</option>
                    <option value="quarterly">Triwulan</option>
                    <option value="yearly">Tahunan</option>
                    <option value="custom">Custom</option>
                  </Form.Select>
                </Col>

                {periodType === 'monthly' && <>
                  <Col xs={6} md={2}>
                    <Form.Label className="small fw-bold">Tahun</Form.Label>
                    <Form.Select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </Form.Select>
                  </Col>
                  <Col xs={6} md={2}>
                    <Form.Label className="small fw-bold">Bulan</Form.Label>
                    <Form.Select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}>
                      {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </Form.Select>
                  </Col>
                </>}

                {periodType === 'quarterly' && <>
                  <Col xs={6} md={2}>
                    <Form.Label className="small fw-bold">Tahun</Form.Label>
                    <Form.Select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </Form.Select>
                  </Col>
                  <Col xs={6} md={3}>
                    <Form.Label className="small fw-bold">Triwulan</Form.Label>
                    <Form.Select value={selectedQuarter} onChange={e => setSelectedQuarter(parseInt(e.target.value))}>
                      {quarters.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
                    </Form.Select>
                  </Col>
                </>}

                {periodType === 'yearly' && (
                  <Col xs={12} md={2}>
                    <Form.Label className="small fw-bold">Tahun</Form.Label>
                    <Form.Select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </Form.Select>
                  </Col>
                )}

                {periodType === 'custom' && <>
                  <Col xs={6} md={2}>
                    <Form.Label className="small fw-bold">Dari Tanggal</Form.Label>
                    <Form.Control type="date" value={customDateFrom} onChange={e => setCustomDateFrom(e.target.value)} />
                  </Col>
                  <Col xs={6} md={2}>
                    <Form.Label className="small fw-bold">Sampai Tanggal</Form.Label>
                    <Form.Control type="date" value={customDateTo} onChange={e => setCustomDateTo(e.target.value)} />
                  </Col>
                </>}

                <Col xs={12} md={2}>
                  <Form.Label className="small fw-bold d-none d-md-block">&nbsp;</Form.Label>
                  <Button variant="success" className="w-100" onClick={generateExcelReport} disabled={loading || filteredPreview.length === 0}>
                    <FaFileExcel className="me-2" />Export Excel
                  </Button>
                </Col>
              </Row>

              {/* Filter Tambahan */}
              <Row className="g-3">
                <Col xs={12}>
                  <div className="border-top pt-3">
                    <Form.Label className="small fw-bold mb-2"><FaFilter className="me-2" />Filter Tambahan</Form.Label>
                  </div>
                </Col>
                <Col xs={12} md={3}>
                  <Form.Label className="small">Nama AP</Form.Label>
                  <Form.Select size="sm" value={filterAP} onChange={e => setFilterAP(e.target.value)}>
                    <option value="all">Semua AP</option>
                    {uniqueAPs.map(ap => <option key={ap} value={ap}>{ap}</option>)}
                  </Form.Select>
                </Col>
                <Col xs={12} md={2}>
                  <Form.Label className="small">Jenis Paket</Form.Label>
                  <Form.Select size="sm" value={filterJenisPaket} onChange={e => setFilterJenisPaket(e.target.value)}>
                    <option value="all">Semua</option>
                    <option value="Single Year (SY)">Single Year (SY)</option>
                    <option value="Multi Year (MY)">Multi Year (MY)</option>
                  </Form.Select>
                </Col>
                <Col xs={12} md={2}>
                  <Form.Label className="small">Jenis Anggaran</Form.Label>
                  <Form.Select size="sm" value={filterJenisAnggaran} onChange={e => setFilterJenisAnggaran(e.target.value)}>
                    <option value="all">Semua</option>
                    <option value="Opex">Opex</option>
                    <option value="Capex">Capex</option>
                  </Form.Select>
                </Col>
                <Col xs={12} md={2}>
                  <Form.Label className="small">Jenis Pengadaan</Form.Label>
                  <Form.Select size="sm" value={filterJenisPengadaan} onChange={e => setFilterJenisPengadaan(e.target.value)}>
                    <option value="all">Semua</option>
                    {jenisPengadaanOptions.map(jp => <option key={jp} value={jp}>{jp}</option>)}
                  </Form.Select>
                </Col>
                <Col xs={12} md={3}>
                  <Form.Label className="small">Status</Form.Label>
                  <Form.Select size="sm" value={filterApprovalStatus} onChange={e => setFilterApprovalStatus(e.target.value)}>
                    <option value="all">Semua Status</option>
                    <option value="draft">Pending Approval</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="selesai">Selesai</option>
                  </Form.Select>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Preview */}
          <Card className="shadow-sm mb-4">
            <Card.Header className="bg-light">
              <h5 className="mb-0 fw-bold">Preview Data</h5>
            </Card.Header>
            <Card.Body>
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                  <p className="mt-2">Loading data...</p>
                </div>
              ) : (
                <>
                  <Alert variant="info">
                    <strong>Total data yang akan diexport:</strong> {filteredPreview.length} paket
                    {filterAP !== 'all' && <><br /><strong>AP:</strong> {filterAP}</>}
                    {filterJenisPaket !== 'all' && <><br /><strong>Jenis Paket:</strong> {filterJenisPaket}</>}
                    {filterJenisAnggaran !== 'all' && <><br /><strong>Jenis Anggaran:</strong> {filterJenisAnggaran}</>}
                    <br /><strong>Periode:</strong> {getPeriodLabel()}
                  </Alert>

                  {filteredPreview.length > 0 && (
                    <div className="table-responsive">
                      <Table striped bordered hover size="sm">
                        <thead className="table-light">
                          <tr>
                            <th>#</th>
                            <th>ID Paket</th>
                            <th>Nama Paket</th>
                            <th>AP</th>
                            <th>Jenis</th>
                            <th>Nilai Kontrak</th>
                            <th>Realisasi ({getPeriodLabel()})</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPreview.slice(0, 10).map((item, idx) => (
                            <tr key={item.id}>
                              <td>{idx + 1}</td>
                              <td><small className="font-monospace">{item.idPaketMonitoring}</small></td>
                              <td>{item.namaPaket}</td>
                              <td><small>{item.namaAP}</small></td>
                              <td><Badge bg="info">{item.jenisPaket}</Badge></td>
                              <td>{formatCurrency(item.nilaiKontrakKeseluruhan)}</td>
                              <td><strong>{formatCurrency(getRealisasiPeriode(item))}</strong></td>
                              <td>{getStatusBadge(item)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                      {filteredPreview.length > 10 && (
                        <p className="text-muted text-center">... dan {filteredPreview.length - 10} data lainnya</p>
                      )}
                    </div>
                  )}
                  {filteredPreview.length === 0 && (
                    <p className="text-muted text-center">Tidak ada data untuk periode dan filter yang dipilih</p>
                  )}
                </>
              )}
            </Card.Body>
          </Card>

          {/* Info */}
          <Card className="shadow-sm">
            <Card.Body>
              <h5 className="fw-bold mb-3">Informasi Laporan</h5>
              <Row>
                <Col md={6}>
                  <h6 className="fw-bold">Data yang Disertakan:</h6>
                  <ul>
                    <li>4 Sheet: Data Komitmen, Detail Realisasi, Rencana Realisasi & Ringkasan</li>
                    <li>Realisasi dihitung dari Detail Realisasi sesuai periode terpilih</li>
                    <li>Detail Realisasi difilter hanya untuk periode yang dipilih</li>
                    <li>Breakdown PDN, TKDN, Import & P3DN</li>
                    <li>Status Approval & Completion dari AdminKomitmen</li>
                    <li>Ringkasan per Jenis Pengadaan & AP</li>
                  </ul>
                </Col>
                <Col md={6}>
                  <h6 className="fw-bold">Fitur Filter:</h6>
                  <ul>
                    <li>Filter Periode: Bulanan, Triwulan, Tahunan, Custom</li>
                    <li>Filter AP: Semua atau per AP tertentu</li>
                    <li>Filter Jenis Paket: SY / MY</li>
                    <li>Filter Jenis Anggaran: Opex / Capex</li>
                    <li>Filter Jenis Pengadaan</li>
                    <li>Filter Status: Pending / Approved / Rejected / Selesai</li>
                  </ul>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Container>
      </div>
    </>
  );
};

export default AdminReports;
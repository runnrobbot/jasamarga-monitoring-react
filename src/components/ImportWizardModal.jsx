import { useState } from 'react';
import { Modal, Button, Form, Row, Col, Badge, Alert, Spinner, Tabs, Tab } from 'react-bootstrap';
import { doc, updateDoc, getDocs, query, collection, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { toast } from 'react-toastify';

const MONTHS = [
  { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' }, { value: 4, label: 'April' },
  { value: 5, label: 'Mei' }, { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' }, { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' }, { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' }, { value: 12, label: 'Desember' },
];

const fmtRp = (v) => {
  if (!v && v !== 0) return '';
  const s = v.toString().replace(/[^\d,]/g, '');
  const parts = s.split(',');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return parts.length > 1 ? `${parts[0]},${parts[1].slice(0, 2)}` : parts[0];
};
const parseRp = (v) => {
  if (!v) return 0;
  return parseFloat(v.toString().replace(/\./g, '').replace(/,/g, '.')) || 0;
};

const defaultKomitmen = (item) => ({
  jenisPaket: item.jenisPaket || 'Single Year (SY)',
  idRUP: item.idRUP || '',
  namaAP: item.namaAP || '',
  namaPaket: item.namaPaket || '',
  jenisAnggaran: item.jenisAnggaran || 'Opex',
  jenisPengadaan: item.jenisPengadaan || 'Barang',
  usulanMetodePemilihan: item.usulanMetodePemilihan || 'Tender/Seleksi Umum',
  statusPadi: item.statusPadi || 'Non PaDi',
  nilaiKomitmen: fmtRp(item.nilaiKomitmen || ''),
  komitmenKeseluruhan: fmtRp(item.komitmenKeseluruhan || ''),
  waktuPemanfaatanDari: item.waktuPemanfaatanDari || '',
  waktuPemanfaatanSampai: item.waktuPemanfaatanSampai || '',
  pdnCheckbox: item.pdnCheckbox || false,
  tkdnCheckbox: item.tkdnCheckbox || false,
  importCheckbox: item.importCheckbox || false,
  nilaiTahunBerjalanPDN: fmtRp(item.nilaiTahunBerjalanPDN || ''),
  nilaiKeseluruhanPDN: fmtRp(item.nilaiKeseluruhanPDN || ''),
  nilaiTahunBerjalanTKDN: fmtRp(item.nilaiTahunBerjalanTKDN || ''),
  nilaiKeseluruhanTKDN: fmtRp(item.nilaiKeseluruhanTKDN || ''),
  nilaiTahunBerjalanImport: fmtRp(item.nilaiTahunBerjalanImport || ''),
  nilaiKeseluruhanImport: fmtRp(item.nilaiKeseluruhanImport || ''),
  targetNilaiTKDN: fmtRp(item.targetNilaiTKDN || ''),
  nilaiAnggaranBelanja: fmtRp(item.nilaiAnggaranBelanja || ''),
  catatanKomitmen: item.catatanKomitmen || '',
});

const defaultRealisasi = () => ({
  namaPenyedia: '',
  kualifikasiPenyedia: 'UMKM',
  nilaiKontrakKeseluruhan: '',
  namaPengadaanRealisasi: '',
  metodePemilihanRealisasi: '',
  nilaiPDN: '',
  nilaiTKDN: '',
  nilaiImpor: '',
  keterangan: '',
  bulanRealisasi: '',
  tahunRealisasi: new Date().getFullYear().toString(),
  realisasi: '',
  nomorInvoice: '',
  tanggalInvoice: '',
});

export default function ImportWizardModal({ show, items, user, onClose }) {
  const [idx, setIdx] = useState(0);
  const [step, setStep] = useState('komitmen');
  const [komData, setKomData] = useState(() => items[0] ? defaultKomitmen(items[0]) : {});
  const [realData, setRealData] = useState(defaultRealisasi());
  const [saving, setSaving] = useState(false);

  const total = items.length;
  const current = items[idx];

  const goNext = (nextIdx) => {
    if (nextIdx >= total) {
      toast.success('Semua data import selesai diproses!');
      onClose();
      return;
    }
    setIdx(nextIdx);
    setStep('komitmen');
    setKomData(defaultKomitmen(items[nextIdx]));
    setRealData(defaultRealisasi());
  };

  const getDocId = async (item) => {
    const snap = await getDocs(query(collection(db, 'komitmen'), where('idPaketMonitoring', '==', item.idPaketMonitoring)));
    return snap.empty ? null : snap.docs[0].id;
  };

  const handleSaveKomitmen = async () => {
    if (!komData.namaPaket || !komData.namaAP) {
      toast.error('Nama Paket dan Nama AP wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const docId = await getDocId(current);
      if (!docId) { toast.error('Dokumen tidak ditemukan'); return; }
      const updatePayload = {
        jenisPaket: komData.jenisPaket,
        idRUP: komData.idRUP,
        namaAP: komData.namaAP,
        namaPaket: komData.namaPaket,
        jenisAnggaran: komData.jenisAnggaran,
        jenisPengadaan: komData.jenisPengadaan,
        usulanMetodePemilihan: komData.usulanMetodePemilihan,
        statusPadi: komData.statusPadi,
        nilaiKomitmen: parseRp(komData.nilaiKomitmen),
        komitmenKeseluruhan: parseRp(komData.komitmenKeseluruhan),
        waktuPemanfaatanDari: komData.waktuPemanfaatanDari,
        waktuPemanfaatanSampai: komData.waktuPemanfaatanSampai,
        pdnCheckbox: komData.pdnCheckbox,
        tkdnCheckbox: komData.tkdnCheckbox,
        importCheckbox: komData.importCheckbox,
        nilaiTahunBerjalanPDN: parseRp(komData.nilaiTahunBerjalanPDN),
        nilaiKeseluruhanPDN: parseRp(komData.nilaiKeseluruhanPDN),
        nilaiTahunBerjalanTKDN: parseRp(komData.nilaiTahunBerjalanTKDN),
        nilaiKeseluruhanTKDN: parseRp(komData.nilaiKeseluruhanTKDN),
        nilaiTahunBerjalanImport: parseRp(komData.nilaiTahunBerjalanImport),
        nilaiKeseluruhanImport: parseRp(komData.nilaiKeseluruhanImport),
        targetNilaiTKDN: parseRp(komData.targetNilaiTKDN),
        nilaiAnggaranBelanja: parseRp(komData.nilaiAnggaranBelanja),
        catatanKomitmen: komData.catatanKomitmen,
        updatedAt: new Date(),
        updatedBy: user?.email || '',
      };
      await updateDoc(doc(db, 'komitmen', docId), updatePayload);
      setStep('realisasi');
    } catch (e) {
      toast.error('Gagal menyimpan komitmen: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRealisasi = async () => {
    if (!realData.realisasi || parseRp(realData.realisasi) <= 0) {
      toast.error('Nilai Realisasi wajib diisi');
      return;
    }
    if (!realData.bulanRealisasi || !realData.nomorInvoice) {
      toast.error('Bulan dan Nomor Invoice wajib diisi');
      return;
    }
    if (!realData.namaPenyedia) {
      toast.error('Nama Penyedia wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const docId = await getDocId(current);
      if (!docId) { toast.error('Dokumen tidak ditemukan'); return; }
      const nilaiReal = parseRp(realData.realisasi);
      const nilaiKontrak = parseRp(realData.nilaiKontrakKeseluruhan);
      const nilaiKomitmen = parseRp(komData.nilaiKomitmen);
      const referensi = nilaiKontrak > 0 ? nilaiKontrak : nilaiKomitmen;
      const progres = referensi > 0 ? Math.min((nilaiReal / referensi) * 100, 100).toFixed(2) : '0';
      const detail = {
        tahunRealisasi: realData.tahunRealisasi,
        bulanRealisasi: realData.bulanRealisasi,
        realisasi: nilaiReal,
        nomorInvoice: realData.nomorInvoice,
        tanggalInvoice: realData.tanggalInvoice,
        namaPenyedia: realData.namaPenyedia,
        kualifikasiPenyedia: realData.kualifikasiPenyedia,
        namaPengadaanRealisasi: realData.namaPengadaanRealisasi,
        metodePemilihanRealisasi: realData.metodePemilihanRealisasi,
      };
      await updateDoc(doc(db, 'komitmen', docId), {
        realisasi: nilaiReal,
        realisasiDetail: [detail],
        nilaiKontrakKeseluruhan: nilaiKontrak,
        namaPenyedia: realData.namaPenyedia,
        kualifikasiPenyedia: realData.kualifikasiPenyedia,
        nilaiPDN: parseRp(realData.nilaiPDN),
        nilaiTKDN: parseRp(realData.nilaiTKDN),
        nilaiImpor: parseRp(realData.nilaiImpor),
        namaPengadaanRealisasi: realData.namaPengadaanRealisasi,
        metodePemilihanRealisasi: realData.metodePemilihanRealisasi,
        progres,
        sisaPembayaran: referensi - nilaiReal,
        keterangan: realData.keterangan,
        needRealisasi: false,
        updatedAt: new Date(),
        updatedBy: user?.email || '',
      });
      toast.success(`Realisasi "${current.namaPaket}" tersimpan`);
      goNext(idx + 1);
    } catch (e) {
      toast.error('Gagal menyimpan realisasi: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const setKom = (field, val) => setKomData(p => ({ ...p, [field]: val }));
  const setReal = (field, val) => setRealData(p => ({ ...p, [field]: val }));

  const handleCheckbox = (name) => {
    setKomData(p => ({
      ...p,
      pdnCheckbox: name === 'pdnCheckbox' ? !p.pdnCheckbox : false,
      tkdnCheckbox: name === 'tkdnCheckbox' ? !p.tkdnCheckbox : false,
      importCheckbox: name === 'importCheckbox' ? !p.importCheckbox : false,
    }));
  };

  if (!show || !current) return null;

  return (
    <Modal show={show} onHide={() => {}} size="xl" backdrop="static" keyboard={false}>
      <Modal.Header className="bg-primary text-white">
        <Modal.Title>
          Import Wizard — Item {idx + 1} / {total}
          <Badge bg="light" text="dark" className="ms-2">{step === 'komitmen' ? 'Step 1: Komitmen' : 'Step 2: Realisasi'}</Badge>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body style={{ maxHeight: '72vh', overflowY: 'auto' }}>
        <Alert variant="info" className="py-2">
          <strong>{current.namaPaket}</strong> — {current.namaAP}
          <Badge bg="secondary" className="ms-2">{current.idPaketMonitoring}</Badge>
        </Alert>

        {step === 'komitmen' && (
          <Form>
            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Nama Paket <span className="text-danger">*</span></Form.Label>
                  <Form.Control value={komData.namaPaket || ''} onChange={e => setKom('namaPaket', e.target.value)} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Nama AP <span className="text-danger">*</span></Form.Label>
                  <Form.Control value={komData.namaAP || ''} onChange={e => setKom('namaAP', e.target.value)} />
                </Form.Group>
              </Col>
            </Row>
            <Row className="mb-3">
              <Col md={4}>
                <Form.Group>
                  <Form.Label>ID RUP</Form.Label>
                  <Form.Control value={komData.idRUP || ''} onChange={e => setKom('idRUP', e.target.value)} />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Jenis Paket</Form.Label>
                  <Form.Select value={komData.jenisPaket || ''} onChange={e => setKom('jenisPaket', e.target.value)}>
                    <option>Single Year (SY)</option>
                    <option>Multi Year (MY)</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Jenis Anggaran</Form.Label>
                  <Form.Select value={komData.jenisAnggaran || ''} onChange={e => setKom('jenisAnggaran', e.target.value)}>
                    <option>Opex</option>
                    <option>Capex</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Jenis Pengadaan</Form.Label>
                  <Form.Select value={komData.jenisPengadaan || ''} onChange={e => setKom('jenisPengadaan', e.target.value)}>
                    <option>Barang</option>
                    <option>Jasa Konsultansi</option>
                    <option>Jasa Lainnya</option>
                    <option>Pekerjaan Konstruksi</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Metode Pemilihan</Form.Label>
                  <Form.Select value={komData.usulanMetodePemilihan || ''} onChange={e => setKom('usulanMetodePemilihan', e.target.value)}>
                    <option>Tender/Seleksi Umum</option>
                    <option>Tender/Seleksi Terbatas</option>
                    <option>Penunjukan Langsung</option>
                    <option>Pengadaan Langsung</option>
                    <option>Penetapan Langsung</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Nilai Komitmen (Tahun Ini)</Form.Label>
                  <Form.Control value={komData.nilaiKomitmen || ''} onChange={e => setKom('nilaiKomitmen', fmtRp(e.target.value))} placeholder="Rp" />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Komitmen Keseluruhan</Form.Label>
                  <Form.Control value={komData.komitmenKeseluruhan || ''} onChange={e => setKom('komitmenKeseluruhan', fmtRp(e.target.value))} placeholder="Rp" />
                </Form.Group>
              </Col>
            </Row>
            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Waktu Pemanfaatan Dari</Form.Label>
                  <Form.Control type="date" value={komData.waktuPemanfaatanDari || ''} onChange={e => setKom('waktuPemanfaatanDari', e.target.value)} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Waktu Pemanfaatan Sampai</Form.Label>
                  <Form.Control type="date" value={komData.waktuPemanfaatanSampai || ''} onChange={e => setKom('waktuPemanfaatanSampai', e.target.value)} />
                </Form.Group>
              </Col>
            </Row>
            <Row className="mb-3">
              <Col md={4}>
                <Form.Check type="checkbox" label="PDN" checked={!!komData.pdnCheckbox} onChange={() => handleCheckbox('pdnCheckbox')} />
              </Col>
              <Col md={4}>
                <Form.Check type="checkbox" label="TKDN" checked={!!komData.tkdnCheckbox} onChange={() => handleCheckbox('tkdnCheckbox')} />
              </Col>
              <Col md={4}>
                <Form.Check type="checkbox" label="Import" checked={!!komData.importCheckbox} onChange={() => handleCheckbox('importCheckbox')} />
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>Catatan Komitmen</Form.Label>
              <Form.Control as="textarea" rows={2} value={komData.catatanKomitmen || ''} onChange={e => setKom('catatanKomitmen', e.target.value)} />
            </Form.Group>
          </Form>
        )}

        {step === 'realisasi' && (
          <Form>
            <Alert variant="warning" className="py-2">
              <small>Isi data realisasi di bawah ini, atau klik <strong>Lewati</strong> untuk mengisi nanti via Edit.</small>
            </Alert>
            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Nama Penyedia <span className="text-danger">*</span></Form.Label>
                  <Form.Control value={realData.namaPenyedia} onChange={e => setReal('namaPenyedia', e.target.value)} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Kualifikasi Penyedia</Form.Label>
                  <Form.Select value={realData.kualifikasiPenyedia} onChange={e => setReal('kualifikasiPenyedia', e.target.value)}>
                    <option>UMKM</option>
                    <option>Non UMKM</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Nilai Realisasi <span className="text-danger">*</span></Form.Label>
                  <Form.Control value={realData.realisasi} onChange={e => setReal('realisasi', fmtRp(e.target.value))} placeholder="Rp" />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Nilai Kontrak Keseluruhan</Form.Label>
                  <Form.Control value={realData.nilaiKontrakKeseluruhan} onChange={e => setReal('nilaiKontrakKeseluruhan', fmtRp(e.target.value))} placeholder="Rp" />
                </Form.Group>
              </Col>
            </Row>
            <Row className="mb-3">
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Bulan Realisasi <span className="text-danger">*</span></Form.Label>
                  <Form.Select value={realData.bulanRealisasi} onChange={e => setReal('bulanRealisasi', e.target.value)}>
                    <option value="">Pilih Bulan</option>
                    {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Tahun Realisasi</Form.Label>
                  <Form.Control value={realData.tahunRealisasi} onChange={e => setReal('tahunRealisasi', e.target.value)} />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Tanggal Invoice</Form.Label>
                  <Form.Control type="date" value={realData.tanggalInvoice} onChange={e => {
                    const v = e.target.value;
                    const d = new Date(v);
                    setRealData(p => ({
                      ...p,
                      tanggalInvoice: v,
                      tahunRealisasi: !isNaN(d) ? d.getFullYear().toString() : p.tahunRealisasi,
                      bulanRealisasi: !isNaN(d) ? (d.getMonth() + 1).toString() : p.bulanRealisasi,
                    }));
                  }} />
                </Form.Group>
              </Col>
            </Row>
            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Nomor Invoice <span className="text-danger">*</span></Form.Label>
                  <Form.Control value={realData.nomorInvoice} onChange={e => setReal('nomorInvoice', e.target.value)} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Metode Pemilihan Realisasi</Form.Label>
                  <Form.Select value={realData.metodePemilihanRealisasi} onChange={e => setReal('metodePemilihanRealisasi', e.target.value)}>
                    <option value="">Pilih...</option>
                    <option>Tender/Seleksi Umum</option>
                    <option>Tender/Seleksi Terbatas</option>
                    <option>Penunjukan Langsung</option>
                    <option>Pengadaan Langsung</option>
                    <option>Penetapan Langsung</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>Nama Pengadaan</Form.Label>
              <Form.Control value={realData.namaPengadaanRealisasi} onChange={e => setReal('namaPengadaanRealisasi', e.target.value)} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Keterangan</Form.Label>
              <Form.Control as="textarea" rows={2} value={realData.keterangan} onChange={e => setReal('keterangan', e.target.value)} />
            </Form.Group>
          </Form>
        )}
      </Modal.Body>

      <Modal.Footer className="justify-content-between">
        <Button variant="danger" onClick={() => {
          if (window.confirm('Batalkan proses import wizard?')) onClose();
        }}>
          Batal
        </Button>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" disabled={saving} onClick={() => {
            toast.info(`"${current.namaPaket}" dilewati. Bisa dilengkapi via Edit.`);
            goNext(idx + 1);
          }}>
            Lewati
          </Button>
          {step === 'komitmen' ? (
            <Button variant="primary" disabled={saving} onClick={handleSaveKomitmen}>
              {saving ? <Spinner animation="border" size="sm" /> : 'Selanjutnya →'}
            </Button>
          ) : (
            <Button variant="success" disabled={saving} onClick={handleSaveRealisasi}>
              {saving ? <Spinner animation="border" size="sm" /> : 'Simpan Realisasi'}
            </Button>
          )}
        </div>
      </Modal.Footer>
    </Modal>
  );
}

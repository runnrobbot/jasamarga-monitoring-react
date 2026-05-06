/**
 * ImportWizardModal.jsx
 *
 * Wizard step-by-step untuk melengkapi data setelah import Excel.
 * Setiap item memiliki 2 step: Komitmen (step 1) → Realisasi (step 2).
 *
 * Props:
 *   show    — boolean, tampilkan wizard
 *   items   — array item yang sudah disimpan ke Firestore (masing-masing memiliki .id)
 *   user    — object user Firebase Auth
 *   onClose — callback ketika semua item selesai diproses (tidak rollback)
 *   onCancel — callback ketika user batalkan import (trigger rollback di hook)
 */

import { useState, useEffect } from 'react';
import { Modal, Button, Form, Row, Col, Badge, Alert, Spinner } from 'react-bootstrap';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { toast } from 'react-toastify';

// ── Konstanta ─────────────────────────────────────────────────────────────────
const MONTHS = [
  { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' }, { value: 4, label: 'April' },
  { value: 5, label: 'Mei' }, { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' }, { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' }, { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' }, { value: 12, label: 'Desember' },
];

// ── Helper format Rupiah ──────────────────────────────────────────────────────
const fmtRp = (v) => {
  if (v === '' || v === null || v === undefined) return '';
  const str = v.toString().replace(/[^\d,]/g, '');
  const parts = str.split(',');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return parts.length > 1 ? `${parts[0]},${parts[1].slice(0, 2)}` : parts[0];
};

const parseRp = (v) => {
  if (!v) return 0;
  return parseFloat(v.toString().replace(/\./g, '').replace(/,/g, '.')) || 0;
};

// ── Default state builders ────────────────────────────────────────────────────
const defaultKomitmen = (item) => ({
  jenisPaket: item.jenisPaket || 'Single Year (SY)',
  idRUP: item.idRUP || '',
  namaAP: item.namaAP || '',
  namaPaket: item.namaPaket || '',
  jenisAnggaran: item.jenisAnggaran || 'Opex',
  jenisPengadaan: item.jenisPengadaan || 'Barang',
  usulanMetodePemilihan: item.usulanMetodePemilihan || 'Tender/Seleksi Umum',
  statusPadi: item.statusPadi || 'Non PaDi',
  nilaiKomitmen: fmtRp(item.nilaiKomitmen ?? ''),
  komitmenKeseluruhan: fmtRp(item.komitmenKeseluruhan ?? ''),
  waktuPemanfaatanDari: item.waktuPemanfaatanDari || '',
  waktuPemanfaatanSampai: item.waktuPemanfaatanSampai || '',
  pdnCheckbox: item.pdnCheckbox || false,
  tkdnCheckbox: item.tkdnCheckbox || false,
  importCheckbox: item.importCheckbox || false,
  nilaiTahunBerjalanPDN: fmtRp(item.nilaiTahunBerjalanPDN ?? ''),
  nilaiKeseluruhanPDN: fmtRp(item.nilaiKeseluruhanPDN ?? ''),
  nilaiTahunBerjalanTKDN: fmtRp(item.nilaiTahunBerjalanTKDN ?? ''),
  nilaiKeseluruhanTKDN: fmtRp(item.nilaiKeseluruhanTKDN ?? ''),
  nilaiTahunBerjalanImport: fmtRp(item.nilaiTahunBerjalanImport ?? ''),
  nilaiKeseluruhanImport: fmtRp(item.nilaiKeseluruhanImport ?? ''),
  targetNilaiTKDN: fmtRp(item.targetNilaiTKDN ?? ''),
  nilaiAnggaranBelanja: fmtRp(item.nilaiAnggaranBelanja ?? ''),
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

// ── Sub-komponen: Modal Konfirmasi Batal ──────────────────────────────────────
function ConfirmCancelModal({ show, count, onConfirm, onDismiss }) {
  return (
    <Modal show={show} onHide={onDismiss} centered backdrop="static" size="sm">
      <Modal.Header className="bg-danger text-white">
        <Modal.Title className="fs-6">Batalkan Import?</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-1">
          Semua <strong>{count} data</strong> yang baru diimport akan{' '}
          <strong>dihapus permanen</strong>.
        </p>
        <p className="text-muted small mb-0">Tindakan ini tidak dapat dibatalkan.</p>
      </Modal.Body>
      <Modal.Footer className="justify-content-end gap-2">
        <Button variant="secondary" size="sm" onClick={onDismiss}>Kembali</Button>
        <Button variant="danger" size="sm" onClick={onConfirm}>Ya, Batalkan</Button>
      </Modal.Footer>
    </Modal>
  );
}

// ── Komponen utama ────────────────────────────────────────────────────────────
export default function ImportWizardModal({ show, items, user, onClose, onCancel }) {
  const [idx, setIdx] = useState(0);
  const [step, setStep] = useState('komitmen');
  const [komData, setKomData] = useState({});
  const [realData, setRealData] = useState(defaultRealisasi());
  const [saving, setSaving] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  /**
   * Reset state wizard setiap kali wizard dibuka kembali.
   * Penting: tanpa ini, idx akan stale dari session import sebelumnya,
   * sehingga baris pertama terlewat.
   */
  useEffect(() => {
    if (show && items && items.length > 0) {
      setIdx(0);
      setStep('komitmen');
      setKomData(defaultKomitmen(items[0]));
      setRealData(defaultRealisasi());
      setShowConfirmCancel(false);
    }
  }, [show]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = items?.length ?? 0;
  const current = items?.[idx];

  // ── Navigasi antar item ───────────────────────────────────────────────────
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

  // ── Save Step 1: Komitmen ─────────────────────────────────────────────────
  const handleSaveKomitmen = async () => {
    if (!komData.namaPaket || !komData.namaAP) {
      toast.error('Nama Paket dan Nama AP wajib diisi');
      return;
    }

    // Gunakan current.id langsung — TIDAK query Firestore lagi.
    // Menghindari race condition: dokumen baru di-commit via batch tapi belum
    // ter-index untuk query, menyebabkan item pertama selalu "tidak ditemukan".
    const docId = current?.id;
    if (!docId) {
      toast.error('ID dokumen tidak valid. Coba lewati item ini.');
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'komitmen', docId), {
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
      });
      setStep('realisasi');
    } catch (e) {
      toast.error('Gagal menyimpan komitmen: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Save Step 2: Realisasi ────────────────────────────────────────────────
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

    const docId = current?.id;
    if (!docId) {
      toast.error('ID dokumen tidak valid. Coba lewati item ini.');
      return;
    }

    setSaving(true);
    try {
      const nilaiReal = parseRp(realData.realisasi);
      const nilaiKontrak = parseRp(realData.nilaiKontrakKeseluruhan);
      const nilaiKomitmen = parseRp(komData.nilaiKomitmen);
      const referensi = nilaiKontrak > 0 ? nilaiKontrak : nilaiKomitmen;
      const progres = referensi > 0
        ? Math.min((nilaiReal / referensi) * 100, 100).toFixed(2)
        : '0';

      await updateDoc(doc(db, 'komitmen', docId), {
        realisasi: nilaiReal,
        realisasiDetail: [{
          tahunRealisasi: realData.tahunRealisasi,
          bulanRealisasi: realData.bulanRealisasi,
          realisasi: nilaiReal,
          nomorInvoice: realData.nomorInvoice,
          tanggalInvoice: realData.tanggalInvoice,
          namaPenyedia: realData.namaPenyedia,
          kualifikasiPenyedia: realData.kualifikasiPenyedia,
          namaPengadaanRealisasi: realData.namaPengadaanRealisasi,
          metodePemilihanRealisasi: realData.metodePemilihanRealisasi,
        }],
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

  // ── Handler checkbox (mutual exclusive) ──────────────────────────────────
  const handleCheckbox = (name) => {
    setKomData((p) => ({
      ...p,
      pdnCheckbox: name === 'pdnCheckbox' ? !p.pdnCheckbox : false,
      tkdnCheckbox: name === 'tkdnCheckbox' ? !p.tkdnCheckbox : false,
      importCheckbox: name === 'importCheckbox' ? !p.importCheckbox : false,
    }));
  };

  const setKom = (field, val) => setKomData((p) => ({ ...p, [field]: val }));
  const setReal = (field, val) => setRealData((p) => ({ ...p, [field]: val }));

  // ── Handler Batal ─────────────────────────────────────────────────────────
  const handleBatalClick = () => setShowConfirmCancel(true);

  const handleConfirmCancel = async () => {
    setShowConfirmCancel(false);
    if (onCancel) await onCancel();
    else onClose();
  };

  // Guard render
  if (!show || !current) return null;

  return (
    <>
      {/* Modal konfirmasi batal — muncul di atas wizard */}
      <ConfirmCancelModal
        show={showConfirmCancel}
        count={total}
        onConfirm={handleConfirmCancel}
        onDismiss={() => setShowConfirmCancel(false)}
      />

      <Modal show={show} onHide={() => { }} size="xl" backdrop="static" keyboard={false}>
        {/* ── Header ── */}
        <Modal.Header className="bg-primary text-white">
          <Modal.Title>
            Import Wizard — Item {idx + 1} / {total}
            <Badge bg="light" text="dark" className="ms-2">
              {step === 'komitmen' ? 'Step 1: Komitmen' : 'Step 2: Realisasi'}
            </Badge>
          </Modal.Title>
        </Modal.Header>

        {/* ── Body ── */}
        <Modal.Body style={{ maxHeight: '72vh', overflowY: 'auto' }}>
          <Alert variant="info" className="py-2">
            <strong>{current.namaPaket}</strong> — {current.namaAP}
            <Badge bg="secondary" className="ms-2">{current.idPaketMonitoring}</Badge>
          </Alert>

          {/* ── Step 1: Komitmen ── */}
          {step === 'komitmen' && (
            <Form>
              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Nama Paket <span className="text-danger">*</span></Form.Label>
                    <Form.Control value={komData.namaPaket || ''} onChange={(e) => setKom('namaPaket', e.target.value)} />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Nama AP <span className="text-danger">*</span></Form.Label>
                    <Form.Control value={komData.namaAP || ''} onChange={(e) => setKom('namaAP', e.target.value)} />
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>ID RUP</Form.Label>
                    <Form.Control value={komData.idRUP || ''} onChange={(e) => setKom('idRUP', e.target.value)} />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Jenis Paket</Form.Label>
                    <Form.Select value={komData.jenisPaket || ''} onChange={(e) => setKom('jenisPaket', e.target.value)}>
                      <option>Single Year (SY)</option>
                      <option>Multi Year (MY)</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Jenis Anggaran</Form.Label>
                    <Form.Select value={komData.jenisAnggaran || ''} onChange={(e) => setKom('jenisAnggaran', e.target.value)}>
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
                    <Form.Select value={komData.jenisPengadaan || ''} onChange={(e) => setKom('jenisPengadaan', e.target.value)}>
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
                    <Form.Select value={komData.usulanMetodePemilihan || ''} onChange={(e) => setKom('usulanMetodePemilihan', e.target.value)}>
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
                    <Form.Control
                      value={komData.nilaiKomitmen || ''}
                      onChange={(e) => setKom('nilaiKomitmen', fmtRp(e.target.value))}
                      placeholder="Rp"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Komitmen Keseluruhan</Form.Label>
                    <Form.Control
                      value={komData.komitmenKeseluruhan || ''}
                      onChange={(e) => setKom('komitmenKeseluruhan', fmtRp(e.target.value))}
                      placeholder="Rp"
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Waktu Pemanfaatan Dari</Form.Label>
                    <Form.Control
                      type="date"
                      value={komData.waktuPemanfaatanDari || ''}
                      onChange={(e) => setKom('waktuPemanfaatanDari', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Waktu Pemanfaatan Sampai</Form.Label>
                    <Form.Control
                      type="date"
                      value={komData.waktuPemanfaatanSampai || ''}
                      onChange={(e) => setKom('waktuPemanfaatanSampai', e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Jenis Keuangan</Form.Label>
                    <Form.Select
                      value={
                        komData.pdnCheckbox ? 'PDN'
                          : komData.tkdnCheckbox ? 'TKDN'
                            : komData.importCheckbox ? 'Import'
                              : ''
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        setKomData((p) => ({
                          ...p,
                          pdnCheckbox: val === 'PDN',
                          tkdnCheckbox: val === 'TKDN',
                          importCheckbox: val === 'Import',
                          // reset semua nilai jika ganti pilihan
                          nilaiTahunBerjalanPDN: val === 'PDN' ? p.nilaiTahunBerjalanPDN : '',
                          nilaiKeseluruhanPDN: val === 'PDN' ? p.nilaiKeseluruhanPDN : '',
                          nilaiTahunBerjalanTKDN: val === 'TKDN' ? p.nilaiTahunBerjalanTKDN : '',
                          nilaiKeseluruhanTKDN: val === 'TKDN' ? p.nilaiKeseluruhanTKDN : '',
                          nilaiTahunBerjalanImport: val === 'Import' ? p.nilaiTahunBerjalanImport : '',
                          nilaiKeseluruhanImport: val === 'Import' ? p.nilaiKeseluruhanImport : '',
                        }));
                      }}
                    >
                      <option value="">-- Tidak Ada --</option>
                      <option value="PDN">PDN</option>
                      <option value="TKDN">TKDN</option>
                      <option value="Import">Import</option>
                    </Form.Select>
                    <Form.Text className="text-muted">Pilih salah satu jenis keuangan</Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              {/* ── PDN Fields ── */}
              {komData.pdnCheckbox && (
                <>
                  <Row className="mb-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Nilai Tahun Berjalan PDN (Rp)</Form.Label>
                        <Form.Control
                          value={komData.nilaiTahunBerjalanPDN || ''}
                          onChange={(e) => setKom('nilaiTahunBerjalanPDN', fmtRp(e.target.value))}
                          placeholder="Masukkan nilai PDN tahun ini"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Nilai Keseluruhan PDN (Rp)</Form.Label>
                        <Form.Control
                          value={komData.nilaiKeseluruhanPDN || ''}
                          onChange={(e) => setKom('nilaiKeseluruhanPDN', fmtRp(e.target.value))}
                          placeholder="Masukkan nilai PDN keseluruhan"
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <Alert variant="success" className="py-2 mb-3">
                    <small><strong>PDN dipilih:</strong> Silakan isi kedua field nilai PDN di atas.</small>
                  </Alert>
                </>
              )}

              {/* ── TKDN Fields ── */}
              {komData.tkdnCheckbox && (
                <>
                  <Row className="mb-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Nilai Tahun Berjalan TKDN (Rp)</Form.Label>
                        <Form.Control
                          value={komData.nilaiTahunBerjalanTKDN || ''}
                          onChange={(e) => setKom('nilaiTahunBerjalanTKDN', fmtRp(e.target.value))}
                          placeholder="Masukkan nilai TKDN tahun ini"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Nilai Keseluruhan TKDN (Rp)</Form.Label>
                        <Form.Control
                          value={komData.nilaiKeseluruhanTKDN || ''}
                          onChange={(e) => setKom('nilaiKeseluruhanTKDN', fmtRp(e.target.value))}
                          placeholder="Masukkan nilai TKDN keseluruhan"
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <Alert variant="info" className="py-2 mb-3">
                    <small><strong>TKDN dipilih:</strong> Silakan isi kedua field nilai TKDN di atas.</small>
                  </Alert>
                </>
              )}

              {/* ── Import Fields ── */}
              {komData.importCheckbox && (
                <>
                  <Row className="mb-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Nilai Tahun Berjalan Import (Rp)</Form.Label>
                        <Form.Control
                          value={komData.nilaiTahunBerjalanImport || ''}
                          onChange={(e) => setKom('nilaiTahunBerjalanImport', fmtRp(e.target.value))}
                          placeholder="Masukkan nilai Import tahun ini"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Nilai Keseluruhan Import (Rp)</Form.Label>
                        <Form.Control
                          value={komData.nilaiKeseluruhanImport || ''}
                          onChange={(e) => setKom('nilaiKeseluruhanImport', fmtRp(e.target.value))}
                          placeholder="Masukkan nilai Import keseluruhan"
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <Alert variant="warning" className="py-2 mb-3">
                    <small><strong>Import dipilih:</strong> Silakan isi kedua field nilai Import di atas.</small>
                  </Alert>
                </>
              )}

              <Form.Group className="mb-3">
                <Form.Label>Catatan Komitmen</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={komData.catatanKomitmen || ''}
                  onChange={(e) => setKom('catatanKomitmen', e.target.value)}
                />
              </Form.Group>
            </Form>
          )}

          {/* ── Step 2: Realisasi ── */}
          {step === 'realisasi' && (
            <Form>
              <Alert variant="warning" className="py-2">
                <small>Isi data realisasi di bawah, atau klik <strong>Lewati</strong> untuk mengisi nanti via Edit.</small>
              </Alert>

              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Nama Penyedia <span className="text-danger">*</span></Form.Label>
                    <Form.Control value={realData.namaPenyedia} onChange={(e) => setReal('namaPenyedia', e.target.value)} />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Kualifikasi Penyedia</Form.Label>
                    <Form.Select value={realData.kualifikasiPenyedia} onChange={(e) => setReal('kualifikasiPenyedia', e.target.value)}>
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
                    <Form.Control value={realData.realisasi} onChange={(e) => setReal('realisasi', fmtRp(e.target.value))} placeholder="Rp" />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Nilai Kontrak Keseluruhan</Form.Label>
                    <Form.Control value={realData.nilaiKontrakKeseluruhan} onChange={(e) => setReal('nilaiKontrakKeseluruhan', fmtRp(e.target.value))} placeholder="Rp" />
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Bulan Realisasi <span className="text-danger">*</span></Form.Label>
                    <Form.Select value={realData.bulanRealisasi} onChange={(e) => setReal('bulanRealisasi', e.target.value)}>
                      <option value="">Pilih Bulan</option>
                      {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Tahun Realisasi</Form.Label>
                    <Form.Control value={realData.tahunRealisasi} onChange={(e) => setReal('tahunRealisasi', e.target.value)} />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Tanggal Invoice</Form.Label>
                    <Form.Control
                      type="date"
                      value={realData.tanggalInvoice}
                      onChange={(e) => {
                        const v = e.target.value;
                        const d = new Date(v);
                        setRealData((p) => ({
                          ...p,
                          tanggalInvoice: v,
                          tahunRealisasi: !isNaN(d) ? d.getFullYear().toString() : p.tahunRealisasi,
                          bulanRealisasi: !isNaN(d) ? (d.getMonth() + 1).toString() : p.bulanRealisasi,
                        }));
                      }}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Nomor Invoice <span className="text-danger">*</span></Form.Label>
                    <Form.Control value={realData.nomorInvoice} onChange={(e) => setReal('nomorInvoice', e.target.value)} />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Metode Pemilihan Realisasi</Form.Label>
                    <Form.Select value={realData.metodePemilihanRealisasi} onChange={(e) => setReal('metodePemilihanRealisasi', e.target.value)}>
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
                <Form.Control value={realData.namaPengadaanRealisasi} onChange={(e) => setReal('namaPengadaanRealisasi', e.target.value)} />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Keterangan</Form.Label>
                <Form.Control as="textarea" rows={2} value={realData.keterangan} onChange={(e) => setReal('keterangan', e.target.value)} />
              </Form.Group>
            </Form>
          )}
        </Modal.Body>

        {/* ── Footer ── */}
        <Modal.Footer className="justify-content-between">
          <Button variant="danger" onClick={handleBatalClick} disabled={saving}>
            Batal Import
          </Button>

          <div className="d-flex gap-2">
            <Button
              variant="outline-secondary"
              disabled={saving}
              onClick={() => {
                toast.info(`"${current.namaPaket}" dilewati. Bisa dilengkapi via Edit.`);
                goNext(idx + 1);
              }}
            >
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
    </>
  );
}
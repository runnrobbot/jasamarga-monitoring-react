import { Modal, Badge, Button, Card, Table, Row, Col } from 'react-bootstrap';
import { formatCurrency } from '../../utils/rupiahUtils';

const MONTHS = [
  { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' }, { value: 4, label: 'April' },
  { value: 5, label: 'Mei' }, { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' }, { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' }, { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' }, { value: 12, label: 'Desember' },
];

/**
 * Modal untuk melihat detail lengkap sebuah komitmen (read-only).
 * @param {Object} props
 * @param {boolean} props.show
 * @param {Function} props.onHide
 * @param {Object|null} props.komitmen
 */
const KomitmenDetailModal = ({ show, onHide, komitmen }) => {
  if (!komitmen) return null;

  return (
    <Modal show={show} onHide={onHide} size="xl" centered>
      <Modal.Header closeButton className="bg-primary text-white">
        <Modal.Title>Detail Komitmen</Modal.Title>
      </Modal.Header>

      <Modal.Body style={{ maxHeight: '80vh', overflowY: 'auto' }}>
        {/* SECTION 1: INFORMASI PAKET */}
        <Card className="mb-3 shadow-sm">
          <Card.Header className="bg-light">
            <h6 className="mb-0 fw-bold">Informasi Paket</h6>
          </Card.Header>
          <Card.Body>
            <Row className="mb-2">
              <Col md={6}>
                <strong>ID Paket Monitoring:</strong>
                <p className="text-primary font-monospace mb-0">{komitmen.idPaketMonitoring || '-'}</p>
              </Col>
              <Col md={6}>
                <strong>Jenis Paket:</strong>
                <p className="mb-0"><Badge bg="info">{komitmen.jenisPaket || '-'}</Badge></p>
              </Col>
            </Row>
            <Row className="mb-2">
              <Col md={6}>
                <strong>ID RUP:</strong>
                <p className="mb-0">{komitmen.idRUP || '-'}</p>
              </Col>
              <Col md={6}>
                <strong>Nama AP:</strong>
                <p className="mb-0">{komitmen.namaAP || '-'}</p>
              </Col>
            </Row>
            <Row className="mb-2">
              <Col md={12}>
                <strong>Nama Paket:</strong>
                <p className="text-dark fw-bold mb-0">{komitmen.namaPaket}</p>
              </Col>
            </Row>
            <Row className="mb-2">
              <Col md={4}>
                <strong>Jenis Anggaran:</strong>
                <p className="mb-0">
                  <Badge bg={komitmen.jenisAnggaran === 'Opex' ? 'success' : 'warning'}>
                    {komitmen.jenisAnggaran || '-'}
                  </Badge>
                </p>
              </Col>
              <Col md={4}>
                <strong>Jenis Pengadaan:</strong>
                <p className="mb-0">{komitmen.jenisPengadaan || '-'}</p>
              </Col>
              <Col md={4}>
                <strong>Status PaDi:</strong>
                <p className="mb-0">
                  <Badge bg={komitmen.statusPadi === 'PaDi' ? 'primary' : 'secondary'}>
                    {komitmen.statusPadi || '-'}
                  </Badge>
                </p>
              </Col>
            </Row>
            <Row className="mb-2">
              <Col md={12}>
                <strong>Metode Pemilihan:</strong>
                <p className="mb-0">{komitmen.usulanMetodePemilihan || '-'}</p>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* SECTION 2: NILAI KOMITMEN */}
        <Card className="mb-3 shadow-sm">
          <Card.Header className="bg-light">
            <h6 className="mb-0 fw-bold">Nilai Komitmen</h6>
          </Card.Header>
          <Card.Body>
            <Row className="mb-2">
              <Col md={6}>
                <strong>Komitmen Tahun Berjalan:</strong>
                <p className="text-primary fw-bold fs-5 mb-0">{formatCurrency(komitmen.nilaiKomitmen)}</p>
              </Col>
              <Col md={6}>
                <strong>Komitmen Keseluruhan:</strong>
                <p className="text-success fw-bold fs-5 mb-0">{formatCurrency(komitmen.komitmenKeseluruhan)}</p>
              </Col>
            </Row>
            <Row className="mb-2">
              <Col md={6}>
                <strong>Waktu Pemanfaatan Dari:</strong>
                <p className="mb-0">{komitmen.waktuPemanfaatanDari || '-'}</p>
              </Col>
              <Col md={6}>
                <strong>Waktu Pemanfaatan Sampai:</strong>
                <p className="mb-0">{komitmen.waktuPemanfaatanSampai || '-'}</p>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* SECTION 3: RENCANA REALISASI */}
        {komitmen.rencanaDetail && komitmen.rencanaDetail.length > 0 && (
          <Card className="mb-3 shadow-sm">
            <Card.Header className="bg-light">
              <h6 className="mb-0 fw-bold">Rencana Realisasi</h6>
            </Card.Header>
            <Card.Body>
              <Table striped bordered hover size="sm">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 50 }}>#</th>
                    {komitmen.jenisPaket === 'Multi Year (MY)' && <th>Tahun</th>}
                    <th>Nilai Rencana</th>
                    <th>Bulan</th>
                    <th>Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {komitmen.rencanaDetail.map((detail, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      {komitmen.jenisPaket === 'Multi Year (MY)' && (
                        <td><Badge bg="info">{detail.tahunRencana}</Badge></td>
                      )}
                      <td className="text-end">{formatCurrency(detail.nilaiRencana)}</td>
                      <td>{MONTHS.find(m => m.value === parseInt(detail.bulanRencana))?.label || '-'}</td>
                      <td>{detail.keterangan || '-'}</td>
                    </tr>
                  ))}
                  <tr className="table-success fw-bold">
                    <td colSpan={komitmen.jenisPaket === 'Multi Year (MY)' ? 2 : 1}>TOTAL RENCANA</td>
                    <td className="text-end">
                      {formatCurrency(komitmen.rencanaDetail.reduce((s, d) => s + (d.nilaiRencana || 0), 0))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        )}

        {/* SECTION 4: INFORMASI KEUANGAN (PDN/TKDN/Import) */}
        <Card className="mb-3 shadow-sm">
          <Card.Header className="bg-light">
            <h6 className="mb-0 fw-bold">Informasi Keuangan</h6>
          </Card.Header>
          <Card.Body>
            <Row className="mb-2">
              {[
                { key: 'pdn', label: 'PDN', checked: komitmen.pdnCheckbox, tahun: komitmen.nilaiTahunBerjalanPDN, keseluruhan: komitmen.nilaiKeseluruhanPDN },
                { key: 'tkdn', label: 'TKDN', checked: komitmen.tkdnCheckbox, tahun: komitmen.nilaiTahunBerjalanTKDN, keseluruhan: komitmen.nilaiKeseluruhanTKDN },
                { key: 'import', label: 'Import', checked: komitmen.importCheckbox, tahun: komitmen.nilaiTahunBerjalanImport, keseluruhan: komitmen.nilaiKeseluruhanImport },
              ].map(({ key, label, checked, tahun, keseluruhan }) => (
                <Col md={4} key={key}>
                  <strong>{label}:</strong>
                  <p className="mb-1">
                    <Badge bg={checked ? 'success' : 'secondary'}>{checked ? 'TRUE' : 'FALSE'}</Badge>
                  </p>
                  {checked && (
                    <div className="ms-3">
                      <small className="text-muted">Tahun Berjalan:</small>
                      <p className="mb-1">{formatCurrency(tahun || 0)}</p>
                      <small className="text-muted">Keseluruhan:</small>
                      <p className="mb-0">{formatCurrency(keseluruhan || 0)}</p>
                    </div>
                  )}
                </Col>
              ))}
            </Row>
            {komitmen.targetNilaiTKDN > 0 && (
              <Row className="mt-2">
                <Col><strong>Target Nilai TKDN:</strong><p className="mb-0">{formatCurrency(komitmen.targetNilaiTKDN)}</p></Col>
              </Row>
            )}
            {komitmen.nilaiAnggaranBelanja > 0 && (
              <Row className="mt-2">
                <Col><strong>Nilai Anggaran Belanja:</strong><p className="mb-0">{formatCurrency(komitmen.nilaiAnggaranBelanja)}</p></Col>
              </Row>
            )}
            {komitmen.catatanKomitmen && (
              <Row className="mt-2">
                <Col><strong>Catatan Komitmen:</strong><p className="text-muted mb-0">{komitmen.catatanKomitmen}</p></Col>
              </Row>
            )}
          </Card.Body>
        </Card>

        {/* SECTION 5: REALISASI */}
        <Card className="mb-3 shadow-sm">
          <Card.Header className="bg-light">
            <h6 className="mb-0 fw-bold">Informasi Realisasi</h6>
          </Card.Header>
          <Card.Body>
            <Row className="mb-3">
              <Col md={3}>
                <strong>Nilai Kontrak:</strong>
                <p className="text-info fw-bold fs-5 mb-0">{formatCurrency(komitmen.nilaiKontrakKeseluruhan)}</p>
              </Col>
              <Col md={3}>
                <strong>Realisasi:</strong>
                <p className="text-success fw-bold fs-5 mb-0">{formatCurrency(komitmen.realisasi)}</p>
              </Col>
              <Col md={3}>
                <strong>Sisa:</strong>
                <p className="text-warning fw-bold fs-5 mb-0">
                  {formatCurrency((komitmen.nilaiKontrakKeseluruhan || 0) - (komitmen.realisasi || 0))}
                </p>
              </Col>
              <Col md={3}>
                <strong>Progress:</strong>
                <p className="mb-0"><Badge bg="primary" className="fs-6">{komitmen.progres || '0'}%</Badge></p>
              </Col>
            </Row>
            {komitmen.namaPenyedia && (
              <Row className="mb-2">
                <Col md={6}>
                  <strong>Nama Penyedia:</strong>
                  <p className="mb-0">{komitmen.namaPenyedia}</p>
                </Col>
                <Col md={6}>
                  <strong>Kualifikasi:</strong>
                  <p className="mb-0">
                    <Badge bg={komitmen.kualifikasiPenyedia === 'UMKM' ? 'success' : 'info'}>
                      {komitmen.kualifikasiPenyedia || '-'}
                    </Badge>
                  </p>
                </Col>
              </Row>
            )}
            <Row className="mb-2">
              <Col md={4}><strong>Nilai PDN:</strong><p className="mb-0">{formatCurrency(komitmen.nilaiPDN || 0)}</p></Col>
              <Col md={4}><strong>Nilai TKDN:</strong><p className="mb-0">{formatCurrency(komitmen.nilaiKeseluruhanTKDN || komitmen.nilaiTKDN || 0)}</p></Col>
              <Col md={4}><strong>Nilai Import:</strong><p className="mb-0">{formatCurrency(komitmen.nilaiImpor || 0)}</p></Col>
            </Row>
          </Card.Body>
        </Card>

        {/* SECTION 6: DETAIL REALISASI PER PERIODE */}
        {komitmen.realisasiDetail && komitmen.realisasiDetail.length > 0 && (
          <Card className="mb-3 shadow-sm">
            <Card.Header className="bg-light">
              <h6 className="mb-0 fw-bold">Detail Realisasi per Periode</h6>
            </Card.Header>
            <Card.Body>
              <Table striped bordered hover size="sm">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 50 }}>#</th>
                    <th>Bulan</th>
                    <th>Nilai Realisasi</th>
                    <th>No. Invoice</th>
                    <th>Tgl Invoice</th>
                    <th>Penyedia</th>
                    <th>Kualifikasi</th>
                  </tr>
                </thead>
                <tbody>
                  {komitmen.realisasiDetail.map((detail, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>{MONTHS.find(m => m.value === parseInt(detail.bulanRealisasi))?.label || '-'}</td>
                      <td className="text-end">{formatCurrency(detail.realisasi)}</td>
                      <td>{detail.nomorInvoice || '-'}</td>
                      <td>{detail.tanggalInvoice || '-'}</td>
                      <td>
                        {detail.namaPenyedia || komitmen.namaPenyedia || '-'}
                        {detail.namaPengadaanRealisasi && (
                          <><br /><small className="text-muted">{detail.namaPengadaanRealisasi}</small></>
                        )}
                      </td>
                      <td>
                        <Badge bg={detail.kualifikasiPenyedia === 'UMKM' ? 'success' : 'info'}>
                          {detail.kualifikasiPenyedia || komitmen.kualifikasiPenyedia || '-'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  <tr className="table-success fw-bold">
                    <td colSpan={2}>TOTAL REALISASI</td>
                    <td className="text-end">
                      {formatCurrency(komitmen.realisasiDetail.reduce((s, d) => s + (d.realisasi || 0), 0))}
                    </td>
                    <td colSpan={4} />
                  </tr>
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        )}

        {/* SECTION 7: KETERANGAN */}
        {komitmen.keterangan && (
          <Card className="mb-3 shadow-sm">
            <Card.Header className="bg-light">
              <h6 className="mb-0 fw-bold">📝 Keterangan</h6>
            </Card.Header>
            <Card.Body>
              <p className="mb-0">{komitmen.keterangan}</p>
            </Card.Body>
          </Card>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Tutup</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default KomitmenDetailModal;

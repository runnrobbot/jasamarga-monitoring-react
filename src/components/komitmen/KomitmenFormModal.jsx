import { Modal, Form, Button, Badge, Alert, Row, Col, Tabs, Tab, Spinner } from 'react-bootstrap';
import { FaPlus, FaTimes, FaEdit } from 'react-icons/fa';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { id } from 'date-fns/locale';
import { formatRupiahInput, parseRupiahInput } from '../../utils/rupiahUtils';

const MONTHS = [
  { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' }, { value: 4, label: 'April' },
  { value: 5, label: 'Mei' }, { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' }, { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' }, { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' }, { value: 12, label: 'Desember' },
];

/**
 * KomitmenFormModal - shared modal form untuk Admin dan PIC.
 *
 * Props:
 *  show, onHide, editMode, isAddingNewRealisasi, loading,
 *  formData, setFormData,
 *  realisasiRows, rencanaRows,
 *  masterAPList, role ('admin' | 'pic'),
 *  handlers: handleSubmit, handleFormChange, handleRupiahChange,
 *    handleRealisasiChange, handleRealisasiRupiahChange,
 *    addRealisasiRow, removeRealisasiRow,
 *    handleRencanaChange, handleRencanaRupiahChange, addRencanaRow, removeRencanaRow,
 *    handleNewRealisasi, handleCancelNewRealisasi,
 *  selectedKomitmen (untuk context isAddingNewRealisasi)
 */
const KomitmenFormModal = ({
  show,
  onHide,
  editMode,
  isAddingNewRealisasi,
  loading,
  formData,
  setFormData,
  realisasiRows,
  rencanaRows,
  masterAPList = [],
  role = 'admin',
  createdByName = '',
  handleSubmit,
  handleFormChange,
  handleRupiahChange,
  handleRealisasiChange,
  handleRealisasiRupiahChange,
  addRealisasiRow,
  removeRealisasiRow,
  handleRencanaChange,
  handleRencanaRupiahChange,
  addRencanaRow,
  removeRencanaRow,
  handleNewRealisasi,
  handleCancelNewRealisasi,
  selectedKomitmen,
}) => {
  // Realisasi hanya bisa diedit oleh admin (selalu), atau PIC hanya setelah status 'approved'
  const isApprovedByAdmin = selectedKomitmen?.approvalStatus === 'approved';
  // Tab Komitmen di-lock untuk PIC ketika komitmen sudah di-approve admin
  // (tab Realisasi sudah terbuka, sehingga data komitmen tidak boleh diubah lagi).
  // Untuk status rejected/draft/pending, PIC tetap bisa edit komitmen seperti biasa.
  const isKomitmenDisabled = role === 'pic' && isApprovedByAdmin;
  const isRealisasiEditable =
    role === 'admin' ||
    (role === 'admin' && isAddingNewRealisasi) ||
    (role === 'pic' && isApprovedByAdmin && (isAddingNewRealisasi || editMode));

  const shouldShowPDNFields = () => formData.pdnCheckbox === true;
  const shouldShowTKDNFields = () => formData.tkdnCheckbox === true;
  const shouldShowImportFields = () => formData.importCheckbox === true;

  // Summary calculations
  const calculateSummaryPerPeriode = () => {
    const currentYear = new Date().getFullYear().toString();
    const isMY = formData.jenisPaket === 'Multi Year (MY)';
    let rowsForPeriode;
    if (isAddingNewRealisasi) {
      rowsForPeriode = realisasiRows;
    } else if (isMY) {
      const filtered = realisasiRows.filter(row => {
        if (row.tahunRealisasi) return row.tahunRealisasi.toString() === currentYear;
        if (row.tanggalInvoice) return new Date(row.tanggalInvoice).getFullYear().toString() === currentYear;
        return true;
      });
      rowsForPeriode = filtered;
    } else {
      rowsForPeriode = realisasiRows;
    }
    const totalRealisasiPeriode = rowsForPeriode.reduce((sum, row) => sum + parseRupiahInput(row.realisasi), 0);
    const nilaiKomitmenTahunIni = parseRupiahInput(formData.nilaiKomitmen);
    const progressRaw = nilaiKomitmenTahunIni > 0
      ? ((totalRealisasiPeriode / nilaiKomitmenTahunIni) * 100).toFixed(2)
      : '0';
    const progress = Math.min(parseFloat(progressRaw), 100).toFixed(2);
    const sisa = nilaiKomitmenTahunIni - totalRealisasiPeriode;
    return { progress, sisa: formatRupiahInput(sisa.toString()), total: formatRupiahInput(totalRealisasiPeriode.toString()) };
  };

  const calculateSummaryKeseluruhan = () => {
    const totalRealisasiPeriode = realisasiRows.reduce((sum, row) => sum + parseRupiahInput(row.realisasi), 0);
    let totalRealisasiKeseluruhan = totalRealisasiPeriode;
    if (isAddingNewRealisasi && editMode && selectedKomitmen) {
      totalRealisasiKeseluruhan = (selectedKomitmen.realisasi || 0) + totalRealisasiPeriode;
    }
    const isMY = formData.jenisPaket === 'Multi Year (MY)';
    const nilaiKontrakValue = parseRupiahInput(formData.nilaiKontrakKeseluruhan);
    const nilaiKomitmenTahunIni = parseRupiahInput(formData.nilaiKomitmen);
    const nilaiKomitmenKeseluruhan = parseRupiahInput(formData.komitmenKeseluruhan);
    let nilaiReferensiKeseluruhan = 0;
    if (isMY) {
      nilaiReferensiKeseluruhan = nilaiKontrakValue > 0 ? nilaiKontrakValue : nilaiKomitmenKeseluruhan;
    } else {
      nilaiReferensiKeseluruhan = nilaiKontrakValue > 0 ? nilaiKontrakValue : nilaiKomitmenTahunIni;
    }
    const progress = nilaiReferensiKeseluruhan > 0
      ? ((totalRealisasiKeseluruhan / nilaiReferensiKeseluruhan) * 100).toFixed(2)
      : '0';
    const sisa = nilaiReferensiKeseluruhan - totalRealisasiKeseluruhan;
    return { progress, sisa: formatRupiahInput(sisa.toString()), total: formatRupiahInput(totalRealisasiKeseluruhan.toString()) };
  };

  // Helpers for summary alert
  const totalRencana = rencanaRows.reduce((sum, row) => sum + parseRupiahInput(row.nilaiRencana), 0);
  const refKomitmen = parseRupiahInput(formData.komitmenKeseluruhan) > 0
    ? parseRupiahInput(formData.komitmenKeseluruhan)
    : parseRupiahInput(formData.nilaiKomitmen);
  const rencanaOverLimit = refKomitmen > 0 && totalRencana > refKomitmen;
  const rencanaAtLimit = refKomitmen > 0 && totalRencana >= refKomitmen;

  return (
    <Modal show={show} onHide={onHide} size="xl" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {editMode ? 'Edit Komitmen' : 'Tambah Komitmen'}
          {editMode && <Badge bg="warning" className="ms-2 text-dark">Edit Mode</Badge>}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body style= maxHeight: '70vh', overflowY: 'auto' >
        <Form onSubmit={handleSubmit}>
          <Tabs activeKey={role === 'pic' && !isApprovedByAdmin ? 'komitmen' : undefined} defaultActiveKey="komitmen" className="mb-3" onSelect={(k) => { if (role === 'pic' && !isApprovedByAdmin && k === 'realisasi') return; }}>

            {/* TAB KOMITMEN */}
            <Tab eventKey="komitmen" title="Komitmen Awal / Informasi Dasar">
              {editMode && (
                <Alert variant="info" className="mb-3">
                  <strong>Mode Edit:</strong> Anda sedang mengedit data komitmen existing
                </Alert>
              )}

              <h6 className="fw-bold mb-3 mt-3">Informasi Paket</h6>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>ID Paket Monitoring</Form.Label>
                    <Form.Control
                      type="text"
                      name="idPaketMonitoring"
                      value={formData.idPaketMonitoring}
                      onChange={handleFormChange}
                      placeholder="Auto-generate (SY.2025.XXX.12345)"
                      disabled
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Jenis Paket <span className="text-danger">*</span></Form.Label>
                    <Form.Select
                      name="jenisPaket"
                      value={formData.jenisPaket}
                      onChange={handleFormChange}
                      required
                      disabled={isKomitmenDisabled}
                      className={isKomitmenDisabled ? 'bg-light' : ''}
                    >
                      <option value="Single Year (SY)">Single Year (SY)</option>
                      <option value="Multi Year (MY)">Multi Year (MY)</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              {/* Nama Pembuat - auto-filled dari akun login */}
              {createdByName && (
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Nama Pembuat</Form.Label>
                      <Form.Control
                        type="text"
                        value={createdByName}
                        disabled
                        className="bg-light"
                      />
                      <Form.Text className="text-muted">Otomatis dari akun yang login</Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
              )}

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>ID RUP</Form.Label>
                    <Form.Control
                      type="text"
                      name="idRUP"
                      value={formData.idRUP}
                      onChange={handleFormChange}
                      placeholder="opsional"
                      disabled={isKomitmenDisabled}
                      className={isKomitmenDisabled ? 'bg-light' : ''}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Nama AP <span className="text-danger">*</span></Form.Label>
                    {role === 'pic' ? (
                      <Form.Control
                        type="text"
                        value={formData.namaAP}
                        disabled
                        className="bg-light"
                      />
                    ) : (
                      <Form.Select
                        name="namaAP"
                        value={formData.namaAP}
                        onChange={handleFormChange}
                        required
                        disabled={isKomitmenDisabled}
                        className={isKomitmenDisabled ? 'bg-light' : ''}
                      >
                        <option value="">-- Pilih Area Pengelola --</option>
                        {masterAPList.map(ap => (
                          <option key={ap.id} value={ap.namaAP}>{ap.namaAP}</option>
                        ))}
                      </Form.Select>
                    )}
                    <Form.Text className="text-muted">Pilih Area Pengelola untuk komitmen ini</Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label>Nama Paket <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="text"
                  name="namaPaket"
                  value={formData.namaPaket}
                  onChange={handleFormChange}
                  required
                  disabled={isKomitmenDisabled}
                  className={isKomitmenDisabled ? 'bg-light' : ''}
                />
              </Form.Group>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Jenis Anggaran <span className="text-danger">*</span></Form.Label>
                    <Form.Select
                      name="jenisAnggaran"
                      value={formData.jenisAnggaran}
                      onChange={handleFormChange}
                      required
                      disabled={isKomitmenDisabled}
                      className={isKomitmenDisabled ? 'bg-light' : ''}
                    >
                      <option value="Opex">Opex</option>
                      <option value="Capex">Capex</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Jenis Pengadaan <span className="text-danger">*</span></Form.Label>
                    <Form.Select
                      name="jenisPengadaan"
                      value={formData.jenisPengadaan}
                      onChange={handleFormChange}
                      required
                      disabled={isKomitmenDisabled}
                      className={isKomitmenDisabled ? 'bg-light' : ''}
                    >
                      <option value="Barang">Barang</option>
                      <option value="Jasa Konsultansi">Jasa Konsultansi</option>
                      <option value="Jasa Lainnya">Jasa Lainnya</option>
                      <option value="Pekerjaan Konstruksi">Pekerjaan Konstruksi</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Usulan Metode Pemilihan <span className="text-danger">*</span></Form.Label>
                    <Form.Select
                      name="usulanMetodePemilihan"
                      value={formData.usulanMetodePemilihan}
                      onChange={(e) => {
                        handleFormChange(e);
                        if (e.target.value !== 'Pengadaan Langsung') {
                          setFormData(prev => ({ ...prev, statusPadi: 'Non PaDi' }));
                        }
                      }}
                      required
                      disabled={isKomitmenDisabled}
                      className={isKomitmenDisabled ? 'bg-light' : ''}
                    >
                      <option value="Tender/Seleksi Umum">Tender/Seleksi Umum</option>
                      <option value="Tender/Seleksi Terbatas">Tender/Seleksi Terbatas</option>
                      <option value="Penunjukan Langsung">Penunjukan Langsung</option>
                      <option value="Pengadaan Langsung">Pengadaan Langsung</option>
                      <option value="Penetapan Langsung">Penetapan Langsung</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Status PaDi</Form.Label>
                    <Form.Select
                      name="statusPadi"
                      value={formData.statusPadi}
                      onChange={handleFormChange}
                      disabled={formData.usulanMetodePemilihan !== 'Pengadaan Langsung' || isKomitmenDisabled}
                      className={formData.usulanMetodePemilihan !== 'Pengadaan Langsung' || isKomitmenDisabled ? 'bg-light' : ''}
                    >
                      <option value="Non PaDi">Non PaDi</option>
                      <option value="PaDi">PaDi</option>
                    </Form.Select>
                    <Form.Text className="text-muted">
                      {formData.usulanMetodePemilihan === 'Pengadaan Langsung'
                        ? 'Pilih PaDi atau Non PaDi'
                        : 'Otomatis Non PaDi untuk metode ini'}
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Komitmen Tahun Berjalan (Rp) <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      type="text"
                      name="nilaiKomitmen"
                      value={formData.nilaiKomitmen}
                      onChange={(e) => handleRupiahChange(e, 'nilaiKomitmen')}
                      required
                      disabled={isKomitmenDisabled}
                      className={isKomitmenDisabled ? 'bg-light' : ''}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>
                      Komitmen Keseluruhan (Rp)
                      {formData.jenisPaket === 'Multi Year (MY)' && <span className="text-danger">*</span>}
                    </Form.Label>
                    <Form.Control
                      type="text"
                      name="komitmenKeseluruhan"
                      value={formData.komitmenKeseluruhan}
                      onChange={(e) => handleRupiahChange(e, 'komitmenKeseluruhan')}
                      disabled={isKomitmenDisabled}
                      className={isKomitmenDisabled ? 'bg-light' : ''}
                    />
                    <Form.Text className="text-danger">
                      {formData.jenisPaket === 'Multi Year (MY)' ? 'Wajib diisi untuk Multi Year' : 'Wajib diisi untuk Single Year'}
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Waktu Pemanfaatan Dari</Form.Label>
                    <DatePicker
                      selected={formData.waktuPemanfaatanDari ? new Date(formData.waktuPemanfaatanDari) : null}
                      onChange={(date) => {
                        const formatted = date ? date.toISOString().split('T')[0] : '';
                        setFormData(prev => ({ ...prev, waktuPemanfaatanDari: formatted }));
                      }}
                      dateFormat="dd/MM/yyyy"
                      locale={id}
                      placeholderText="dd/mm/yyyy"
                      className="form-control"
                      wrapperClassName="w-100"
                      required
                      showMonthDropdown showYearDropdown dropdownMode="select"
                      yearDropdownItemNumber={10} scrollableYearDropdown
                      popperProps= strategy: 'fixed' 
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Waktu Pemanfaatan Sampai</Form.Label>
                    <DatePicker
                      selected={formData.waktuPemanfaatanSampai ? new Date(formData.waktuPemanfaatanSampai) : null}
                      onChange={(date) => {
                        const formatted = date ? date.toISOString().split('T')[0] : '';
                        setFormData(prev => ({ ...prev, waktuPemanfaatanSampai: formatted }));
                      }}
                      dateFormat="dd/MM/yyyy"
                      locale={id}
                      placeholderText="dd/mm/yyyy"
                      className="form-control"
                      wrapperClassName="w-100"
                      required
                      showMonthDropdown showYearDropdown dropdownMode="select"
                      yearDropdownItemNumber={10} scrollableYearDropdown
                      popperProps= strategy: 'fixed' 
                    />
                  </Form.Group>
                </Col>
              </Row>

              {/* Rencana Realisasi */}
              <hr className="my-4" />
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold mb-0">Rencana Realisasi</h6>
                <Button
                  variant="primary" size="sm"
                  onClick={addRencanaRow}
                  disabled={isKomitmenDisabled || rencanaAtLimit}
                  title={rencanaAtLimit ? 'Total Rencana sudah mencapai Komitmen Keseluruhan' : 'Tambah Rencana Realisasi'}
                >
                  <FaPlus className="me-1" /> Tambah Rencana
                </Button>
              </div>

              {rencanaAtLimit && (
                <Alert variant="success" className="mb-3">
                  <strong>Total Rencana sudah sesuai dengan Komitmen Keseluruhan</strong><br />
                  <small>Anda tidak dapat menambah rencana lagi.</small>
                </Alert>
              )}
              {formData.jenisPaket === 'Multi Year (MY)' && (
                <Alert variant="info" className="mb-3">
                  <small><strong>Multi Year:</strong> Silakan isi tahun rencana untuk setiap periode</small>
                </Alert>
              )}

              {/* Header baris rencana */}
              <Row className="mb-2 bg-light py-2 border rounded">
                {formData.jenisPaket === 'Multi Year (MY)' && (
                  <Col md={2}><Form.Label className="fw-bold small mb-0">Tahun</Form.Label></Col>
                )}
                <Col md={formData.jenisPaket === 'Multi Year (MY)' ? 3 : 4}>
                  <Form.Label className="fw-bold small mb-0">Nilai Rencana (Rp)</Form.Label>
                </Col>
                <Col md={formData.jenisPaket === 'Multi Year (MY)' ? 3 : 4}>
                  <Form.Label className="fw-bold small mb-0">Bulan Rencana</Form.Label>
                </Col>
                <Col md={formData.jenisPaket === 'Multi Year (MY)' ? 3 : 3}>
                  <Form.Label className="fw-bold small mb-0">Keterangan</Form.Label>
                </Col>
                <Col md={1} className="text-center">
                  <Form.Label className="fw-bold small mb-0">Aksi</Form.Label>
                </Col>
              </Row>

              {rencanaRows.map((row, index) => (
                <Row key={row.id} className="mb-2 align-items-center border-bottom pb-2">
                  {formData.jenisPaket === 'Multi Year (MY)' && (
                    <Col md={2}>
                      <Form.Control
                        type="number"
                        value={row.tahunRencana}
                        onChange={(e) => handleRencanaChange(index, 'tahunRencana', e.target.value)}
                        placeholder="2025" min="2024" max="2030"
                        disabled={isKomitmenDisabled}
                        className={isKomitmenDisabled ? 'bg-light' : ''}
                        size="sm"
                      />
                    </Col>
                  )}
                  <Col md={formData.jenisPaket === 'Multi Year (MY)' ? 3 : 4}>
                    <Form.Control
                      type="text" value={row.nilaiRencana}
                      onChange={(e) => handleRencanaRupiahChange(index, e.target.value)}
                      placeholder="0"
                      disabled={isKomitmenDisabled}
                      className={isKomitmenDisabled ? 'bg-light' : ''}
                      size="sm"
                    />
                  </Col>
                  <Col md={formData.jenisPaket === 'Multi Year (MY)' ? 3 : 4}>
                    <Form.Select
                      value={row.bulanRencana}
                      onChange={(e) => handleRencanaChange(index, 'bulanRencana', e.target.value)}
                      disabled={isKomitmenDisabled}
                      className={isKomitmenDisabled ? 'bg-light' : ''}
                      size="sm"
                    >
                      <option value="">Pilih Bulan</option>
                      {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </Form.Select>
                  </Col>
                  <Col md={formData.jenisPaket === 'Multi Year (MY)' ? 3 : 3}>
                    <Form.Control
                      type="text" value={row.keterangan}
                      onChange={(e) => handleRencanaChange(index, 'keterangan', e.target.value)}
                      placeholder="Catatan..."
                      disabled={isKomitmenDisabled}
                      className={isKomitmenDisabled ? 'bg-light' : ''}
                      size="sm"
                    />
                  </Col>
                  <Col md={1} className="text-center">
                    {rencanaRows.length > 1 && (
                      <Button variant="danger" size="sm" onClick={() => removeRencanaRow(index)} disabled={isKomitmenDisabled}>
                        <FaTimes />
                      </Button>
                    )}
                  </Col>
                </Row>
              ))}

              {/* Summary total rencana */}
              <Row className="mt-3">
                <Col md={12}>
                  <Alert variant={rencanaOverLimit ? 'danger' : 'success'} className="mb-0">
                    <strong>Total Rencana Realisasi:</strong> {formatRupiahInput(totalRencana.toString())}
                    {rencanaOverLimit && (
                      <span className="ms-2 fw-bold">
                        Melebihi {parseRupiahInput(formData.komitmenKeseluruhan) > 0 ? 'Komitmen Keseluruhan' : 'Komitmen Tahun Berjalan'} sebesar {formatRupiahInput((totalRencana - refKomitmen).toString())}! Data tidak dapat disimpan.
                      </span>
                    )}
                  </Alert>
                </Col>
              </Row>

              {/* Informasi Keuangan */}
              <hr />
              <h5 className="mb-3">Informasi Penggunaan Produk</h5>
              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Penggunaan Produk</Form.Label>
                    <Form.Select
                      value={
                        formData.pdnCheckbox ? 'PDN'
                          : formData.tkdnCheckbox ? 'TKDN'
                            : formData.importCheckbox ? 'Import'
                              : ''
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          pdnCheckbox: val === 'PDN',
                          tkdnCheckbox: val === 'TKDN',
                          importCheckbox: val === 'Import',
                        }));
                      }}
                      disabled={isKomitmenDisabled}
                    >
                      <option value="">-- Tidak Ada --</option>
                      <option value="PDN">PDN</option>
                      <option value="TKDN">TKDN</option>
                      <option value="Import">Import</option>
                    </Form.Select>
                    <Form.Text className="text-muted">Pilih salah satu penggunaan produk</Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              {/* PDN Fields */}
              {shouldShowPDNFields() && (
                <>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Nilai Tahun Berjalan PDN (Rp) <span className="text-danger">*</span></Form.Label>
                        <Form.Control type="text" name="nilaiTahunBerjalanPDN" value={formData.nilaiTahunBerjalanPDN}
                          onChange={(e) => handleRupiahChange(e, 'nilaiTahunBerjalanPDN')} required
                          disabled={isKomitmenDisabled} className={isKomitmenDisabled ? 'bg-light' : ''}
                          placeholder="Masukkan nilai PDN untuk tahun ini" />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Nilai Keseluruhan PDN (Rp) <span className="text-danger">*</span></Form.Label>
                        <Form.Control type="text" name="nilaiKeseluruhanPDN" value={formData.nilaiKeseluruhanPDN}
                          onChange={(e) => handleRupiahChange(e, 'nilaiKeseluruhanPDN')} required
                          disabled={isKomitmenDisabled} className={isKomitmenDisabled ? 'bg-light' : ''}
                          placeholder="Masukkan nilai PDN keseluruhan" />
                      </Form.Group>
                    </Col>
                  </Row>
                  <Alert variant="success" className="mb-3">
                    <small><strong>PDN dipilih:</strong> Silakan isi kedua field nilai PDN di atas.</small>
                  </Alert>
                </>
              )}

              {/* TKDN Fields */}
              {shouldShowTKDNFields() && (
                <>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Nilai Tahun Berjalan TKDN (Rp) <span className="text-danger">*</span></Form.Label>
                        <Form.Control type="text" name="nilaiTahunBerjalanTKDN" value={formData.nilaiTahunBerjalanTKDN}
                          onChange={(e) => handleRupiahChange(e, 'nilaiTahunBerjalanTKDN')} required
                          disabled={isKomitmenDisabled} className={isKomitmenDisabled ? 'bg-light' : ''}
                          placeholder="Masukkan nilai TKDN untuk tahun ini" />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Nilai Keseluruhan TKDN (Rp) <span className="text-danger">*</span></Form.Label>
                        <Form.Control type="text" name="nilaiKeseluruhanTKDN" value={formData.nilaiKeseluruhanTKDN}
                          onChange={(e) => handleRupiahChange(e, 'nilaiKeseluruhanTKDN')} required
                          disabled={isKomitmenDisabled} className={isKomitmenDisabled ? 'bg-light' : ''}
                          placeholder="Masukkan nilai TKDN keseluruhan" />
                      </Form.Group>
                    </Col>
                  </Row>
                  <Alert variant="info" className="mb-3">
                    <small><strong>TKDN dipilih:</strong> Silakan isi kedua field nilai TKDN di atas.</small>
                  </Alert>
                </>
              )}

              {/* Import Fields */}
              {shouldShowImportFields() && (
                <>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Nilai Tahun Berjalan Import (Rp) <span className="text-danger">*</span></Form.Label>
                        <Form.Control type="text" name="nilaiTahunBerjalanImport" value={formData.nilaiTahunBerjalanImport}
                          onChange={(e) => handleRupiahChange(e, 'nilaiTahunBerjalanImport')} required
                          disabled={isKomitmenDisabled} className={isKomitmenDisabled ? 'bg-light' : ''}
                          placeholder="Masukkan nilai Import untuk tahun ini" />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Nilai Keseluruhan Import (Rp) <span className="text-danger">*</span></Form.Label>
                        <Form.Control type="text" name="nilaiKeseluruhanImport" value={formData.nilaiKeseluruhanImport}
                          onChange={(e) => handleRupiahChange(e, 'nilaiKeseluruhanImport')} required
                          disabled={isKomitmenDisabled} className={isKomitmenDisabled ? 'bg-light' : ''}
                          placeholder="Masukkan nilai Import keseluruhan" />
                      </Form.Group>
                    </Col>
                  </Row>
                  <Alert variant="warning" className="mb-3">
                    <small><strong>Import dipilih:</strong> Silakan isi kedua field nilai Import di atas.</small>
                  </Alert>
                </>
              )}

              <Form.Group className="mb-3">
                <Form.Label>Catatan Komitmen</Form.Label>
                <Form.Control
                  as="textarea" rows={3} name="catatanKomitmen" value={formData.catatanKomitmen}
                  onChange={handleFormChange} placeholder="Catatan tambahan..."
                  disabled={isKomitmenDisabled} className={isKomitmenDisabled ? 'bg-light' : ''}
                />
              </Form.Group>
            </Tab>

            {/* TAB REALISASI */}
            <Tab eventKey="realisasi" title={<span>{role === 'pic' && !isApprovedByAdmin ? '(Terkunci) ' : ''}Realisasi</span>} disabled={role === 'pic' && !isApprovedByAdmin}>

              {/* Alert: Tab Realisasi terkunci sebelum admin approve */}
              {role === 'pic' && !isApprovedByAdmin && (
                <Alert variant="warning" className="mt-3 mb-3">
                  <strong>Tab Realisasi terkunci</strong><br />
                  {!editMode
                    ? 'Data realisasi hanya bisa diisi setelah komitmen disetujui oleh Admin.'
                    : 'Komitmen ini belum disetujui oleh Admin. Data realisasi baru bisa diisi setelah status menjadi Approved.'}
                  <br /><small className="text-muted">Status saat ini: <strong>{selectedKomitmen?.approvalStatus || 'draft'}</strong></small>
                </Alert>
              )}

              <h6 className="fw-bold mb-3 mt-3 text-white bg-primary p-2">DATA KOMITMEN</h6>

              {/* Summary data komitmen (readonly) */}
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Nama Pengadaan (Komitmen)</Form.Label>
                    <Form.Control size="sm" type="text" value={formData.namaPaket} disabled className="bg-light" />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Nilai Anggaran Keseluruhan (Komitmen)</Form.Label>
                    <Form.Control size="sm" type="text" value={formData.komitmenKeseluruhan} disabled className="bg-light" />
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Nilai Anggaran Tahun Berjalan (Komitmen)</Form.Label>
                    <Form.Control size="sm" type="text" value={formData.nilaiKomitmen} disabled className="bg-light" />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Metode Pemilihan (Komitmen)</Form.Label>
                    <Form.Control size="sm" type="text" value={formData.usulanMetodePemilihan} disabled className="bg-light" />
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Jenis Pengadaan (Komitmen)</Form.Label>
                    <Form.Control size="sm" type="text" value={formData.jenisPengadaan} disabled className="bg-light" />
                  </Form.Group>
                </Col>
              </Row>

              <hr />
              <h6 className="fw-bold mb-3 text-white bg-success p-2">DATA REALISASI (EDITABLE)</h6>

              {/* Mode switch (edit only) */}
              {editMode && (
                <div className="d-flex justify-content-between align-items-center mb-3 p-3 bg-light border rounded">
                  <div>
                    {isAddingNewRealisasi
                      ? <Badge bg="success" className="px-3 py-2">Mode: Tambah Realisasi Baru</Badge>
                      : <Badge bg="info" className="px-3 py-2"><FaEdit className="me-2" />Mode: Edit Realisasi Existing</Badge>
                    }
                  </div>
                  <div className="d-flex gap-2">
                    {!isAddingNewRealisasi && (
                      <Button variant="success" size="sm" onClick={handleNewRealisasi}>
                        <FaPlus className="me-1" /> New Realisasi
                      </Button>
                    )}
                    {isAddingNewRealisasi && (
                      <Button variant="secondary" size="sm" onClick={handleCancelNewRealisasi}>
                        <FaTimes className="me-1" /> Cancel (Kembali ke Edit)
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {isAddingNewRealisasi && (
                <Alert variant="success" className="mb-3">
                  <strong>Mode Tambah Realisasi Baru:</strong> Anda sedang menambahkan data realisasi baru.
                  Data realisasi lama tidak akan terhapus.<br />
                  <small className="text-muted">
                    Isi Nama Penyedia baru jika berbeda dengan realisasi sebelumnya.<br />
                    Klik "Cancel" untuk kembali ke mode edit existing.
                  </small>
                </Alert>
              )}

              {/* Penyedia & kontrak */}
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Nama Pengadaan (Realisasi)</Form.Label>
                    <Form.Control
                      size="sm" type="text" name="namaPengadaanRealisasi"
                      value={formData.namaPengadaanRealisasi || ''}
                      onChange={handleFormChange}
                      placeholder="Masukkan nama pengadaan realisasi"
                      className={isRealisasiEditable ? 'bg-light' : 'bg-success bg-opacity-10'}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Nilai Kontrak Keseluruhan (Rp) <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      type="text" name="nilaiKontrakKeseluruhan" value={formData.nilaiKontrakKeseluruhan}
                      onChange={(e) => handleRupiahChange(e, 'nilaiKontrakKeseluruhan')}
                      placeholder="Masukkan nilai kontrak keseluruhan"
                      className={isRealisasiEditable ? 'bg-light' : 'bg-success bg-opacity-10'}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Metode Pemilihan (Realisasi)</Form.Label>
                    <Form.Select
                      size="sm" name="metodePemilihanRealisasi"
                      value={formData.metodePemilihanRealisasi || formData.usulanMetodePemilihan}
                      onChange={handleFormChange}
                      className={isRealisasiEditable ? 'bg-light' : 'bg-success bg-opacity-10'}
                    >
                      <option value="Tender/Seleksi Umum">Tender/Seleksi Umum</option>
                      <option value="Tender/Seleksi Terbatas">Tender/Seleksi Terbatas</option>
                      <option value="Penunjukan Langsung">Penunjukan Langsung</option>
                      <option value="Pengadaan Langsung">Pengadaan Langsung</option>
                      <option value="Penetapan Langsung">Penetapan Langsung</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Kualifikasi Penyedia</Form.Label>
                    <Form.Select
                      size="sm" name="kualifikasiPenyedia"
                      value={formData.kualifikasiPenyedia || 'UMKM'}
                      onChange={handleFormChange}
                      className={isRealisasiEditable ? 'bg-light' : 'bg-success bg-opacity-10'}
                    >
                      <option value="UMKM">UMKM</option>
                      <option value="Non UMKM">Non UMKM</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Nama Penyedia</Form.Label>
                    <Form.Control
                      size="sm" type="text" name="namaPenyedia"
                      value={formData.namaPenyedia || ''} onChange={handleFormChange}
                      placeholder="Masukkan nama penyedia"
                      className={isRealisasiEditable ? 'bg-light' : 'bg-success bg-opacity-10'}
                    />
                  </Form.Group>
                </Col>
              </Row>

              {/* Detail realisasi per periode */}
              <hr className="my-4" />
              <h6 className="fw-bold mb-3">Detail Realisasi per Periode</h6>
              <Row className="mb-2 bg-light py-2 border rounded">
                <Col md={2}><Form.Label className="fw-bold small mb-0">Nilai Realisasi (Rp)</Form.Label></Col>
                <Col md={2}><Form.Label className="fw-bold small mb-0">Tanggal Invoice</Form.Label></Col>
                <Col md={2}><Form.Label className="fw-bold small mb-0">Nomor Invoice</Form.Label></Col>
                <Col md={2}><Form.Label className="fw-bold small mb-0">Bulan</Form.Label></Col>
                <Col md={2}><Form.Label className="fw-bold small mb-0">Upload Dokumen</Form.Label></Col>
                <Col md={2} className="text-center"><Form.Label className="fw-bold small mb-0">Aksi</Form.Label></Col>
              </Row>

              {realisasiRows.map((row, index) => {
                // Admin: semua baris editable. PIC: baris existing locked jika bukan mode tambah
                const isExistingRow = role === 'pic' && editMode && !isAddingNewRealisasi && index < (selectedKomitmen?.realisasiDetail?.length || 0);
                return (
                  <Row key={row.id} className="mb-2 align-items-center border-bottom pb-2">
                    <Col md={2}>
                      <Form.Control
                        type="text" value={row.realisasi || ''}
                        onChange={(e) => handleRealisasiRupiahChange(index, 'realisasi', e.target.value)}
                        placeholder="0" disabled={isExistingRow}
                        className={isExistingRow ? 'bg-light' : 'bg-success bg-opacity-10'}
                        size="sm"
                      />
                    </Col>
                    <Col md={2}>
                      <DatePicker
                        selected={row.tanggalInvoice ? new Date(row.tanggalInvoice) : null}
                        onChange={(date) => {
                          const formatted = date ? date.toISOString().split('T')[0] : '';
                          handleRealisasiChange(index, 'tanggalInvoice', formatted);
                        }}
                        dateFormat="dd/MM/yyyy" locale={id} placeholderText="dd/mm/yyyy"
                        className={`form-control form-control-sm ${isExistingRow ? 'bg-light' : 'bg-success bg-opacity-10'}`}
                        wrapperClassName="w-100" disabled={isExistingRow}
                        showMonthDropdown showYearDropdown dropdownMode="select"
                        yearDropdownItemNumber={10} scrollableYearDropdown
                        popperProps= strategy: 'fixed' 
                      />
                    </Col>
                    <Col md={2}>
                      <Form.Control
                        type="text" value={row.nomorInvoice || ''}
                        onChange={(e) => handleRealisasiChange(index, 'nomorInvoice', e.target.value)}
                        placeholder="INV-001" disabled={isExistingRow}
                        className={isExistingRow ? 'bg-light' : 'bg-success bg-opacity-10'}
                        size="sm"
                      />
                    </Col>
                    <Col md={2}>
                      <Form.Select
                        value={row.bulanRealisasi || ''}
                        onChange={(e) => handleRealisasiChange(index, 'bulanRealisasi', e.target.value)}
                        disabled={isExistingRow}
                        className={isExistingRow ? 'bg-light' : 'bg-success bg-opacity-10'}
                        size="sm"
                      >
                        <option value="">Pilih Bulan</option>
                        {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </Form.Select>
                    </Col>
                    <Col md={2}>
                      {row.dokumen
                        ? <Badge bg="success" className="w-100">File Terupload</Badge>
                        : (
                          <Form.Control
                            type="file"
                            onChange={(e) => handleRealisasiChange(index, 'dokumen', e.target.files[0])}
                            accept=".pdf,.jpg,.jpeg,.png"
                            disabled={isExistingRow}
                            size="sm"
                          />
                        )
                      }
                    </Col>
                    <Col md={2} className="text-center">
                      {index === realisasiRows.length - 1 && (
                        <Button variant="primary" size="sm" onClick={addRealisasiRow} className="me-1">
                          <FaPlus />
                        </Button>
                      )}
                      {!isExistingRow && realisasiRows.length > 1 && (
                        <Button variant="danger" size="sm" onClick={() => removeRealisasiRow(index)}>
                          <FaTimes />
                        </Button>
                      )}
                    </Col>
                  </Row>
                );
              })}

              {/* Summary per periode */}
              <hr className="my-4" />
              <div className="mb-2">
                <h6 className="text-success mb-2">Summary Per Periode (Tahun Berjalan)</h6>
                <Row className="mb-3">
                  {[
                    { label: 'Progress per Periode', value: `${calculateSummaryPerPeriode().progress}%`, note: 'Detail Realisasi / Komitmen Tahun Ini', variant: 'warning' },
                    { label: 'Sisa Pembayaran per Periode', value: calculateSummaryPerPeriode().sisa, note: 'Komitmen Tahun Ini - Detail Realisasi', variant: 'info' },
                    { label: 'Total Realisasi per Periode', value: calculateSummaryPerPeriode().total, note: 'SUM dari Detail Realisasi per Periode', variant: 'success' },
                  ].map(({ label, value, note, variant }) => (
                    <Col md={4} key={label}>
                      <Alert variant={variant} className="mb-0">
                        <strong>{label}:</strong> {value}<br />
                        <small className="text-muted">{note}</small>
                      </Alert>
                    </Col>
                  ))}
                </Row>
              </div>

              <div className="mb-3">
                <h6 className="text-success mb-2">
                  Summary Keseluruhan {formData.jenisPaket === 'Multi Year (MY)' ? '(Total Kontrak MY)' : '(Total Kontrak)'}
                </h6>
                <Row>
                  {[
                    {
                      label: 'Progress Keseluruhan', value: `${calculateSummaryKeseluruhan().progress}%`,
                      note: `Total Realisasi / ${formData.jenisPaket === 'Multi Year (MY)' ? 'Nilai Kontrak' : 'Nilai Kontrak/Komitmen'}`,
                      variant: 'warning'
                    },
                    {
                      label: 'Sisa Pembayaran Keseluruhan', value: calculateSummaryKeseluruhan().sisa,
                      note: `${formData.jenisPaket === 'Multi Year (MY)' ? 'Nilai Kontrak' : 'Nilai Kontrak/Komitmen'} - Total Realisasi`,
                      variant: 'info'
                    },
                    {
                      label: 'Total Realisasi Keseluruhan', value: calculateSummaryKeseluruhan().total,
                      note: isAddingNewRealisasi ? 'Realisasi Lama + Detail Realisasi Baru' : 'Total dari Detail Realisasi',
                      variant: 'success'
                    },
                  ].map(({ label, value, note, variant }) => (
                    <Col md={4} key={label}>
                      <Alert variant={variant} className="mb-0" style= borderLeft: '4px solid #28a745' >
                        <strong>{label}:</strong> {value}<br />
                        <small className="text-muted">{note}</small>
                      </Alert>
                    </Col>
                  ))}
                </Row>
              </div>

              {/* Nilai Rupiah auto-fill */}
              <hr />
              <h6 className="fw-bold mb-3">Nilai Rupiah</h6>
              <Alert variant="success" className="mb-3">
                <small>
                  <strong>Auto-Calculate:</strong> Nilai di bawah akan otomatis terisi berdasarkan <strong>Total Detail Realisasi per Periode</strong> sesuai checkbox yang dipilih di Tab Komitmen Awal (PDN/TKDN/Import).
                </small>
              </Alert>
              <Row>
                {[
                  { field: 'nilaiPDN', label: 'Nilai PDN', checkbox: 'pdnCheckbox' },
                  { field: 'nilaiTKDN', label: 'Nilai TKDN', checkbox: 'tkdnCheckbox' },
                  { field: 'nilaiImpor', label: 'Nilai Impor', checkbox: 'importCheckbox' },
                ].map(({ field, label, checkbox }) => {
                  const isActive = formData[checkbox];
                  const autoTotal = formatRupiahInput(
                    realisasiRows.reduce((sum, row) => sum + parseRupiahInput(row.realisasi), 0).toString()
                  );
                  return (
                    <Col md={4} key={field}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          {label} (Rp)
                          {isActive && <Badge bg="success" className="ms-2">Auto-filled</Badge>}
                        </Form.Label>
                        <Form.Control
                          type="text" name={field} value={formData[field]}
                          onChange={(e) => handleRupiahChange(e, field)}
                          placeholder="0" disabled={!isActive}
                          className={isActive ? 'bg-success bg-opacity-10' : 'bg-light'}
                        />
                        <Form.Text className={isActive ? 'text-success' : 'text-muted'}>
                          {isActive
                            ? `Otomatis dari Total Detail Realisasi: ${autoTotal}`
                            : `Checkbox ${label.replace('Nilai ', '')} tidak dipilih di Tab Komitmen`
                          }
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  );
                })}
              </Row>
            </Tab>
          </Tabs>

          {/* Form Actions */}
          <div className="d-flex justify-content-end gap-2 mt-3">
            <Button variant="secondary" onClick={onHide}>Batal</Button>
            <Button
              variant="primary" type="submit"
              disabled={loading || rencanaOverLimit}
            >
              {loading ? <Spinner animation="border" size="sm" /> : (editMode ? 'Update' : 'Simpan')}
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default KomitmenFormModal;
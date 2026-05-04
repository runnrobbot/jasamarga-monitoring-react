import { Table, Badge, Button, Spinner } from 'react-bootstrap';
import {
  FaEye, FaEdit, FaTrash,
  FaCheckCircle, FaTimesCircle, FaClock,
  FaExclamationTriangle, FaUndo,
} from 'react-icons/fa';
import { formatCurrency } from '../../utils/rupiahUtils';

/**
 * Helper – check if total kontrak/realisasi is fully paid.
 */
const isInvoiceLunas = (item) => {
  if (item.jenisPaket === 'Multi Year (MY)') {
    const total = item.komitmenKeseluruhan || 0;
    return total > 0 && total === (item.realisasi || 0);
  }
  return ((item.nilaiKomitmen || 0) - (item.realisasi || 0)) === 0;
};

const isTahunBerjalanLunas = (item) => {
  if (item.jenisPaket !== 'Multi Year (MY)') return false;
  const currentYear = new Date().getFullYear().toString();
  const details = item.realisasiDetail || [];
  const realisasiTahunIni = details
    .filter(d => {
      if (d.tahunRealisasi) return d.tahunRealisasi.toString() === currentYear;
      if (d.tanggalInvoice) return new Date(d.tanggalInvoice).getFullYear().toString() === currentYear;
      return false;
    })
    .reduce((sum, d) => sum + (d.realisasi || 0), 0);
  return (item.nilaiKomitmen || 0) > 0 && realisasiTahunIni >= (item.nilaiKomitmen || 0);
};

const getTahunBerjalan = (item) => {
  const details = item.realisasiDetail || [];
  for (let i = details.length - 1; i >= 0; i--) {
    if (details[i].tahunRealisasi) return details[i].tahunRealisasi;
    if (details[i].tanggalInvoice) {
      const y = new Date(details[i].tanggalInvoice).getFullYear();
      if (!isNaN(y)) return y;
    }
  }
  return new Date().getFullYear();
};

/**
 * Status cell – badges for approval & operational status.
 */
const StatusCell = ({ item }) => (
  <div className="d-flex flex-column gap-1">
    {item.approvalStatus === 'draft' && (
      <Badge bg="warning" text="dark"><FaClock className="me-1" />Pending Approval</Badge>
    )}
    {item.approvalStatus === 'approved' && (
      <Badge bg="success"><FaCheckCircle className="me-1" />Approved</Badge>
    )}
    {item.approvalStatus === 'rejected' && (
      <>
        <Badge bg="danger"><FaTimesCircle className="me-1" />Rejected</Badge>
        {item.approvalNote && (
          <small className="text-danger" style={{ fontSize: '0.75rem' }}>
            <strong>Alasan:</strong> {item.approvalNote}
          </small>
        )}
      </>
    )}
    {item.approvalStatus === 'revision_requested' && (
      <>
        <Badge bg="warning" text="dark"><FaUndo className="me-1" />Request Revisi</Badge>
        {item.revisiNote && (
          <small className="text-warning" style={{ fontSize: '0.75rem' }}>
            <strong>Catatan PIC:</strong> {item.revisiNote}
          </small>
        )}
      </>
    )}
    {item.status === 'selesai' && (
      <Badge bg="primary"><FaCheckCircle className="me-1" />SELESAI</Badge>
    )}
    {item.status !== 'selesai' && item.approvalStatus === 'approved' && (
      <Badge bg="success">ACTIVE</Badge>
    )}
    {item.status !== 'selesai' && item.jenisPaket === 'Multi Year (MY)' &&
      isTahunBerjalanLunas(item) && !isInvoiceLunas(item) && (
        <Badge bg="info" text="dark">Selesai Tahun {getTahunBerjalan(item)}</Badge>
      )}
    {item.needRealisasi && (
      <Badge bg="warning" text="dark">
        <FaExclamationTriangle className="me-1" />PERLU REALISASI
      </Badge>
    )}
  </div>
);

/**
 * Tabel list Komitmen – mendukung mode Admin dan PIC.
 *
 * @param {Object} props
 * @param {Array}  props.data            - Filtered list of komitmen
 * @param {boolean} props.loading
 * @param {'admin'|'pic'} props.role
 * @param {Function} props.onView        - (item) => void
 * @param {Function} props.onEdit        - (item) => void
 * @param {Function} [props.onDelete]    - (id) => void  (admin only)
 * @param {Function} [props.onApprove]   - (item) => void  (admin only)
 * @param {Function} [props.onReject]    - (item) => void  (admin only)
 * @param {Function} [props.onComplete]  - (item) => void  (admin only)
 * @param {Function} [props.onApproveRevisi] - (item) => void (admin only)
 * @param {Function} [props.onRevisi]    - (item) => void  (pic only)
 */
const KomitmenTable = ({
  data = [],
  loading = false,
  role = 'admin',
  onView,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  onComplete,
  onApproveRevisi,
  onRevisi,
}) => {
  const isAdmin = role === 'admin';
  const colSpan = isAdmin ? 12 : 11;

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-2">Loading data...</p>
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <Table striped bordered hover>
        <thead className="table-dark">
          <tr>
            <th>#</th>
            <th>ID Paket</th>
            <th>Nama Paket</th>
            {isAdmin && <th>Nama AP</th>}
            <th>Jenis</th>
            <th>{isAdmin ? 'Komitmen Keseluruhan' : 'Komitmen/Kontrak Keseluruhan'}</th>
            <th>Komitmen Tahun Berjalan</th>
            <th>Total Rencana</th>
            <th>Nilai Kontrak</th>
            <th>Realisasi</th>
            <th>Status</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="text-center py-3 text-muted">
                Tidak ada data
              </td>
            </tr>
          ) : (
            data.map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td><small className="font-monospace">{item.idPaketMonitoring}</small></td>
                <td>{item.namaPaket}</td>
                {isAdmin && <td><small>{item.namaAP}</small></td>}
                <td><Badge bg="info">{item.jenisPaket}</Badge></td>
                <td>
                  {item.jenisPaket === 'Multi Year (MY)' ? (
                    <span className="text-primary fw-bold">{formatCurrency(item.komitmenKeseluruhan)}</span>
                  ) : item.jenisPaket === 'Single Year (SY)' ? (
                    <span className="text-success fw-bold">{formatCurrency(item.nilaiKomitmen)}</span>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
                <td>{formatCurrency(item.nilaiKomitmen)}</td>
                <td>
                  {formatCurrency(
                    (item.rencanaDetail || []).reduce((sum, d) => sum + (d.nilaiRencana || 0), 0)
                  )}
                </td>
                <td>
                  {item.nilaiKontrakKeseluruhan > 0 ? (
                    <span className="text-info fw-bold">{formatCurrency(item.nilaiKontrakKeseluruhan)}</span>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
                <td>
                  <span className="text-success fw-bold">{formatCurrency(item.realisasi)}</span>
                </td>
                <td><StatusCell item={item} /></td>
                <td>
                  <div className="d-flex gap-1 flex-wrap">
                    {/* View */}
                    <Button variant="info" size="sm" onClick={() => onView(item)} title="Detail">
                      <FaEye />
                    </Button>

                    {/* Edit */}
                    <Button
                      variant="warning"
                      size="sm"
                      onClick={() => onEdit(item)}
                      disabled={item.status === 'selesai'}
                      title={item.status === 'selesai' ? 'Komitmen sudah selesai' : 'Edit'}
                    >
                      <FaEdit />
                    </Button>

                    {/* Admin-only actions */}
                    {isAdmin && (
                      <>
                        <Button variant="danger" size="sm" onClick={() => onDelete(item.id)} title="Hapus">
                          <FaTrash />
                        </Button>

                        {item.approvalStatus === 'draft' && (
                          <>
                            <Button variant="success" size="sm" onClick={() => onApprove(item)} title="Approve">
                              <FaCheckCircle />
                            </Button>
                            <Button variant="danger" size="sm" onClick={() => onReject(item)} title="Reject">
                              <FaTimesCircle />
                            </Button>
                          </>
                        )}

                        {item.approvalStatus === 'approved' && item.status !== 'selesai' && (
                          <Button variant="success" size="sm" onClick={() => onComplete(item)} title="Tandai Selesai">
                            <FaCheckCircle /> Selesai
                          </Button>
                        )}

                        {item.approvalStatus === 'revision_requested' && (
                          <Button
                            variant="warning"
                            size="sm"
                            onClick={() => onApproveRevisi(item)}
                            title="Proses Request Revisi"
                          >
                            <FaUndo /> Revisi
                          </Button>
                        )}
                      </>
                    )}

                    {/* PIC-only actions */}
                    {!isAdmin && (
                      <>
                        {(item.approvalStatus === 'draft' || item.approvalStatus === 'approved') &&
                          item.status !== 'selesai' && (
                            <Button
                              variant="outline-warning"
                              size="sm"
                              onClick={() => onRevisi(item)}
                              title="Request Revisi / Tarik Submission"
                            >
                              <FaUndo />
                            </Button>
                          )}
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
  );
};

export default KomitmenTable;

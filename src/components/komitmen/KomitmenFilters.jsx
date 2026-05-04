import { Form, InputGroup, Row, Col } from 'react-bootstrap';
import { FaSearch } from 'react-icons/fa';

/**
 * Search + filter bar untuk halaman Komitmen.
 * @param {Object} props
 * @param {string} props.searchTerm
 * @param {Function} props.onSearchChange
 * @param {string} props.filterStatus
 * @param {Function} props.onFilterStatusChange
 * @param {string} props.filterApprovalStatus
 * @param {Function} props.onFilterApprovalStatusChange
 * @param {boolean} [props.showApprovalFilter=true]
 */
const KomitmenFilters = ({
  searchTerm,
  onSearchChange,
  filterStatus,
  onFilterStatusChange,
  filterApprovalStatus,
  onFilterApprovalStatusChange,
  showApprovalFilter = true,
}) => {
  return (
    <Row className="g-2 mb-3">
      <Col md={4}>
        <InputGroup size="sm">
          <InputGroup.Text>
            <FaSearch />
          </InputGroup.Text>
          <Form.Control
            placeholder="Cari nama paket, AP, atau ID..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </InputGroup>
      </Col>

      <Col md={3}>
        <Form.Select
          size="sm"
          value={filterStatus}
          onChange={(e) => onFilterStatusChange(e.target.value)}
        >
          <option value="all">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="selesai">Selesai</option>
          <option value="inactive">Tidak Aktif</option>
        </Form.Select>
      </Col>

      {showApprovalFilter && (
        <Col md={3}>
          <Form.Select
            size="sm"
            value={filterApprovalStatus}
            onChange={(e) => onFilterApprovalStatusChange(e.target.value)}
          >
            <option value="all">Semua Approval</option>
            <option value="draft">Menunggu Approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="revision_requested">Request Revisi</option>
            <option value="selesai">Selesai</option>
          </Form.Select>
        </Col>
      )}
    </Row>
  );
};

export default KomitmenFilters;

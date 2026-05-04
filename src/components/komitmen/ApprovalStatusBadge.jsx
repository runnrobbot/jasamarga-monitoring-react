import { Badge } from 'react-bootstrap';
import {
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaExclamationTriangle,
  FaUndo,
} from 'react-icons/fa';

/**
 * Renders a colored Badge for a Komitmen approval/status value.
 * @param {Object} props
 * @param {string} props.status - approvalStatus or status value
 * @param {'approval'|'status'} [props.type='approval'] - which type of status
 */
const ApprovalStatusBadge = ({ status, type = 'approval' }) => {
  if (type === 'status') {
    const map = {
      active: { bg: 'success', label: 'Aktif' },
      selesai: { bg: 'secondary', label: 'Selesai' },
      inactive: { bg: 'dark', label: 'Tidak Aktif' },
    };
    const cfg = map[status] || { bg: 'light', label: status };
    return <Badge bg={cfg.bg}>{cfg.label}</Badge>;
  }

  // Approval status
  switch (status) {
    case 'approved':
      return (
        <Badge bg="success">
          <FaCheckCircle className="me-1" />Approved
        </Badge>
      );
    case 'rejected':
      return (
        <Badge bg="danger">
          <FaTimesCircle className="me-1" />Rejected
        </Badge>
      );
    case 'draft':
      return (
        <Badge bg="warning" text="dark">
          <FaClock className="me-1" />Menunggu Approval
        </Badge>
      );
    case 'revision_requested':
      return (
        <Badge bg="info">
          <FaExclamationTriangle className="me-1" />Request Revisi
        </Badge>
      );
    case 'selesai':
      return (
        <Badge bg="secondary">
          <FaCheckCircle className="me-1" />Selesai
        </Badge>
      );
    default:
      return (
        <Badge bg="light" text="dark">
          <FaUndo className="me-1" />{status || 'Unknown'}
        </Badge>
      );
  }
};

export default ApprovalStatusBadge;

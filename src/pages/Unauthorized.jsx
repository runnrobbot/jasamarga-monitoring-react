import { Container, Button, Card, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { FaExclamationTriangle, FaHome, FaSignOutAlt, FaInfoCircle } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';

const Unauthorized = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleGoHome = () => {
    if (user?.role === 'admin' || user?.role === 'pic') {
      navigate('/admin/dashboard', { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  };

  return (
    <Container className="d-flex align-items-center justify-content-center min-vh-100">
      <div className="text-center" style={{ maxWidth: '600px' }}>
        <Card className="shadow-lg border-0">
          <Card.Body className="p-5">
            {/* Icon */}
            <div className="mb-4">
              <FaExclamationTriangle size={80} className="text-warning" />
            </div>

            {/* Title */}
            <h1 className="fw-bold mb-3">Akses Ditolak</h1>
            
            {/* Description */}
            <p className="text-muted mb-4">
              Anda tidak memiliki izin untuk mengakses halaman ini.
            </p>

            {user && (
              <Alert variant="info" className="text-start mb-4">
                <div className="d-flex align-items-start">
                  <FaInfoCircle className="me-2 mt-1" />
                  <div className="flex-grow-1">
                    <strong>Informasi Akun:</strong>
                    <ul className="mb-0 mt-2 small">
                      <li>Username: <strong>{user.username}</strong></li>
                      <li>Role: <strong>{user.role?.toUpperCase() || 'UNKNOWN'}</strong></li>
                      {user.namaAP && (
                        <li>AP: <strong>{user.namaAP}</strong></li>
                      )}
                    </ul>
                  </div>
                </div>
              </Alert>
            )}

            <Alert variant="warning" className="text-start mb-4">
              <strong>Sistem hanya mendukung role berikut:</strong>
              <ul className="mb-0 mt-2">
                <li><strong>Admin</strong> - Akses penuh ke semua fitur</li>
                <li><strong>PIC</strong> - Akses terbatas berdasarkan Area Pengelola (AP)</li>
              </ul>
              <hr className="my-2" />
              <small className="text-muted">
                Jika Anda memiliki role lain (monitoring, user, dll), 
                silakan hubungi administrator untuk mengupdate role Anda.
              </small>
            </Alert>

            {/* Action Buttons */}
            <div className="d-flex gap-3 justify-content-center flex-wrap">
              {user && (user.role === 'admin' || user.role === 'pic') && (
                <Button 
                  variant="primary" 
                  onClick={handleGoHome}
                  className="px-4"
                >
                  <FaHome className="me-2" />
                  Kembali ke Dashboard
                </Button>
              )}
              
              <Button 
                variant="outline-secondary" 
                onClick={() => navigate(-1)}
                className="px-4"
              >
                Kembali
              </Button>

              {user && (
                <Button 
                  variant="outline-danger" 
                  onClick={handleLogout}
                  className="px-4"
                >
                  <FaSignOutAlt className="me-2" />
                  Logout
                </Button>
              )}
            </div>

            {/* Help Text */}
            <div className="mt-4">
              <small className="text-muted">
                Butuh bantuan? Hubungi administrator di{' '}
                <strong>admin@jasamarga.com</strong>
              </small>
            </div>
          </Card.Body>
        </Card>

        {/* Copyright */}
        <div className="mt-4">
          <small className="text-muted">
            © 2026 PT Jasa Marga (Persero) Tbk. All rights reserved.
          </small>
        </div>
      </div>
    </Container>
  );
};

export default Unauthorized;
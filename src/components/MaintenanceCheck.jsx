import { useState, useEffect } from 'react';
import { Container, Card, Alert, Spinner, Badge } from 'react-bootstrap';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { FaCog, FaTools, FaUserShield } from 'react-icons/fa';

const MaintenanceCheck = ({ children }) => {
  const { user, loading: authLoading } = useAuth(); // ✅ Get authLoading state
  const userRole = user?.role;
  const [loading, setLoading] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  useEffect(() => {
    // ✅ Only check maintenance if user is authenticated
    if (!authLoading && user) {
      checkMaintenanceMode();
      
      // Check every 30 seconds
      const interval = setInterval(checkMaintenanceMode, 30000);
      
      return () => clearInterval(interval);
    } else if (!authLoading && !user) {
      // ✅ If not authenticated, just finish loading
      setLoading(false);
    }
  }, [user, authLoading]); // ✅ Add dependencies

  const checkMaintenanceMode = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, 'settings', 'app'));
      if (settingsDoc.exists()) {
        const settings = settingsDoc.data();
        setMaintenanceMode(settings.maintenanceMode || false);
        
        if (settings.maintenanceMode) {
          console.log('⚠️ Maintenance Mode: ACTIVE');
          console.log('👤 User Role:', userRole);
          console.log('🔓 Admin Bypass:', userRole === 'admin' ? 'YES' : 'NO');
        }
      }
    } catch (error) {
      console.error('Error checking maintenance mode:', error);
      // ✅ Don't block app if can't check maintenance
      setMaintenanceMode(false);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Show loading while checking auth OR maintenance
  if (authLoading || loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  // ✅ If not authenticated, show children (login page)
  if (!user) {
    return <>{children}</>;
  }

  // ✅ If maintenance mode is ON and user is NOT admin
  if (maintenanceMode && userRole !== 'admin') {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
        <Container>
          <Card className="shadow-lg border-0" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <Card.Body className="p-5 text-center">
              <div className="mb-4">
                <FaTools size={64} className="text-warning" />
              </div>
              <h2 className="fw-bold mb-3">Sistem Dalam Maintenance</h2>
              
              <div className="mb-3">
                <Badge bg={userRole === 'pic' ? 'primary' : 'secondary'} className="px-3 py-2">
                  Role Anda: {userRole?.toUpperCase() || 'USER'}
                </Badge>
              </div>

              <Alert variant="warning" className="text-start">
                <FaCog className="me-2" />
                <strong>Mode Maintenance Aktif</strong>
                <p className="mb-0 mt-2 small">
                  Sistem sedang dalam pemeliharaan. Hanya <Badge bg="danger" className="mx-1">ADMIN</Badge> yang dapat mengakses saat ini.
                </p>
              </Alert>

              <div className="bg-light p-3 rounded mb-4">
                <p className="text-muted mb-2">
                  <FaTools className="me-2 text-warning" />
                  Kami sedang melakukan pemeliharaan sistem untuk meningkatkan kualitas layanan.
                  Silakan coba lagi beberapa saat lagi.
                </p>
              </div>

              <div className="small text-muted">
                <p className="mb-1">Jika Anda memerlukan akses segera, silakan hubungi administrator:</p>
                <p className="mb-0"><strong>admin@jasamarga.com</strong></p>
              </div>

              {user?.role === 'pic' && user?.namaAP && (
                <div className="mt-4 pt-3 border-top">
                  <small className="text-muted d-block">Informasi Akun Anda:</small>
                  <div className="mt-2">
                    <Badge bg="info" className="me-2">{user.namaAP}</Badge>
                    {user.singkatanAP && (
                      <Badge bg="secondary">{user.singkatanAP}</Badge>
                    )}
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
        </Container>
      </div>
    );
  }

  if (maintenanceMode && userRole === 'admin') {
    console.log('✅ Admin bypass: Maintenance mode active but admin can access');
  }

  return <>{children}</>;
};

export default MaintenanceCheck;
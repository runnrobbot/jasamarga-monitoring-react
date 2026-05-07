import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';


const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading } = useAuth();


  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted">Memverifikasi akses...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const validRoles = ['admin', 'pic', 'gm'];
  if (!validRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // If user doesn't have the required role, redirect to unauthorized
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if ((user.role === 'pic' || user.role === 'gm') && !user.namaAP) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;
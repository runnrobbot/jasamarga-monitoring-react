import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';


const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading } = useAuth();

  console.log('🔒 ProtectedRoute Check:', {
    user: user ? { 
      username: user.username, 
      role: user.role,
      namaAP: user.namaAP || 'N/A'
    } : null,
    loading,
    allowedRoles,
    path: window.location.pathname
  });

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

  // If not logged in, redirect to login
  if (!user) {
    console.log('❌ Not logged in, redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  // ✅ VALIDATE: Only accept 'admin' or 'pic' roles
  const validRoles = ['admin', 'pic'];
  if (!validRoles.includes(user.role)) {
    console.log('❌ Invalid role detected:', user.role);
    console.log('⚠️ User has old role (monitoring/user), should re-login');
    return <Navigate to="/unauthorized" replace />;
  }

  // If user doesn't have the required role, redirect to unauthorized
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    console.log('❌ Access denied, role not allowed:', { 
      userRole: user.role, 
      allowedRoles 
    });
    return <Navigate to="/unauthorized" replace />;
  }

  // ✅ ADDITIONAL CHECK: PIC must have namaAP
  if (user.role === 'pic' && !user.namaAP) {
    console.log('⚠️ PIC user without namaAP, redirecting to unauthorized');
    return <Navigate to="/unauthorized" replace />;
  }

  // User is authenticated and has the required role
  console.log('✅ Access granted');
  return children;
};

export default ProtectedRoute;
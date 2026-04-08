import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import MaintenanceCheck from './components/MaintenanceCheck';

// Public Pages
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';

// Shared Pages (Admin & PIC)
import ProfilePage from './pages/ProfilePage';
import NotificationsPage from './pages/NotificationsPage';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import UsersManagement from './pages/admin/UsersManagement';
import AdminKomitmen from './pages/admin/AdminKomitmen';
import AdminReports from './pages/admin/AdminReports';
import AdminSettings from './pages/admin/AdminSettings';
import MasterAP from './pages/admin/MasterAP';

// ✅ PIC Pages (Separate Structure)
import PICDashboard from './pages/pic/PICDashboard';
import PICKomitmen from './pages/pic/PICKomitmen';
import PICReports from './pages/pic/PICReports';

// Context
import { NotificationProvider } from './contexts/NotificationContext';

// Styles
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

// ✅ UPDATED: App.jsx dengan struktur terpisah untuk Admin & PIC
function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <MaintenanceCheck>
          <Router>
            <Routes>
              {/* ========================================
                  PUBLIC ROUTES
                  ======================================== */}
              
              <Route path="/login" element={<Login />} />
              <Route path="/unauthorized" element={<Unauthorized />} />

              {/* ========================================
                  SHARED ROUTES (Admin & PIC)
                  ======================================== */}
              
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute allowedRoles={['admin', 'pic']}>
                    <ProfilePage />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/notifications" 
                element={
                  <ProtectedRoute allowedRoles={['admin', 'pic']}>
                    <NotificationsPage />
                  </ProtectedRoute>
                } 
              />

              {/* ========================================
                  ADMIN ROUTES
                  ======================================== */}
              
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/komitmen"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminKomitmen />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/reports"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminReports />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <UsersManagement />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/master-ap"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <MasterAP />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminSettings />
                  </ProtectedRoute>
                }
              />

              {/* ========================================
                  PIC ROUTES (Separate Structure)
                  ======================================== */}
              
              <Route
                path="/pic/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['pic']}>
                    <PICDashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/pic/komitmen"
                element={
                  <ProtectedRoute allowedRoles={['pic']}>
                    <PICKomitmen />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/pic/reports"
                element={
                  <ProtectedRoute allowedRoles={['pic']}>
                    <PICReports />
                  </ProtectedRoute>
                }
              />

              {/* ========================================
                  DEPRECATED ROUTES (OLD SYSTEM)
                  ======================================== */}
              
              <Route path="/user/*" element={<Navigate to="/unauthorized" replace />} />
              <Route path="/monitoring/*" element={<Navigate to="/unauthorized" replace />} />

              {/* ========================================
                  DEFAULT & FALLBACK ROUTES
                  ======================================== */}
              
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Router>
        </MaintenanceCheck>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
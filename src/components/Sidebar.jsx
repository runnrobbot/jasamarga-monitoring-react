import { Nav } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';

// Import custom icons
import dashboardIcon from '../../public/icon/dashboard.png';
import kelolaUserIcon from '../../public/icon/kelola_user.png';
import masterAPIcon from '../../public/icon/master_ap.png';
import komitmenIcon from '../../public/icon/komitmen.png';
import laporanIcon from '../../public/icon/laporan.png';
import pengaturanIcon from '../../public/icon/pengaturan.png';


const Sidebar = () => {
  const location = useLocation();
  const { user } = useAuth();

  const userRole = user?.role || null;

  const menuByRole = {
    admin: [
      { path: '/admin/dashboard', icon: dashboardIcon, label: 'Dashboard' },
      { path: '/admin/users', icon: kelolaUserIcon, label: 'Kelola User' },
      { path: '/admin/master-ap', icon: masterAPIcon, label: 'Master Nama AP' },
      { path: '/admin/komitmen', icon: komitmenIcon, label: 'Komitmen' },
      { path: '/admin/reports', icon: laporanIcon, label: 'Laporan' },
      { path: '/admin/settings', icon: pengaturanIcon, label: 'Pengaturan' },
    ],
    pic: [
      { path: '/pic/dashboard', icon: dashboardIcon, label: 'Dashboard' },
      { path: '/pic/komitmen', icon: komitmenIcon, label: 'Komitmen' },
      { path: '/pic/reports', icon: laporanIcon, label: 'Laporan' },
    ]
  };

  const menuItems = userRole ? (menuByRole[userRole] || []) : [];

  // Don't render sidebar if no user
  if (!user) {
    return null;
  }

  return (
    <div className="sidebar bg-dark text-white">
      <div className="sidebar-sticky pt-3">
        <Nav className="flex-column">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            
            return (
              <Nav.Link
                key={item.path}
                as={Link}
                to={item.path}
                className={`sidebar-link text-white d-flex align-items-center py-3 px-4 ${
                  isActive ? 'active' : ''
                }`}
              >
                <img 
                  src={item.icon} 
                  alt={item.label}
                  style={{ width: '24px', height: '24px', marginRight: '12px' }}
                />
                <span>{item.label}</span>
              </Nav.Link>
            );
          })}
        </Nav>

        {/* ✅ Show AP name for PIC at bottom of sidebar */}
        {user?.role === 'pic' && user?.namaAP && (
          <div className="sidebar-footer mt-auto p-3 border-top border-secondary">
            <small className="text-muted d-block">Anda mengelola:</small>
            <div className="fw-bold small mt-1 d-flex align-items-center">
              <img 
                src={masterAPIcon} 
                alt="Master AP"
                style={{ width: '20px', height: '20px', marginRight: '8px' }}
              />
              {user.namaAP}
            </div>
            {user.singkatanAP && (
              <div className="text-muted small">({user.singkatanAP})</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
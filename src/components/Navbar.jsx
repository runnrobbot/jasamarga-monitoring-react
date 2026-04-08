import { Navbar as BootstrapNavbar, Container, Nav, NavDropdown, Badge, ListGroup, Button } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { FaBell, FaUser, FaSignOutAlt, FaCheck, FaTrash } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { markAsRead, deleteNotification } from '../utils/notificationService';
import { formatDate } from '../utils/formatters';
import { toast } from 'react-toastify';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const userRole = user?.role;
  const { notifications, unreadCount } = useNotifications();
  const navigate = useNavigate();

  const getNavbarTitle = () => {
    if (!user) return 'Jasa Marga - AP Monitoring';
    
    if (user.role === 'admin') {
      return 'Jasa Marga - AP Monitoring | Administrator';
    } else if (user.role === 'pic' && user.namaAP) {
      return `Jasa Marga - AP Monitoring | ${user.namaAP}`;
    }
    
    return 'Jasa Marga - AP Monitoring';
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleMarkAsRead = async (notificationId, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      console.log('Marking as read:', notificationId);
      await markAsRead(notificationId);
      toast.success('Notifikasi ditandai sudah dibaca');
    } catch (error) {
      console.error('Error marking as read:', error);
      toast.error('Gagal menandai notifikasi: ' + error.message);
    }
  };

  const handleDeleteNotification = async (notificationId, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      console.log('Deleting notification:', notificationId);
      console.log('Current user:', user?.uid);
      
      await deleteNotification(notificationId);
      toast.success('Notifikasi dihapus');
    } catch (error) {
      console.error('Error deleting notification:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      if (error.code === 'permission-denied') {
        toast.error('Tidak memiliki izin untuk menghapus notifikasi ini');
      } else {
        toast.error('Gagal menghapus notifikasi: ' + error.message);
      }
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'announcement': return '📢';
      default: return 'ℹ️';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'danger';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'secondary';
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return 'danger';
      case 'pic': return 'primary';
      default: return 'secondary';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'ADMIN';
      case 'pic': return 'PIC';
      default: return role?.toUpperCase() || 'USER';
    }
  };

  return (
    <BootstrapNavbar style={{ backgroundColor: '#003d7a' }} variant="dark" expand="lg" fixed="top" className="shadow-sm navbar-custom">
      <Container fluid>
        <BootstrapNavbar.Brand 
          as={Link} 
          to={user?.role === 'admin' ? '/admin/dashboard' : '/pic/dashboard'} 
          className="fw-bold navbar-brand-custom"
        >
          <img 
            src="/logo.png" 
            alt="Jasa Marga" 
            height="30" 
            className="d-inline-block align-top me-2 navbar-logo"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <span className="navbar-title">{getNavbarTitle()}</span>
        </BootstrapNavbar.Brand>
        
        <BootstrapNavbar.Toggle aria-controls="basic-navbar-nav" />
        
        <BootstrapNavbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto align-items-lg-center">
            {/* NOTIFICATION BELL DROPDOWN */}
            <NavDropdown
              title={
                <span className="position-relative notification-bell">
                  <FaBell size={20} className="text-white" />
                  {unreadCount > 0 && (
                    <Badge 
                      bg="danger" 
                      pill 
                      className="position-absolute top-0 start-100 translate-middle notification-badge"
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Badge>
                  )}
                </span>
              }
              id="notification-dropdown"
              align="end"
              className="notification-dropdown"
            >
              <div className="notification-header px-3 py-2 border-bottom">
                <h6 className="mb-0">
                  Notifikasi
                  {unreadCount > 0 && (
                    <Badge bg="danger" className="ms-2">{unreadCount} baru</Badge>
                  )}
                </h6>
              </div>

              <div className="notification-list">
                {notifications.length === 0 ? (
                  <div className="text-center py-4 text-muted notification-empty">
                    <FaBell size={30} className="mb-2 opacity-50" />
                    <p className="mb-0 small">Tidak ada notifikasi</p>
                  </div>
                ) : (
                  <ListGroup variant="flush">
                    {notifications.slice(0, 10).map((notif) => (
                      <ListGroup.Item
                        key={notif.id}
                        className={`notification-item ${!notif.read ? 'unread' : ''}`}
                        style={{ 
                          backgroundColor: !notif.read ? '#f8f9fa' : 'white',
                          borderLeft: `3px solid ${
                            notif.priority === 'high' ? '#dc3545' :
                            notif.priority === 'medium' ? '#ffc107' : '#0dcaf0'
                          }`
                        }}
                      >
                        <div className="d-flex align-items-start notification-content">
                          <span className="me-2 notification-icon">
                            {getNotificationIcon(notif.type)}
                          </span>
                          <div className="flex-grow-1 notification-body">
                            <div className="d-flex justify-content-between align-items-start notification-header-row">
                              <h6 className="mb-1 small fw-bold notification-title">
                                {notif.title}
                                {!notif.read && (
                                  <Badge bg="primary" className="ms-2 new-badge">
                                    Baru
                                  </Badge>
                                )}
                              </h6>
                              <div className="d-flex gap-1 notification-actions">
                                {!notif.read && (
                                  <Button
                                    variant="link"
                                    size="sm"
                                    className="p-0 text-success action-btn"
                                    onClick={(e) => handleMarkAsRead(notif.id, e)}
                                    title="Tandai sudah dibaca"
                                  >
                                    <FaCheck size={12} />
                                  </Button>
                                )}
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="p-0 text-danger action-btn"
                                  onClick={(e) => handleDeleteNotification(notif.id, e)}
                                  title="Hapus notifikasi"
                                >
                                  <FaTrash size={12} />
                                </Button>
                              </div>
                            </div>
                            <p className="mb-1 small text-muted notification-message">{notif.message}</p>
                            <small className="text-muted notification-time">
                              {notif.createdAt && formatDate(notif.createdAt.toDate())}
                            </small>
                          </div>
                        </div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                )}
              </div>

              {notifications.length > 0 && (
                <div className="notification-footer px-3 py-2 border-top text-center">
                  <small>
                    <Button 
                      variant="link" 
                      className="text-decoration-none p-0 view-all-btn"
                      onClick={() => navigate('/notifications')}
                    >
                      Lihat semua notifikasi
                    </Button>
                  </small>
                </div>
              )}
            </NavDropdown>

            {/* USER DROPDOWN */}
            <NavDropdown
              title={
                <span className="user-dropdown-title">
                  <FaUser className="me-2" />
                  <span className="user-email">
                    {user?.nama || user?.email || user?.username}
                  </span>
                </span>
              }
              id="user-dropdown"
              align="end"
              className="user-dropdown"
            >
              <div className="px-3 py-2 border-bottom">
                <small className="text-muted d-block">Logged in as:</small>
                <strong>{user?.username}</strong>
                {user?.namaAP && (
                  <div className="text-muted small mt-1">{user.namaAP}</div>
                )}
              </div>
              <NavDropdown.Item as={Link} to="/profile">
                <FaUser className="me-2" />
                Profil Saya
              </NavDropdown.Item>
              <NavDropdown.Divider />
              <NavDropdown.Item onClick={handleLogout}>
                <FaSignOutAlt className="me-2" />
                Logout
              </NavDropdown.Item>
            </NavDropdown>

            {/* ✅ UPDATED: ROLE BADGE - Admin & PIC only */}
            {userRole && (
              <Badge bg={getRoleBadgeColor(userRole)} className="ms-2 role-badge">
                {getRoleLabel(userRole)}
              </Badge>
            )}
          </Nav>
        </BootstrapNavbar.Collapse>
      </Container>
    </BootstrapNavbar>
  );
};

export default Navbar;
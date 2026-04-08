import { useState } from 'react';
import { Container, Card, ListGroup, Badge, Button, ButtonGroup, Alert } from 'react-bootstrap';
import { FaBell, FaCheck, FaTrash, FaCheckDouble } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { markAsRead, deleteNotification, markAllAsRead, deleteAllRead } from '../utils/notificationService';
import { formatDate } from '../utils/formatters';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

const NotificationsPage = () => {
  const { user } = useAuth();
  const { notifications, unreadCount } = useNotifications();
  const [filter, setFilter] = useState('all'); // all, unread, read

  const filteredNotifications = notifications.filter(notif => {
    if (filter === 'unread') return !notif.read;
    if (filter === 'read') return notif.read;
    return true;
  });

  const handleMarkAsRead = async (notificationId) => {
    try {
      await markAsRead(notificationId);
      toast.success('Notifikasi ditandai sudah dibaca');
    } catch (error) {
      console.error('Error marking as read:', error);
      toast.error('Gagal menandai notifikasi');
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    if (!window.confirm('Hapus notifikasi ini?')) return;
    
    try {
      await deleteNotification(notificationId);
      toast.success('Notifikasi dihapus');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Gagal menghapus notifikasi');
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) {
      toast.info('Tidak ada notifikasi yang belum dibaca');
      return;
    }

    try {
      await markAllAsRead(user.uid);
      toast.success(`${unreadCount} notifikasi ditandai sudah dibaca`);
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Gagal menandai semua notifikasi');
    }
  };

  const handleDeleteAllRead = async () => {
    const readCount = notifications.filter(n => n.read).length;
    
    if (readCount === 0) {
      toast.info('Tidak ada notifikasi yang sudah dibaca');
      return;
    }

    if (!window.confirm(`Hapus ${readCount} notifikasi yang sudah dibaca?`)) return;

    try {
      await deleteAllRead(user.uid);
      toast.success(`${readCount} notifikasi dihapus`);
    } catch (error) {
      console.error('Error deleting all read:', error);
      toast.error('Gagal menghapus notifikasi');
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success': return <img src="/icon/notif_rendah.png" alt="Success" style={{ width: '20px', height: '20px' }} />;
      case 'error': return <img src="/icon/notif_tinggi.png" alt="Error" style={{ width: '20px', height: '20px' }} />;
      case 'warning': return <img src="/icon/notif_sedang.png" alt="Warning" style={{ width: '20px', height: '20px' }} />;
      case 'announcement': return '📢';
      case 'info': return 'ℹ️';
      default: return '📬';
    }
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      high: <Badge bg="danger">Tinggi</Badge>,
      medium: <Badge bg="warning" text="dark">Sedang</Badge>,
      low: <Badge bg="info">Rendah</Badge>
    };
    return badges[priority] || badges.medium;
  };

  // ✅ UPDATED: Only 2 roles (admin & pic)
  const getTargetRolesBadge = (roles) => {
    const badges = {
      all: <Badge bg="primary">Semua User</Badge>,
      admin: <Badge bg="danger">Admin</Badge>,
      pic: <Badge bg="success">PIC</Badge>
    };
    return badges[roles] || null;
  };

  return (
    <>
      <Navbar />
      <div className="d-flex">
        <Sidebar />
        <div className="flex-grow-1" style={{ marginLeft: '250px', marginTop: '56px' }}>
          <Container className="mt-4">
            {/* ✅ Header with User Info */}
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h2>
                  <FaBell className="me-2" />
                  Semua Notifikasi
                </h2>
                <p className="text-muted mb-0">
                  {unreadCount} notifikasi belum dibaca dari total {notifications.length}
                  {/* ✅ Show role badge */}
                  <Badge bg={user?.role === 'admin' ? 'danger' : 'success'} className="ms-2">
                    {user?.role === 'admin' ? 'Admin' : 'PIC'}
                  </Badge>
                  {/* ✅ Show AP for PIC */}
                  {user?.role === 'pic' && user?.namaAP && (
                    <Badge bg="primary" className="ms-2">{user.namaAP}</Badge>
                  )}
                </p>
              </div>
              <div className="d-flex gap-2">
                <Button 
                  variant="outline-primary" 
                  onClick={handleMarkAllAsRead}
                  disabled={unreadCount === 0}
                >
                  <FaCheckDouble className="me-2" />
                  Tandai Semua Dibaca
                </Button>
                <Button 
                  variant="outline-danger" 
                  onClick={handleDeleteAllRead}
                  disabled={notifications.filter(n => n.read).length === 0}
                >
                  <FaTrash className="me-2" />
                  Hapus Semua yang Dibaca
                </Button>
              </div>
            </div>

            {/* Filter Buttons */}
            <Card className="mb-4">
              <Card.Body>
                <ButtonGroup className="w-100">
                  <Button 
                    variant={filter === 'all' ? 'primary' : 'outline-primary'}
                    onClick={() => setFilter('all')}
                  >
                    Semua ({notifications.length})
                  </Button>
                  <Button 
                    variant={filter === 'unread' ? 'primary' : 'outline-primary'}
                    onClick={() => setFilter('unread')}
                  >
                    Belum Dibaca ({unreadCount})
                  </Button>
                  <Button 
                    variant={filter === 'read' ? 'primary' : 'outline-primary'}
                    onClick={() => setFilter('read')}
                  >
                    Sudah Dibaca ({notifications.length - unreadCount})
                  </Button>
                </ButtonGroup>
              </Card.Body>
            </Card>

            {/* Notifications List */}
            <Card>
              <Card.Body>
                {filteredNotifications.length === 0 ? (
                  <Alert variant="info" className="text-center mb-0">
                    <FaBell size={40} className="mb-2 opacity-50" />
                    <p className="mb-0">
                      {filter === 'unread' ? 'Tidak ada notifikasi yang belum dibaca' :
                       filter === 'read' ? 'Tidak ada notifikasi yang sudah dibaca' :
                       'Belum ada notifikasi'}
                    </p>
                  </Alert>
                ) : (
                  <ListGroup variant="flush">
                    {filteredNotifications.map((notif) => (
                      <ListGroup.Item
                        key={notif.id}
                        className={!notif.read ? 'bg-light' : ''}
                        style={{
                          borderLeft: `4px solid ${
                            notif.priority === 'high' ? '#dc3545' :
                            notif.priority === 'medium' ? '#ffc107' : '#0dcaf0'
                          }`
                        }}
                      >
                        <div className="d-flex align-items-start">
                          <span className="me-3" style={{ fontSize: '1.5rem' }}>
                            {getNotificationIcon(notif.type)}
                          </span>
                          <div className="flex-grow-1">
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <div>
                                <h6 className="mb-1">
                                  {notif.title}
                                  {!notif.read && (
                                    <Badge bg="primary" className="ms-2">Baru</Badge>
                                  )}
                                </h6>
                                <div className="d-flex gap-2 align-items-center flex-wrap">
                                  {getPriorityBadge(notif.priority)}
                                  {/* ✅ Show target roles badge for announcements */}
                                  {notif.type === 'announcement' && notif.targetRoles && getTargetRolesBadge(notif.targetRoles)}
                                </div>
                              </div>
                              <div className="d-flex gap-2">
                                {!notif.read && (
                                  <Button
                                    variant="outline-success"
                                    size="sm"
                                    onClick={() => handleMarkAsRead(notif.id)}
                                    title="Tandai sudah dibaca"
                                  >
                                    <FaCheck />
                                  </Button>
                                )}
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  onClick={() => handleDeleteNotification(notif.id)}
                                  title="Hapus notifikasi"
                                >
                                  <FaTrash />
                                </Button>
                              </div>
                            </div>
                            <p className="mb-2 text-muted">{notif.message}</p>
                            <small className="text-muted">
                              {notif.createdAt && formatDate(notif.createdAt.toDate())}
                            </small>
                          </div>
                        </div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                )}
              </Card.Body>
            </Card>
          </Container>
        </div>
      </div>
    </>
  );
};

export default NotificationsPage;
// src/components/NotificationManager.jsx
import { useState, useEffect } from 'react';
import { Card, Form, Button, ListGroup, Badge, Alert } from 'react-bootstrap';
import { FaBell, FaTrash, FaPaperPlane } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { createAnnouncement } from '../utils/notificationService';
import { collection, query, orderBy, limit, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { toast } from 'react-toastify';
import { formatDate } from '../utils/formatters';

// ✅ UPDATED: NotificationManager untuk 2 roles (admin & pic) - Admin Only Access
const NotificationManager = () => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetRoles, setTargetRoles] = useState('all');
  const [priority, setPriority] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [announcements, setAnnouncements] = useState([]);

  // ✅ SECURITY: Only admin can access this component
  if (user?.role !== 'admin') {
    return (
      <Alert variant="danger">
        <h5>⚠️ Akses Ditolak</h5>
        <p>Hanya Admin yang dapat mengelola notifikasi sistem.</p>
      </Alert>
    );
  }

  // Listen to announcements
  useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const announcementsData = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(notif => notif.type === 'announcement');
      
      setAnnouncements(announcementsData);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title.trim() || !message.trim()) {
      toast.error('❌ Judul dan pesan harus diisi!');
      return;
    }

    setLoading(true);
    try {
      await createAnnouncement(
        user.uid,
        title,
        message,
        targetRoles,
        priority
      );

      toast.success('📢 Pengumuman berhasil dibuat!');
      
      // Reset form
      setTitle('');
      setMessage('');
      setTargetRoles('all');
      setPriority('medium');
    } catch (error) {
      console.error('Error creating announcement:', error);
      toast.error('❌ Gagal membuat pengumuman: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus pengumuman ini?')) return;

    try {
      await deleteDoc(doc(db, 'notifications', id));
      toast.success('✅ Pengumuman berhasil dihapus');
    } catch (error) {
      console.error('Error deleting announcement:', error);
      toast.error('❌ Gagal menghapus pengumuman');
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
    return badges[roles] || badges.all;
  };

  return (
    <div className="notification-manager">
      <Card className="mb-4">
        <Card.Header className="bg-primary text-white">
          <FaBell className="me-2" />
          Buat Pengumuman Baru
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Judul Pengumuman</Form.Label>
              <Form.Control
                type="text"
                placeholder="Masukkan judul pengumuman"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Pesan</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                placeholder="Masukkan isi pengumuman"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </Form.Group>

            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Target Penerima</Form.Label>
                  <Form.Select
                    value={targetRoles}
                    onChange={(e) => setTargetRoles(e.target.value)}
                  >
                    <option value="all">Semua User (Admin + PIC)</option>
                    <option value="admin">Admin Saja</option>
                    <option value="pic">PIC Saja</option>
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Pilih siapa yang akan menerima pengumuman ini
                  </Form.Text>
                </Form.Group>
              </div>

              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Prioritas</Form.Label>
                  <Form.Select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option value="low">Rendah</option>
                    <option value="medium">Sedang</option>
                    <option value="high">Tinggi</option>
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Prioritas menentukan urgensi pengumuman
                  </Form.Text>
                </Form.Group>
              </div>
            </div>

            <Alert variant="info" className="mb-3">
              <small>
                <strong>Info:</strong> Pengumuman akan langsung terkirim ke notification bell (🔔) semua user yang ditargetkan.
              </small>
            </Alert>

            <Button 
              variant="primary" 
              type="submit" 
              disabled={loading}
              className="w-100"
            >
              <FaPaperPlane className="me-2" />
              {loading ? 'Mengirim...' : 'Kirim Pengumuman'}
            </Button>
          </Form>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header className="bg-secondary text-white">
          Riwayat Pengumuman ({announcements.length})
        </Card.Header>
        <Card.Body>
          {announcements.length === 0 ? (
            <Alert variant="info" className="text-center mb-0">
              <FaBell size={30} className="mb-2 opacity-50" />
              <p className="mb-0">Belum ada pengumuman</p>
            </Alert>
          ) : (
            <ListGroup>
              {announcements.map((announcement) => (
                <ListGroup.Item key={announcement.id}>
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="flex-grow-1">
                      <h6 className="mb-1 fw-bold">{announcement.title}</h6>
                      <p className="mb-2 text-muted small">{announcement.message}</p>
                      <div className="d-flex gap-2 align-items-center flex-wrap">
                        {getPriorityBadge(announcement.priority)}
                        {getTargetRolesBadge(announcement.targetRoles)}
                        <small className="text-muted">
                          {announcement.createdAt && formatDate(announcement.createdAt.toDate())}
                        </small>
                        {announcement.createdBy === user?.uid && (
                          <Badge bg="success" className="ms-auto">Oleh Anda</Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleDelete(announcement.id)}
                      title="Hapus pengumuman"
                    >
                      <FaTrash />
                    </Button>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default NotificationManager;
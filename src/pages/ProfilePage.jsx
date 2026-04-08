import { useState, useEffect } from 'react';
import { Container, Card, Form, Button, Alert, Tabs, Tab, Badge, ListGroup } from 'react-bootstrap';
import { FaUser, FaEnvelope, FaLock, FaBell, FaHistory, FaSave, FaCamera, FaBuilding } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { db } from '../config/firebase';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { formatDate } from '../utils/formatters';
import { addNotification } from '../utils/notificationService';

// ✅ UPDATED: ProfilePage untuk 2 roles (admin & pic)
const ProfilePage = () => {
  const { user, logout } = useAuth();
  const { notifications } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [activities, setActivities] = useState([]);

  // Form states
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [namaAP, setNamaAP] = useState('');
  const [singkatanAP, setSingkatanAP] = useState('');
  
  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);

  useEffect(() => {
    loadUserData();
    loadActivities();
  }, [user]);

  const loadUserData = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserData(data);
        setNama(data.nama || '');
        setEmail(data.email || '');
        setNamaAP(data.namaAP || '');
        setSingkatanAP(data.singkatanAP || '');
        setEmailNotifications(data.emailNotifications !== false);
        setPushNotifications(data.pushNotifications !== false);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      toast.error('Gagal memuat data profil');
    }
  };

  const loadActivities = async () => {
    try {
      const userActivities = notifications
        .filter(n => n.userId === user.uid)
        .slice(0, 10);
      
      setActivities(userActivities);
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  };

  const validatePassword = (password) => {
    // Minimal 6 karakter
    if (password.length < 6) {
      return { valid: false, message: 'Password minimal 6 karakter!' };
    }

    // Harus ada huruf
    if (!/[a-zA-Z]/.test(password)) {
      return { valid: false, message: 'Password harus mengandung huruf!' };
    }

    // Harus ada angka
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: 'Password harus mengandung angka!' };
    }

    return { valid: true, message: 'Password valid' };
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!nama.trim()) {
        toast.error('Nama tidak boleh kosong!');
        setLoading(false);
        return;
      }

      if (nama.trim().length < 3) {
        toast.error('Nama minimal 3 karakter!');
        setLoading(false);
        return;
      }

      if (userData.role === 'pic') {
        if (!namaAP.trim()) {
          toast.error('Nama AP tidak boleh kosong untuk PIC!');
          setLoading(false);
          return;
        }
        if (!singkatanAP.trim()) {
          toast.error('Singkatan AP tidak boleh kosong untuk PIC!');
          setLoading(false);
          return;
        }
      }

      const userRef = doc(db, 'users', user.uid);
      const updateData = {
        nama: nama.trim(),
        updatedAt: new Date()
      };

      if (userData.role === 'pic') {
        updateData.namaAP = namaAP.trim();
        updateData.singkatanAP = singkatanAP.trim();
      }

      await updateDoc(userRef, updateData);

      toast.success('Profil berhasil diperbarui!', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });

      await addNotification(
        user.uid,
        'success',
        'Profil Diperbarui',
        `Profil Anda telah berhasil diperbarui pada ${new Date().toLocaleString('id-ID')}.`,
        {
          action: 'profile_updated',
          changes: updateData,
          priority: 'low'
        }
      );

      loadUserData();
    } catch (error) {
      console.error('Error updating profile:', error);
      
      toast.error('Gagal memperbarui profil: ' + error.message, {
        position: "top-right",
        autoClose: 5000,
      });

      await addNotification(
        user.uid,
        'error',
        'Update Profil Gagal',
        `Gagal memperbarui profil: ${error.message}`,
        {
          action: 'profile_update_failed',
          error: error.message,
          priority: 'high'
        }
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!currentPassword) {
      toast.error('Password lama harus diisi!');
      return;
    }

    if (!newPassword) {
      toast.error('Password baru harus diisi!');
      return;
    }

    if (!confirmPassword) {
      toast.error('Konfirmasi password harus diisi!');
      return;
    }

    if (currentPassword === newPassword) {
      toast.error('Password baru harus berbeda dari password lama!');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Password baru dan konfirmasi tidak cocok!');
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      toast.error(validation.message);
      return;
    }

    setLoading(true);

    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );
      
      await reauthenticateWithCredential(user, credential);

      await updatePassword(user, newPassword);

      toast.success('Password berhasil diubah!', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });

      await addNotification(
        user.uid,
        'warning',
        'Password Diubah',
        `Password Anda telah berhasil diubah pada ${new Date().toLocaleString('id-ID')}. Jika bukan Anda yang melakukan ini, segera hubungi admin!`,
        {
          action: 'password_changed',
          timestamp: new Date().toISOString(),
          priority: 'high'
        }
      );
      
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        toast.info('Gunakan password baru Anda untuk login berikutnya.');
      }, 1000);

    } catch (error) {
      console.error('Error changing password:', error);
      
      if (error.code === 'auth/wrong-password') {
        toast.error('Password lama salah! Silakan coba lagi.', {
          position: "top-right",
          autoClose: 5000,
        });
      } else if (error.code === 'auth/weak-password') {
        toast.error('Password terlalu lemah! Gunakan kombinasi huruf dan angka yang lebih kuat.');
      } else if (error.code === 'auth/requires-recent-login') {
        toast.error('Sesi login Anda sudah expired. Silakan logout dan login kembali.');
      } else {
        toast.error('Gagal mengubah password: ' + error.message);
      }

      await addNotification(
        user.uid,
        'error',
        'Gagal Ubah Password',
        `Percobaan ubah password gagal: ${error.code === 'auth/wrong-password' ? 'Password lama salah' : error.message}`,
        {
          action: 'password_change_failed',
          error: error.code,
          priority: 'high'
        }
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateNotificationPreferences = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        emailNotifications,
        pushNotifications,
        updatedAt: new Date()
      });

      toast.success('Preferensi notifikasi diperbarui!', {
        position: "top-right",
        autoClose: 3000,
      });

      await addNotification(
        user.uid,
        'info',
        'Preferensi Notifikasi Diperbarui',
        `Email: ${emailNotifications ? 'Aktif' : 'Nonaktif'}, Push: ${pushNotifications ? 'Aktif' : 'Nonaktif'}`,
        {
          action: 'notification_preferences_updated',
          emailNotifications,
          pushNotifications,
          priority: 'low'
        }
      );

    } catch (error) {
      console.error('Error updating preferences:', error);
      toast.error('Gagal memperbarui preferensi');
    } finally {
      setLoading(false);
    }
  };

  // ✅ UPDATED: Role badge for admin & pic
  const getRoleBadge = (role) => {
    const badges = {
      admin: <Badge bg="danger">Admin</Badge>,
      pic: <Badge bg="primary">PIC</Badge>
    };
    return badges[role] || <Badge bg="secondary">Unknown</Badge>;
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: <Badge bg="success">Active</Badge>,
      inactive: <Badge bg="secondary">Inactive</Badge>,
      suspended: <Badge bg="danger">Suspended</Badge>
    };
    return badges[status] || <Badge bg="secondary">Unknown</Badge>;
  };

  if (!userData) {
    return (
      <>
        <Navbar />
        <div className="d-flex">
          <Sidebar />
          <div className="flex-grow-1" style={{ marginLeft: '250px', marginTop: '56px' }}>
            <Container className="mt-4">
              <Alert variant="info">Loading...</Alert>
            </Container>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <ToastContainer 
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      
      <div className="d-flex">
        <Sidebar />
        <div className="flex-grow-1" style={{ marginLeft: '250px', marginTop: '56px' }}>
          <Container className="mt-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h2>
                <FaUser className="me-2" />
                Profil Saya
              </h2>
            </div>

            {/* Profile Summary Card */}
            <Card className="mb-4 shadow-sm">
              <Card.Body>
                <div className="d-flex align-items-center">
                  <div className="position-relative me-4">
                    <div 
                      className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center"
                      style={{ width: '100px', height: '100px', fontSize: '2rem' }}
                    >
                      {userData.nama?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <Button 
                      variant="light" 
                      size="sm" 
                      className="position-absolute bottom-0 end-0 rounded-circle"
                      style={{ width: '30px', height: '30px' }}
                    >
                      <FaCamera size={12} />
                    </Button>
                  </div>
                  <div className="flex-grow-1">
                    <h4 className="mb-1">{userData.nama}</h4>
                    <p className="text-muted mb-2">{userData.email}</p>
                    <div className="d-flex gap-2 flex-wrap">
                      {getRoleBadge(userData.role)}
                      {getStatusBadge(userData.status)}
                      {/* ✅ Show AP badges for PIC */}
                      {userData.role === 'pic' && (
                        <>
                          {userData.namaAP && (
                            <Badge bg="info">
                              <FaBuilding className="me-1" />
                              {userData.namaAP}
                            </Badge>
                          )}
                          {userData.singkatanAP && (
                            <Badge bg="secondary">{userData.singkatanAP}</Badge>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-end">
                    <small className="text-muted">
                      Bergabung sejak<br />
                      {userData.createdAt && formatDate(userData.createdAt.toDate())}
                    </small>
                  </div>
                </div>
              </Card.Body>
            </Card>

            {/* Tabs */}
            <Tabs defaultActiveKey="info" className="mb-4">
              {/* Tab 1: Informasi Profil */}
              <Tab eventKey="info" title={<span><FaUser className="me-2" />Informasi Profil</span>}>
                <Card>
                  <Card.Body>
                    <Form onSubmit={handleUpdateProfile}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          Nama Lengkap <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={nama}
                          onChange={(e) => setNama(e.target.value)}
                          placeholder="Masukkan nama lengkap"
                          required
                          minLength={3}
                        />
                        <Form.Text className="text-muted">
                          Minimal 3 karakter
                        </Form.Text>
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Email</Form.Label>
                        <Form.Control
                          type="email"
                          value={email}
                          disabled
                          className="bg-light"
                        />
                        <Form.Text className="text-muted">
                          Email tidak dapat diubah. Hubungi admin jika perlu.
                        </Form.Text>
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Role</Form.Label>
                        <Form.Control
                          type="text"
                          value={userData.role.toUpperCase()}
                          disabled
                          className="bg-light"
                        />
                        <Form.Text className="text-muted">
                          Role ditentukan oleh admin.
                        </Form.Text>
                      </Form.Group>

                      {/* ✅ AP Fields (ONLY for PIC) */}
                      {userData.role === 'pic' && (
                        <>
                          <Alert variant="info" className="mb-3">
                            <FaBuilding className="me-2" />
                            <strong>Area Pengelola (AP)</strong>
                          </Alert>

                          <Form.Group className="mb-3">
                            <Form.Label>
                              Nama AP <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Control
                              type="text"
                              value={namaAP}
                              onChange={(e) => setNamaAP(e.target.value)}
                              placeholder="Contoh: Jakarta-Cikampek"
                              required={userData.role === 'pic'}
                              disabled
                              className="bg-light"
                            />
                            <Form.Text className="text-muted">
                              Nama AP tidak dapat diubah. Hubungi admin jika salah.
                            </Form.Text>
                          </Form.Group>

                          <Form.Group className="mb-3">
                            <Form.Label>
                              Singkatan AP <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Control
                              type="text"
                              value={singkatanAP}
                              onChange={(e) => setSingkatanAP(e.target.value)}
                              placeholder="Contoh: JKC"
                              required={userData.role === 'pic'}
                              disabled
                              className="bg-light"
                            />
                            <Form.Text className="text-muted">
                              Singkatan AP tidak dapat diubah. Hubungi admin jika salah.
                            </Form.Text>
                          </Form.Group>
                        </>
                      )}

                      <Button 
                        variant="primary" 
                        type="submit" 
                        disabled={loading}
                      >
                        <FaSave className="me-2" />
                        {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                      </Button>
                    </Form>
                  </Card.Body>
                </Card>
              </Tab>

              {/* Tab 2: Ubah Password */}
              <Tab eventKey="password" title={<span><FaLock className="me-2" />Keamanan</span>}>
                <Card>
                  <Card.Body>
                    <Form onSubmit={handleChangePassword}>
                      <Alert variant="info">
                        <strong>Syarat Password:</strong>
                        <ul className="mb-0 mt-2">
                          <li>Minimal 6 karakter</li>
                          <li>Harus mengandung huruf (a-z atau A-Z)</li>
                          <li>Harus mengandung angka (0-9)</li>
                          <li>Password baru harus berbeda dari password lama</li>
                        </ul>
                      </Alert>

                      <Form.Group className="mb-3">
                        <Form.Label>
                          Password Lama <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Masukkan password lama"
                          required
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>
                          Password Baru <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Masukkan password baru"
                          required
                          minLength={6}
                        />
                        <Form.Text className="text-muted">
                          Minimal 6 karakter, harus ada huruf dan angka
                        </Form.Text>
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>
                          Konfirmasi Password Baru <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Ulangi password baru"
                          required
                          minLength={6}
                        />
                        {confirmPassword && newPassword !== confirmPassword && (
                          <Form.Text className="text-danger">
                            ❌ Password tidak cocok!
                          </Form.Text>
                        )}
                        {confirmPassword && newPassword === confirmPassword && (
                          <Form.Text className="text-success">
                            ✅ Password cocok!
                          </Form.Text>
                        )}
                      </Form.Group>

                      <Button 
                        variant="primary" 
                        type="submit" 
                        disabled={loading}
                      >
                        <FaLock className="me-2" />
                        {loading ? 'Mengubah...' : 'Ubah Password'}
                      </Button>
                    </Form>
                  </Card.Body>
                </Card>
              </Tab>

              {/* Tab 3: Notifikasi */}
              <Tab eventKey="notifications" title={<span><FaBell className="me-2" />Notifikasi</span>}>
                <Card>
                  <Card.Body>
                    <Form onSubmit={handleUpdateNotificationPreferences}>
                      <Form.Group className="mb-3">
                        <Form.Check
                          type="switch"
                          id="email-notifications"
                          label="Notifikasi Email"
                          checked={emailNotifications}
                          onChange={(e) => setEmailNotifications(e.target.checked)}
                        />
                        <Form.Text className="text-muted">
                          Terima notifikasi penting melalui email
                        </Form.Text>
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Check
                          type="switch"
                          id="push-notifications"
                          label="Notifikasi Push"
                          checked={pushNotifications}
                          onChange={(e) => setPushNotifications(e.target.checked)}
                        />
                        <Form.Text className="text-muted">
                          Terima notifikasi real-time di aplikasi
                        </Form.Text>
                      </Form.Group>

                      <Button 
                        variant="primary" 
                        type="submit" 
                        disabled={loading}
                      >
                        <FaSave className="me-2" />
                        {loading ? 'Menyimpan...' : 'Simpan Preferensi'}
                      </Button>
                    </Form>
                  </Card.Body>
                </Card>
              </Tab>

              {/* Tab 4: Aktivitas */}
              <Tab eventKey="activity" title={<span><FaHistory className="me-2" />Aktivitas</span>}>
                <Card>
                  <Card.Body>
                    <h5 className="mb-3">Riwayat Aktivitas Terakhir</h5>
                    {activities.length === 0 ? (
                      <Alert variant="info">Belum ada aktivitas</Alert>
                    ) : (
                      <ListGroup>
                        {activities.map((activity) => (
                          <ListGroup.Item key={activity.id}>
                            <div className="d-flex justify-content-between align-items-start">
                              <div>
                                <h6 className="mb-1">{activity.title}</h6>
                                <p className="mb-1 text-muted small">{activity.message}</p>
                                <small className="text-muted">
                                  {activity.createdAt && formatDate(activity.createdAt.toDate())}
                                </small>
                              </div>
                              <Badge bg={
                                activity.type === 'success' ? 'success' :
                                activity.type === 'error' ? 'danger' :
                                activity.type === 'warning' ? 'warning' :
                                'info'
                              }>
                                {activity.type}
                              </Badge>
                            </div>
                          </ListGroup.Item>
                        ))}
                      </ListGroup>
                    )}
                  </Card.Body>
                </Card>
              </Tab>
            </Tabs>
          </Container>
        </div>
      </div>
    </>
  );
};

export default ProfilePage;
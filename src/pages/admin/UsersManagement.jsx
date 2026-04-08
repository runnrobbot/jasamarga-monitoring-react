import { useState, useEffect } from 'react';
import { Container, Card, Button, Table, Modal, Form, Badge, Spinner, Alert, Row, Col, InputGroup } from 'react-bootstrap';
import { collection, getDocs, setDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { 
  createUserWithEmailAndPassword,
  initializeAuth,
  getAuth
} from 'firebase/auth';
import { getApp } from 'firebase/app';
import { useAuth } from '../../contexts/AuthContext';
import NavigationBar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import { FaEdit, FaTrash, FaUserPlus, FaKey, FaCheckCircle, FaSearch, FaUsers, FaUserShield, FaBuilding } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { addNotification } from '../../utils/notificationService';
import './UsersManagement.css';

const UsersManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [masterAPList, setMasterAPList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [creatingUser, setCreatingUser] = useState(false);
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    nama: '',
    email: '',
    namaAP: '',
    singkatanAP: '',
    role: 'pic',
    status: 'active'
  });
  
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    message: '',
    color: ''
  });

  useEffect(() => {
    fetchMasterAP();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(u => 
        u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.nama?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.namaAP?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.role?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, users]);

  const fetchMasterAP = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'masterAP'));
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(ap => ap.isActive);
      setMasterAPList(data);
    } catch (error) {
      console.error('Error fetching Master AP:', error);
      toast.error('Gagal memuat Master AP');
    }
  };

  const fetchUsers = async () => {
    try {
      console.log('Fetching users...');
      const usersSnapshot = await getDocs(collection(db, 'users'));
      
      const usersList = usersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data
        };
      });
      
      console.log('Fetched users:', usersList);
      setUsers(usersList);
      setFilteredUsers(usersList);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Gagal memuat data user');
      setLoading(false);
    }
  };

  const checkPasswordStrength = (password) => {
    if (!password) {
      return { score: 0, message: '', color: '' };
    }

    let score = 0;
    let message = '';
    let color = '';

    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 2) {
      message = 'Lemah';
      color = 'danger';
    } else if (score <= 4) {
      message = 'Sedang';
      color = 'warning';
    } else {
      message = 'Kuat';
      color = 'success';
    }

    return { score, message, color };
  };

  const handleShowModal = (userToEdit = null) => {
    if (userToEdit) {
      setEditMode(true);
      setSelectedUser(userToEdit);
      setFormData({
        username: userToEdit.username,
        password: '',
        nama: userToEdit.nama || '',
        email: userToEdit.email || '',
        namaAP: userToEdit.namaAP || '',
        singkatanAP: userToEdit.singkatanAP || '',
        role: userToEdit.role,
        status: userToEdit.status
      });
    } else {
      setEditMode(false);
      setSelectedUser(null);
      setFormData({
        username: '',
        password: '',
        nama: '',
        email: '',
        namaAP: '',
        singkatanAP: '',
        role: 'pic',
        status: 'active'
      });
    }
    setPasswordStrength({ score: 0, message: '', color: '' });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditMode(false);
    setSelectedUser(null);
    setFormData({
      username: '',
      password: '',
      nama: '',
      email: '',
      namaAP: '',
      singkatanAP: '',
      role: 'pic',
      status: 'active'
    });
    setPasswordStrength({ score: 0, message: '', color: '' });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'namaAP') {
      const selectedAP = masterAPList.find(ap => ap.namaAP === value);
      setFormData(prev => ({
        ...prev,
        namaAP: value,
        singkatanAP: selectedAP?.singkatanAP || ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }

    if (name === 'password') {
      const strength = checkPasswordStrength(value);
      setPasswordStrength(strength);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (creatingUser) {
      console.log('Already creating user, please wait...');
      return;
    }
    
    if (!formData.email || !formData.email.trim()) {
      toast.error('Email wajib diisi untuk login ke sistem');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Format email tidak valid');
      return;
    }
    
    if (formData.role === 'pic') {
      if (!formData.namaAP || !formData.singkatanAP) {
        toast.error('PIC harus memiliki Nama AP dan Singkatan AP');
        return;
      }
    }
    
    try {
      if (editMode) {
        // ============================================
        // EDIT EXISTING USER
        // ============================================
        const userRef = doc(db, 'users', selectedUser.id);
        const oldStatus = selectedUser.status;
        const oldRole = selectedUser.role;
        
        const updateData = {
          nama: formData.nama,
          namaAP: formData.namaAP || null,
          singkatanAP: formData.singkatanAP || null,
          role: formData.role,
          status: formData.status,
          updatedAt: new Date()
        };
        
        if (formData.password && formData.password.trim() !== '') {
          const strength = checkPasswordStrength(formData.password);
          if (strength.score < 3) {
            toast.warning('Gunakan password yang lebih kuat untuk keamanan yang lebih baik');
          }

          toast.warning('Update password untuk user lain memerlukan Firebase Admin SDK. Password tidak diupdate.');
          
          await addNotification(
            selectedUser.id,
            'warning',
            'Password Perlu Diubah',
            'Admin mencoba mengubah password Anda. Silakan hubungi admin untuk reset password.',
            {
              action: 'password_change_attempt',
              priority: 'high'
            }
          );
        }
        
        await updateDoc(userRef, updateData);
        
        if (oldStatus !== formData.status) {
          if (formData.status === 'active') {
            await addNotification(
              selectedUser.id,
              'success',
              'Akun Diaktifkan',
              'Akun Anda telah diaktifkan oleh admin.',
              {
                action: 'account_activated',
                priority: 'high'
              }
            );
            toast.success(`User ${formData.nama} diaktifkan`);
          } else {
            await addNotification(
              selectedUser.id,
              'warning',
              'Akun Dinonaktifkan',
              'Akun Anda telah dinonaktifkan oleh admin.',
              {
                action: 'account_deactivated',
                priority: 'high'
              }
            );
            toast.warning(`User ${formData.nama} dinonaktifkan`);
          }
        }
        
        if (oldRole !== formData.role) {
          await addNotification(
            selectedUser.id,
            'info',
            'Role Diperbarui',
            `Role Anda telah diubah dari "${oldRole}" menjadi "${formData.role}".`,
            {
              action: 'role_changed',
              oldRole: oldRole,
              newRole: formData.role,
              priority: 'medium'
            }
          );
        }
        
        toast.success('User berhasil diupdate');
        handleCloseModal();
        fetchUsers();
        
      } else {
        // ============================================
        // CREATE NEW USER - USING IFRAME METHOD
        // ============================================
        
        setCreatingUser(true);
        
        const existingUser = users.find(u => u.username === formData.username);
        if (existingUser) {
          toast.error('Username sudah digunakan');
          setCreatingUser(false);
          return;
        }

        const existingEmail = users.find(u => u.email === formData.email);
        if (existingEmail) {
          toast.error('Email sudah digunakan');
          setCreatingUser(false);
          return;
        }

        const strength = checkPasswordStrength(formData.password);
        if (strength.score < 3) {
          toast.warning('Password terlalu lemah. Gunakan kombinasi huruf besar, kecil, angka, dan simbol');
          setCreatingUser(false);
          return;
        }
        
        toast.info('Membuat user di Firebase Authentication...');
        
        try {
          
          const firebaseApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
          
          // Create user via Firebase Auth REST API
          const signUpResponse = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseApiKey}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                email: formData.email,
                password: formData.password,
                returnSecureToken: true
              })
            }
          );

          if (!signUpResponse.ok) {
            const errorData = await signUpResponse.json();
            throw new Error(errorData.error?.message || 'Failed to create user');
          }

          const signUpData = await signUpResponse.json();
          const firebaseUid = signUpData.localId;
          
          console.log('✅ Firebase Auth user created:', firebaseUid);
          
          // ✅ Create user document in Firestore (admin is still authenticated)
          const userRef = doc(db, 'users', firebaseUid);
          const newUserData = {
            uid: firebaseUid,
            username: formData.username,
            nama: formData.nama,
            email: formData.email,
            namaAP: formData.namaAP || null,
            singkatanAP: formData.singkatanAP || null,
            role: formData.role,
            status: formData.status,
            emailVerified: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: user?.uid || 'system'
          };
          
          await setDoc(userRef, newUserData);
          console.log('✅ Firestore user document created');
          
          // ✅ Send welcome notification
          try {
            await addNotification(
              firebaseUid,
              'success',
              'Selamat Datang',
              `Halo ${formData.nama}, akun Anda telah berhasil dibuat. Username: ${formData.username}${formData.role === 'pic' ? `. AP: ${formData.namaAP}` : ''}`,
              {
                action: 'user_registered',
                role: formData.role,
                priority: 'high'
              }
            );
          } catch (notifError) {
            console.warn('Warning: Could not send welcome notification:', notifError);
          }

          toast.success('User baru berhasil ditambahkan! User dapat login dengan username dan password yang telah dibuat');

          handleCloseModal();

          setTimeout(async () => {
            await fetchUsers();
            setCreatingUser(false);
          }, 1000);
          
        } catch (authError) {
          console.error('Error in user creation flow:', authError);
          setCreatingUser(false);
          
          // Handle Firebase REST API errors
          if (authError.message.includes('EMAIL_EXISTS')) {
            toast.error('Email sudah digunakan di Firebase Authentication');
          } else if (authError.message.includes('INVALID_EMAIL')) {
            toast.error('Format email tidak valid');
          } else if (authError.message.includes('WEAK_PASSWORD')) {
            toast.error('Password terlalu lemah (minimal 6 karakter)');
          } else {
            toast.error(authError.message || 'Gagal membuat user di Firebase Authentication');
          }
          
          throw authError;
        }
      }
    } catch (error) {
      console.error('Error saving user:', error);
      setCreatingUser(false);
      
      if (!error.message || (!error.message.includes('EMAIL_') && !error.message.includes('INVALID_') && !error.message.includes('WEAK_'))) {
        toast.error(error.message || 'Gagal menyimpan data user');
      }
    }
  };

  const handleDelete = async (userId) => {
    const userToDelete = users.find(u => u.id === userId);
    
    if (window.confirm(`Apakah Anda yakin ingin menghapus user "${userToDelete?.nama || userToDelete?.username}"?\n\nCatatan: User akan dihapus dari Firestore. Untuk keamanan penuh, hapus juga dari Firebase Authentication Console.`)) {
      try {
        await deleteDoc(doc(db, 'users', userId));
        
        toast.success('User berhasil dihapus dari Firestore');
        toast.info('Jangan lupa hapus user dari Firebase Authentication Console untuk keamanan penuh', {
          autoClose: 5000
        });
        
        fetchUsers();
      } catch (error) {
        console.error('Error deleting user:', error);
        toast.error('Gagal menghapus user');
      }
    }
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    const targetUser = users.find(u => u.id === userId);
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        status: newStatus,
        updatedAt: new Date()
      });
      
      if (newStatus === 'active') {
        await addNotification(
          userId,
          'success',
          'Akun Diaktifkan',
          'Akun Anda telah diaktifkan oleh admin.',
          {
            action: 'account_activated',
            priority: 'high'
          }
        );
        toast.success(`User ${targetUser.nama} diaktifkan`);
      } else {
        await addNotification(
          userId,
          'warning',
          'Akun Dinonaktifkan',
          'Akun Anda telah dinonaktifkan oleh admin.',
          {
            action: 'account_deactivated',
            priority: 'high'
          }
        );
        toast.warning(`User ${targetUser.nama} dinonaktifkan`);
      }
      
      fetchUsers();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Gagal mengubah status user');
    }
  };

  const getRoleBadge = (role) => {
    const config = {
      admin: { bg: 'danger', icon: FaUserShield, label: 'Admin' },
      pic: { bg: 'primary', icon: FaBuilding, label: 'PIC' }
    };
    const roleConfig = config[role] || { bg: 'secondary', icon: FaUsers, label: role };
    const Icon = roleConfig.icon;
    
    return (
      <Badge bg={roleConfig.bg} className="d-inline-flex align-items-center gap-1">
        <Icon size={12} />
        {roleConfig.label}
      </Badge>
    );
  };

  const getStatistics = () => {
    return {
      total: users.length,
      admin: users.filter(u => u.role === 'admin').length,
      pic: users.filter(u => u.role === 'pic').length,
      active: users.filter(u => u.status === 'active').length,
      inactive: users.filter(u => u.status === 'inactive').length
    };
  };

  const stats = getStatistics();

  return (
    <>
      <NavigationBar />
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="d-flex">
        <Sidebar />
        <main className="main-content">
          <Container fluid className="py-4">
            {/* Header */}
            <Row className="mb-4">
              <Col>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h2 className="fw-bold mb-1">
                      <FaUsers className="me-2 text-primary" />
                      Kelola User
                    </h2>
                    <p className="text-muted mb-0">
                      Manajemen pengguna sistem (Admin & PIC)
                    </p>
                  </div>
                  <Button 
                    variant="primary" 
                    size="lg"
                    onClick={() => handleShowModal()}
                    className="shadow-sm"
                    disabled={creatingUser}
                  >
                    <FaUserPlus className="me-2" />
                    Tambah User
                  </Button>
                </div>
              </Col>
            </Row>

            {/* Statistics Cards */}
            <Row className="mb-4 g-3">
              <Col lg={3} md={6}>
                <Card className="stat-card border-0 shadow-sm h-100">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <p className="text-muted mb-1 small">Total User</p>
                        <h3 className="fw-bold mb-0">{stats.total}</h3>
                      </div>
                      <div className="stat-icon bg-primary">
                        <FaUsers />
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col lg={3} md={6}>
                <Card className="stat-card border-0 shadow-sm h-100">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <p className="text-muted mb-1 small">Admin</p>
                        <h3 className="fw-bold mb-0 text-danger">{stats.admin}</h3>
                      </div>
                      <div className="stat-icon bg-danger">
                        <FaUserShield />
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col lg={3} md={6}>
                <Card className="stat-card border-0 shadow-sm h-100">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <p className="text-muted mb-1 small">PIC</p>
                        <h3 className="fw-bold mb-0 text-primary">{stats.pic}</h3>
                      </div>
                      <div className="stat-icon bg-primary">
                        <FaBuilding />
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col lg={3} md={6}>
                <Card className="stat-card border-0 shadow-sm h-100">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <p className="text-muted mb-1 small">Aktif</p>
                        <h3 className="fw-bold mb-0 text-success">{stats.active}</h3>
                      </div>
                      <div className="stat-icon bg-success">
                        <FaCheckCircle />
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Search Bar */}
            <Row className="mb-4">
              <Col lg={6}>
                <Card className="border-0 shadow-sm">
                  <Card.Body>
                    <Form.Group>
                      <Form.Label className="fw-bold">
                        Cari User
                      </Form.Label>
                      <InputGroup size="lg">
                        <InputGroup.Text>
                          <FaSearch />
                        </InputGroup.Text>
                        <Form.Control
                          type="text"
                          placeholder="Cari berdasarkan username, nama, email, AP, atau role..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </InputGroup>
                      {searchTerm && (
                        <Form.Text className="text-muted">
                          Menampilkan {filteredUsers.length} dari {users.length} user
                        </Form.Text>
                      )}
                    </Form.Group>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Users Table */}
            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-white border-0 py-3">
                <h5 className="mb-0 fw-bold">Daftar User</h5>
              </Card.Header>
              <Card.Body className="p-0">
                {loading ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-2 text-muted">Memuat data...</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-5">
                    <FaSearch size={40} className="mb-2 opacity-50 text-muted" />
                    <p className="text-muted">
                      {searchTerm 
                        ? `Tidak ada user yang cocok dengan "${searchTerm}"`
                        : 'Belum ada data user. Klik "Tambah User" untuk menambahkan.'}
                    </p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <Table hover className="mb-0 align-middle modern-table">
                      <thead className="table-light">
                        <tr>
                          <th className="text-center" style={{ width: '60px' }}>No</th>
                          <th>Username</th>
                          <th>Nama Lengkap</th>
                          <th>Nama AP</th>
                          <th>Email</th>
                          <th className="text-center">Role</th>
                          <th className="text-center">Status</th>
                          <th className="text-center" style={{ width: '120px' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((u, index) => (
                          <tr key={u.id} className="user-row">
                            <td className="text-center text-muted">{index + 1}</td>
                            <td>
                              <div className="d-flex align-items-center">
                                <div className="user-avatar me-2">
                                  {u.username?.charAt(0).toUpperCase() || '?'}
                                </div>
                                <span className="fw-medium">{u.username}</span>
                              </div>
                            </td>
                            <td className="fw-medium">{u.nama || '-'}</td>
                            <td>
                              {u.namaAP ? (
                                <div>
                                  <small className="text-muted d-block">{u.namaAP}</small>
                                  {u.singkatanAP && (
                                    <Badge bg="secondary" className="mt-1">{u.singkatanAP}</Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            <td>
                              <span className="text-muted small">{u.email || '-'}</span>
                            </td>
                            <td className="text-center">
                              {getRoleBadge(u.role)}
                            </td>
                            <td className="text-center">
                              <Badge 
                                bg={u.status === 'active' ? 'success' : 'danger'}
                                className="status-badge"
                                style={{ cursor: 'pointer' }}
                                onClick={() => handleToggleStatus(u.id, u.status)}
                                title={`Klik untuk ${u.status === 'active' ? 'nonaktifkan' : 'aktifkan'}`}
                              >
                                {u.status === 'active' ? (
                                  <>
                                    <FaCheckCircle className="me-1" />
                                    Aktif
                                  </>
                                ) : (
                                  'Nonaktif'
                                )}
                              </Badge>
                            </td>
                            <td className="text-center">
                              <div className="d-flex gap-1 justify-content-center">
                                <Button
                                  variant="warning"
                                  size="sm"
                                  onClick={() => handleShowModal(u)}
                                  title="Edit user"
                                  className="action-btn"
                                >
                                  <FaEdit />
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => handleDelete(u.id)}
                                  disabled={u.id === user?.uid}
                                  title="Hapus user"
                                  className="action-btn"
                                >
                                  <FaTrash />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Container>
        </main>
      </div>

      {/* Add/Edit User Modal */}
      <Modal show={showModal} onHide={handleCloseModal} centered size="lg" backdrop="static">
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title>
            {editMode ? (
              <>
                <FaEdit className="me-2 text-warning" />
                Edit User
              </>
            ) : (
              <>
                <FaUserPlus className="me-2 text-primary" />
                Tambah User Baru
              </>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-0">
          <Form onSubmit={handleSubmit}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Username <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                    disabled={editMode}
                    placeholder="Username untuk referensi"
                  />
                  {editMode && (
                    <Form.Text className="text-muted">
                      Username tidak dapat diubah
                    </Form.Text>
                  )}
                  {!editMode && (
                    <Form.Text className="text-muted">
                      Digunakan untuk login
                    </Form.Text>
                  )}
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FaKey className="me-2" />
                    Password {editMode && '(Kosongkan jika tidak ingin mengubah)'}
                    {!editMode && <span className="text-danger"> *</span>}
                  </Form.Label>
                  <Form.Control
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required={!editMode}
                    minLength={6}
                    placeholder={editMode ? "Kosongkan jika tidak ingin mengubah" : "Minimal 6 karakter"}
                  />
                  {formData.password && (
                    <div className="mt-2">
                      <small>Kekuatan: </small>
                      <Badge bg={passwordStrength.color} className="ms-1">
                        {passwordStrength.message}
                      </Badge>
                    </div>
                  )}
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Nama Lengkap <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="text"
                    name="nama"
                    value={formData.nama}
                    onChange={handleInputChange}
                    required
                    placeholder="Nama lengkap"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Email <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    disabled={editMode}
                    placeholder="email@jasamarga.com"
                  />
                  <Form.Text className="text-muted">
                    {editMode ? 'Email tidak dapat diubah' : 'Hanya untuk identifikasi, login menggunakan username'}
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Role <span className="text-danger">*</span></Form.Label>
                  <Form.Select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="pic">PIC</option>
                    <option value="admin">Admin</option>
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Hanya 2 role: Admin & PIC
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Status <span className="text-danger">*</span></Form.Label>
                  <Form.Select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            {formData.role === 'pic' && (
              <>
                <Alert variant="info" className="mb-3">
                  <FaBuilding className="me-2" />
                  <strong>Info PIC:</strong> User dengan role PIC harus memilih AP yang akan dikelola.
                </Alert>

                <Row>
                  <Col md={8}>
                    <Form.Group className="mb-3">
                      <Form.Label>Nama AP <span className="text-danger">*</span></Form.Label>
                      <Form.Select
                        name="namaAP"
                        value={formData.namaAP}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="">Pilih Nama AP</option>
                        {masterAPList.map(ap => (
                          <option key={ap.id} value={ap.namaAP}>
                            {ap.namaAP}
                          </option>
                        ))}
                      </Form.Select>
                      <Form.Text className="text-muted">
                        PIC hanya bisa mengelola data AP yang dipilih
                      </Form.Text>
                    </Form.Group>
                  </Col>

                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Singkatan <span className="text-danger">*</span></Form.Label>
                      <Form.Control
                        type="text"
                        name="singkatanAP"
                        value={formData.singkatanAP}
                        onChange={handleInputChange}
                        placeholder="JBT"
                        maxLength={10}
                        required
                        readOnly
                        className="text-uppercase"
                      />
                      <Form.Text className="text-muted">
                        Auto-filled
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
              </>
            )}

            {creatingUser && (
              <Alert variant="warning" className="mb-3">
                <Spinner animation="border" size="sm" className="me-2" />
                Sedang membuat user... Mohon tunggu dan jangan tutup halaman ini.
              </Alert>
            )}

            <div className="d-flex gap-2 justify-content-end mt-4">
              <Button 
                variant="secondary" 
                onClick={handleCloseModal}
                disabled={creatingUser}
              >
                Batal
              </Button>
              <Button 
                variant="primary" 
                type="submit"
                disabled={creatingUser}
              >
                {creatingUser ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Membuat User...
                  </>
                ) : editMode ? (
                  <>
                    <FaCheckCircle className="me-2" />
                    Update User
                  </>
                ) : (
                  <>
                    <FaUserPlus className="me-2" />
                    Tambah User
                  </>
                )}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default UsersManagement;
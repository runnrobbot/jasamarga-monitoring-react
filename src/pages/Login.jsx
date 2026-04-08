import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FaUser, FaLock, FaRoad, FaShieldAlt } from 'react-icons/fa';
import './Login.css';

// ✅ UPDATED: Login with role-based redirection (preserving Jasa Marga design)
const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { user, login, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // ✅ REDIRECT LOGIC: Based on user role
  useEffect(() => {
    if (user && !authLoading) {
      console.log('🔄 User logged in, redirecting based on role:', user.role);
      
      if (user.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else if (user.role === 'pic') {
        navigate('/pic/dashboard', { replace: true });
      } else {
        // Invalid role
        console.warn('⚠️ Invalid role detected:', user.role);
        navigate('/unauthorized', { replace: true });
      }
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username || !password) {
      setError('Username dan password harus diisi');
      return;
    }

    try {
      setError('');
      setLoading(true);
      
      console.log('🔐 Attempting login for:', username);
      
      // ✅ Login with username
      const result = await login(username, password);
      
      if (result.success) {
        const userRole = result.user.role;
        console.log('✅ Login successful, user role:', userRole);
        
        // ✅ Small delay to let onAuthStateChanged update state
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // ✅ ROLE-BASED REDIRECT
        if (userRole === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else if (userRole === 'pic') {
          navigate('/pic/dashboard', { replace: true });
        } else {
          console.error('❌ Invalid role after login:', userRole);
          setError('Role tidak valid. Hubungi administrator.');
          
          setTimeout(() => {
            navigate('/unauthorized', { replace: true });
          }, 2000);
        }
      }
    } catch (err) {
      if (err.message) {
        setError(err.message);
      } else {
        setError('Login gagal. Periksa username dan password Anda.');
      }
      console.error('❌ Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Show loading spinner during auth check
  if (authLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #003d7a 0%, #005a9c 50%, #0078d4 100%)' }}>
        <div className="text-center">
          <div className="spinner-border text-white mb-3" style={{ width: '3rem', height: '3rem' }} role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-white">Memuat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      {/* Left Side - Branding */}
      <div className="login-left">
        <div className="branding-content">
          <div className="logo-container">
            <img 
              src="/logo2.png" 
              alt="Jasa Marga" 
              className="brand-logo" 
            />
            <div className="logo-divider"></div>
            <img 
              src="/logo1.png" 
              alt="AP Monitoring" 
              className="secondary-logo" 
            />
          </div>
          <h1 className="brand-title">AP Monitoring System</h1>
          <p className="brand-subtitle">PT Jasa Marga (Persero) Tbk</p>
          <div className="brand-divider"></div>
          <p className="brand-description">
            Sistem monitoring dan manajemen komitmen Area Pengelola secara terintegrasi dan real-time
          </p>
          
          <div className="features-list">
            <div className="feature-item">
              <FaShieldAlt className="feature-icon" />
              <span>Secure & Reliable</span>
            </div>
            <div className="feature-item">
              <FaRoad className="feature-icon" />
              <span>Real-time Monitoring</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="login-right">
        <Container>
          <Row className="justify-content-center">
            <Col lg={10} xl={8}>
              <Card className="login-card">
                <Card.Body className="p-5">
                  <div className="text-center mb-4">
                    <div className="welcome-badge">
                      <span className="badge-dot"></span>
                      Selamat Datang
                    </div>
                    <h3 className="login-title">Login ke Dashboard</h3>
                    <p className="login-subtitle">Masukkan kredensial Anda untuk melanjutkan</p>
                  </div>

                  {error && (
                    <Alert variant="danger" className="alert-custom">
                      <i className="fas fa-exclamation-circle me-2"></i>
                      {error}
                    </Alert>
                  )}

                  <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-4">
                      <Form.Label className="form-label-custom">
                        <FaUser className="me-2" />
                        Username
                      </Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Masukkan username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="form-control-custom"
                        required
                        autoComplete="username"
                        disabled={loading}
                      />
                    </Form.Group>

                    <Form.Group className="mb-4">
                      <Form.Label className="form-label-custom">
                        <FaLock className="me-2" />
                        Password
                      </Form.Label>
                      <div className="password-input-wrapper">
                        <Form.Control
                          type={showPassword ? "text" : "password"}
                          placeholder="Masukkan password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="form-control-custom"
                          required
                          autoComplete="current-password"
                          disabled={loading}
                        />
                        <button
                          type="button"
                          className="password-toggle"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label="Toggle password visibility"
                          disabled={loading}
                        >
                          {showPassword ? '👁️' : '👁️‍🗨️'}
                        </button>
                      </div>
                    </Form.Group>

                    <div className="d-flex justify-content-between align-items-center mb-4">
                      <Form.Check
                        type="checkbox"
                        label="Ingat saya"
                        className="remember-check"
                        disabled={loading}
                      />
                    </div>

                    <Button
                      type="submit"
                      className="btn-login w-100"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Memproses...
                        </>
                      ) : (
                        <>
                          <FaShieldAlt className="me-2" />
                          Login Sekarang
                        </>
                      )}
                    </Button>
                  </Form>

                  <div className="text-center mt-4">
                    <p className="text-muted small">
                      Belum punya akun? Hubungi administrator untuk membuat akun baru.
                    </p>
                  </div>

                  <div className="footer-links">
                    <a href="#" className="footer-link">Privacy Policy</a>
                    <span className="footer-divider">•</span>
                    <a href="#" className="footer-link">Terms of Service</a>
                    <span className="footer-divider">•</span>
                    <a href="#" className="footer-link">Help</a>
                  </div>
                </Card.Body>
              </Card>

              <div className="copyright-text">
                © 2026 PT Jasa Marga (Persero) Tbk. All rights reserved.
              </div>
            </Col>
          </Row>
        </Container>
      </div>
    </div>
  );
};

export default Login;
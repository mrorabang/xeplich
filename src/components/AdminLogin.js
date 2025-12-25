import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../css/AdminLogin.css';

const AdminLogin = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Kiểm tra cache login
    const cachedAuth = localStorage.getItem('adminAuth');
    if (cachedAuth === 'true') {
      onLogin();
    }
  }, [onLogin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Mật khẩu từ biến môi trường
    const correctPassword = process.env.REACT_APP_ADMIN_PASSWORD || '9320';

    if (password === correctPassword) {
      // Lưu cache login
      localStorage.setItem('adminAuth', 'true');
      onLogin();
    } else {
      setError('Mật khẩu không chính xác!');
    }
    
    setLoading(false);
  };

  return (
    <div className="admin-login-container">
      <div className="login-box">
        <h2>Đăng nhập Admin</h2>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="password">Mật khẩu:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="password-input"
              placeholder="Nhập mật khẩu"
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" disabled={loading} className="login-btn">
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
        <div className="back-to-staff">
          <Link to="/">← Quay về trang đăng ký lịch</Link>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;

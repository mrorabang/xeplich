import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveEmployeeEmails, getEmployeeEmails } from '../firebaseService';
import { useToast } from '../services/ToastService';
import './EmployeeEmailManager.css';

const EmployeeEmailManager = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [employeeEmails, setEmployeeEmails] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [settingsData, emailsData] = await Promise.all([
        getSettings(),
        getEmployeeEmails()
      ]);
      
      setSettings(settingsData);
      setEmployeeEmails(emailsData || {});
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Lỗi khi tải dữ liệu!');
      setLoading(false);
    }
  };

  const handleEmailChange = (employee, email) => {
    setEmployeeEmails(prev => ({
      ...prev,
      [employee]: email
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const success = await saveEmployeeEmails(employeeEmails);
      if (success) {
        toast.success('Lưu email nhân viên thành công!');
      } else {
        toast.error('Lỗi khi lưu email nhân viên!');
      }
    } catch (error) {
      console.error('Error saving emails:', error);
      toast.error('Lỗi khi lưu email nhân viên!');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoFill = () => {
    const autoEmails = {};
    settings.employees.forEach(emp => {
      // Tạo email tự động dựa trên tên nhân viên
      const cleanName = emp.toLowerCase()
        .replace(/\s+/g, '')
        .replace(/đ/g, 'd')
        .replace(/â/g, 'a')
        .replace(/ê/g, 'e')
        .replace(/ô/g, 'o')
        .replace(/ơ/g, 'o')
        .replace(/ư/g, 'u')
        .replace(/ă/g, 'a')
        .replace(/ấ/g, 'a')
        .replace(/ầ/g, 'a')
        .replace(/ễ/g, 'e')
        .replace(/ứ/g, 'u')
        .replace(/ớ/g, 'o')
        .replace(/ờ/g, 'o')
        .replace(/ị/g, 'i')
        .replace(/ị/g, 'i');
      
      autoEmails[emp] = `${cleanName}@gmail.com`;
    });
    
    setEmployeeEmails(autoEmails);
    toast.info('Đã tự động điền email theo tên nhân viên!');
  };

  const handleClearAll = () => {
    if (window.confirm('Bạn có chắc muốn xóa tất cả email?')) {
      setEmployeeEmails({});
      toast.success('Đã xóa tất cả email!');
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="loading">Đang tải...</div>
      </div>
    );
  }

  if (!settings || !Array.isArray(settings.employees)) {
    return (
      <div className="admin-page">
        <div className="error-container">
          <h2>Không có dữ liệu nhân viên</h2>
          <button onClick={() => navigate('/xeplich-admin')} className="back-btn">
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Quản lý Email Nhân viên</h1>
        <div className="admin-header-actions">
          <button onClick={() => navigate('/xeplich-admin')} className="back-btn">
            Quay lại Admin
          </button>
        </div>
      </div>

      <div className="admin-content">
        <div className="email-manager-section">
          <div className="section-header">
            <h2>Danh sách Email nhân viên</h2>
            <div className="header-actions">
              <button
                onClick={handleAutoFill}
                className="auto-fill-btn"
                disabled={saving}
              >
                Tự động điền
              </button>
              <button
                onClick={handleClearAll}
                className="clear-btn"
                disabled={saving}
              >
                Xóa tất cả
              </button>
            </div>
          </div>

          {/* <div className="email-info">
            <p className="info-text">
              <strong>Mục đích:</strong> Gửi lịch làm việc tự động đến email nhân viên khi có lịch chốt.
            </p>
            <p className="info-text">
              <strong>Lưu ý:</strong> Email sẽ được sử dụng để gửi thông báo lịch làm việc hàng tuần.
            </p>
          </div> */}

          <div className="email-list">
            {settings.employees.map((employee, index) => (
              <div key={index} className="email-item">
                <div className="employee-info">
                  <label className="employee-label">
                    Nhân viên:
                  </label>
                  <span className="employee-name">{employee}</span>
                </div>
                <div className="email-input-group">
                 
                  <input
                    type="email"
                    value={employeeEmails[employee] || ''}
                    onChange={(e) => handleEmailChange(employee, e.target.value)}
                    placeholder="Nhập gmail tại đây..."
                    className="email-input"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="save-section">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`save-btn ${saving ? 'saving' : ''}`}
            >
              {saving ? 'Đang lưu...' : 'Lưu tất cả email'}
            </button>
          </div>

          <div className="statistics">
            <h3>Thống kê</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Tổng nhân viên:</span>
                <span className="stat-value">{settings.employees.length}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Đã có email:</span>
                <span className="stat-value">
                  {Object.values(employeeEmails).filter(email => email && email.trim()).length}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Chưa có email:</span>
                <span className="stat-value">
                  {settings.employees.length - Object.values(employeeEmails).filter(email => email && email.trim()).length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeEmailManager;

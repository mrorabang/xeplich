import React, { useState, useEffect } from 'react';
import { saveSettings, getSettings, getRegistrations, saveScheduleByWeek, updateRegistrationStatus, checkShiftConflict, deleteRegistration, clearAllRegistrations, clearScheduleByWeek } from '../firebaseService';
import FinalScheduleTable from './FinalScheduleTable';
import { useToast } from '../services/ToastService';
import './AdminPage.css';

const AdminPage = ({ onLogout }) => {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    isActive: false,
    dateRange: { from: '', to: '' },
    employees: []
  });
  const [employeeInput, setEmployeeInput] = useState('');
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [originalSettings, setOriginalSettings] = useState(null);

  useEffect(() => {
    loadSettings();
    loadRegistrations();
  }, []);

  const loadSettings = async () => {
    const data = await getSettings();
    if (data) {
      setSettings(data);
      setOriginalSettings(data);
    }
  };

  const loadRegistrations = async () => {
    const data = await getRegistrations();
    setRegistrations(data);
  };

  const handleSaveSettings = async () => {
    // Kiểm tra khoảng thời gian đủ 7 ngày (tính cả ngày đầu và ngày cuối)
    if (settings.dateRange.from && settings.dateRange.to) {
      const fromDate = new Date(settings.dateRange.from);
      const toDate = new Date(settings.dateRange.to);
      const diffTime = toDate - fromDate;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 vì tính cả ngày đầu
      
      if (diffDays !== 7) {
        toast.error(`Khoảng thời gian phải đủ 7 ngày! Hiện tại: ${diffDays} ngày`);
        return;
      }
    } else if (settings.dateRange.from || settings.dateRange.to) {
      toast.error('Vui lòng chọn đầy đủ ngày bắt đầu và kết thúc!');
      return;
    }
    
    setLoading(true);
    
    // Kiểm tra nếu dateRange thay đổi, xóa dữ liệu cũ
    if (originalSettings && 
        (settings.dateRange.from !== originalSettings.dateRange.from || 
         settings.dateRange.to !== originalSettings.dateRange.to)) {
      
      const confirmClear = window.confirm(
        'Bạn đã thay đổi khoảng thời gian. Tất cả đăng ký và lịch chốt cũ sẽ bị xóa. Bạn có chắc chắn?'
      );
      
      if (confirmClear) {
        // Xóa schedule cũ nếu có
        if (originalSettings.dateRange.from) {
          await clearScheduleByWeek(originalSettings.dateRange.from);
        }
        // Xóa tất cả registrations
        await clearAllRegistrations();
        setRegistrations([]);
        toast.success('Đã xóa dữ liệu cũ!');
      } else {
        setLoading(false);
        return;
      }
    }
    
    const success = await saveSettings(settings);
    setLoading(false);
    if (success) {
      setOriginalSettings(settings);
      toast.success('Lưu cài đặt thành công!');
    } else {
      toast.error('Lỗi khi lưu cài đặt!');
    }
  };

  const handleRefreshRegistrations = async () => {
    setRefreshLoading(true);
    await loadRegistrations();
    setRefreshLoading(false);
  };

  const handleDeleteRegistration = async (registrationId) => {
    if (window.confirm('Bạn có chắc muốn xóa yêu cầu đăng ký này?')) {
      const success = await deleteRegistration(registrationId);
      if (success) {
        setRegistrations(prev => prev.filter(reg => reg.id !== registrationId));
        toast.success('Xóa đăng ký thành công!');
      } else {
        toast.error('Lỗi khi xóa đăng ký!');
      }
    }
  };

  // Kiểm tra có thay đổi settings không
  const hasChanges = () => {
    if (!originalSettings) return false;
    return (
      settings.isActive !== originalSettings.isActive ||
      settings.dateRange.from !== originalSettings.dateRange.from ||
      settings.dateRange.to !== originalSettings.dateRange.to ||
      JSON.stringify(settings.employees) !== JSON.stringify(originalSettings.employees)
    );
  };

  const handleAddEmployee = () => {
    if (employeeInput.trim()) {
      setSettings(prev => ({
        ...prev,
        employees: [...prev.employees, employeeInput.trim()]
      }));
      setEmployeeInput('');
    }
  };

  const handleApproveRegistration = async (registrationId) => {
    const registration = registrations.find(reg => reg.id === registrationId);
    if (registration) {
      // Kiểm tra xem nhân viên đã có lịch được duyệt trong tuần này chưa
      const existingApproved = registrations.find(reg => 
        reg.id !== registrationId && 
        reg.employeeName === registration.employeeName && 
        reg.approved === true
      );
      
      if (existingApproved) {
        toast.error(`Nhân viên ${registration.employeeName} đã có lịch làm trong tuần này!`);
        return;
      }
      
      // Tạo shifts từ đăng ký
      const newShifts = registration.shifts.map(s => ({
        date: s.date,
        shift: s.shift,
        employees: [registration.employeeName]
      }));
      
      // Kiểm tra conflict trước khi duyệt
      const conflictCheck = await checkShiftConflict(settings.dateRange.from, newShifts);
      
      if (conflictCheck.hasConflict) {
        // Hiển thị toast chi tiết về conflict
        let conflictMessage = 'Không thể duyệt vì vượt quá số lượng người cho phép:\n\n';
        conflictCheck.conflicts.forEach(conflict => {
          const dateStr = new Date(conflict.date).toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit', year: 'numeric'});
          conflictMessage += `Ngày ${dateStr} - Ca ${conflict.shift}: ${conflict.current}/${conflict.max} người\n`;
        });
        toast.error(conflictMessage);
        return;
      }
      
      // Lưu vào Firebase (gộp với schedule hiện có)
      const success = await saveScheduleByWeek(settings.dateRange.from, newShifts);
      if (success) {
        // Cập nhật trạng thái đã duyệt trên Firebase
        await updateRegistrationStatus(registrationId, true);
        // Cập nhật state local
        setRegistrations(prev => prev.map(reg => 
          reg.id === registrationId ? { ...reg, approved: true } : reg
        ));
      }
    }
  };

  const handleRemoveEmployee = (index) => {
    setSettings(prev => ({
      ...prev,
      employees: prev.employees.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Admin Page - Quản lý lịch làm việc</h1>
        <button onClick={onLogout} className="logout-btn">Đăng xuất</button>
      </div>

      <div className="admin-content">
        <div className="settings-section">
          <h2>Cài đặt</h2>
          
          <div className="setting-group">
            <label className="toggle-label">
              Bật Staff Page
              <div 
                className={`toggle-switch ${settings.isActive ? 'active' : ''}`}
                onClick={() => setSettings(prev => ({ ...prev, isActive: !prev.isActive }))}
              >
                <div className="toggle-slider"></div>
              </div>
            </label>
          </div>

          <div className="setting-group">
            <label>Chọn ngày:</label>
            <input
              type="date"
              value={settings.dateRange.from}
              onChange={(e) => setSettings(prev => ({ 
                ...prev, 
                dateRange: { ...prev.dateRange, from: e.target.value }
              }))}
            />
            <span>đến</span>
            <input
              type="date"
              value={settings.dateRange.to}
              onChange={(e) => setSettings(prev => ({ 
                ...prev, 
                dateRange: { ...prev.dateRange, to: e.target.value }
              }))}
            />
          </div>

          <div className="setting-group">
            <label>Danh sách nhân viên:</label>
            <div className="employee-input">
              <input
                type="text"
                value={employeeInput}
                onChange={(e) => setEmployeeInput(e.target.value)}
                placeholder="Nhập tên nhân viên"
                onKeyPress={(e) => e.key === 'Enter' && handleAddEmployee()}
              />
              <button onClick={handleAddEmployee}>Thêm</button>
            </div>
            <div className="employee-list">
              {settings.employees.map((emp, index) => (
                <div key={index} className="employee-item">
                  <span>{emp}</span>
                  <button onClick={() => handleRemoveEmployee(index)}>Xóa</button>
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleSaveSettings} disabled={loading || !hasChanges()} className={`save-btn ${hasChanges() ? '' : 'disabled'}`}>
            {loading ? 'Đang lưu...' : 'Lưu cài đặt'}
          </button>
        </div>

        <div className="registrations-section">
          <div className="registrations-header">
            <h2>Đăng ký của nhân viên ({registrations.length})</h2>
            <button 
              onClick={handleRefreshRegistrations} 
              className="refresh-registrations-btn"
              disabled={refreshLoading}
            >
              {refreshLoading ? 'Đang tải...' : '🔄 Refresh'}
            </button>
          </div>
          <div className="registrations-list">
            {registrations.map(reg => {
              const isApproved = reg.approved === true;
              return (
                <div key={reg.id} className={`registration-item ${isApproved ? 'approved' : ''}`}>
                  <div className="registration-info">
                    <h4>{reg.employeeName}</h4>
                    <p>Đăng ký {reg.shifts.length} ca</p>
                    <div className="shifts-detail">
                      {reg.shifts.map((shift, index) => (
                        <span key={index} className="shift-badge">
                          {new Date(shift.date).toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit', year: 'numeric'})} - Ca {shift.shift}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="registration-actions">
                    <button 
                      onClick={() => handleApproveRegistration(reg.id)}
                      className="approve-btn"
                      disabled={isApproved}
                    >
                      {isApproved ? 'Đã duyệt' : 'Duyệt'}
                    </button>
                    {!isApproved && (
                      <button 
                        onClick={() => handleDeleteRegistration(reg.id)}
                        className="delete-btn"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Bảng lịch chốt */}
          <FinalScheduleTable registrations={registrations} dateRange={settings.dateRange} />
        </div>
      </div>
    </div>
  );
};

export default AdminPage;

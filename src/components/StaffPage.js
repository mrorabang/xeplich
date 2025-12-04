import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveRegistration } from '../firebaseService';
import { sendRegistrationNotification } from '../services/EmailService';
import { useToast } from '../services/ToastService';
import './StaffPage.css';

const StaffPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [employeeName, setEmployeeName] = useState('');
  const [shifts, setShifts] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    checkActiveStatus();
  }, []);

  const checkActiveStatus = async () => {
    const data = await getSettings();
    setSettings(data);
    setLoading(false);
    
    if (!data || !data.isActive) {
      setError('Staff Page chưa được kích hoạt. Vui lòng liên hệ Admin.');
    }
  };

  const initializeShifts = () => {
    if (!settings) return;
    
    const newShifts = {};
    const startDate = new Date(settings.dateRange.from);
    
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      ['A', 'B', 'C'].forEach(shift => {
        newShifts[`${dateStr}_${shift}`] = false;
      });
    }
    
    setShifts(newShifts);
  };

  useEffect(() => {
    if (settings && settings.isActive) {
      initializeShifts();
    }
  }, [settings]);

  const handleShiftChange = (key) => {
    setShifts(prev => {
      const newShifts = { ...prev };
      newShifts[key] = !newShifts[key];
      return newShifts;
    });
  };

  const validateShifts = () => {
    const selectedShifts = Object.keys(shifts).filter(key => shifts[key]);
    
    if (selectedShifts.length === 0) {
      setError('Bạn phải đăng ký ít nhất 1 ca làm việc!');
      return false;
    }
    
    // Kiểm tra mỗi ngày 1-3 ca
    const days = {};
    selectedShifts.forEach(key => {
      const date = key.split('_')[0];
      days[date] = (days[date] || 0) + 1;
    });
    
    const startDate = new Date(settings.dateRange.from);
    let workingDays = 0;
    let restDays = 0;
    
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      const shiftsInDay = days[dateStr] || 0;
      
      if (shiftsInDay === 0) {
        restDays++;
      } else if (shiftsInDay >= 1 && shiftsInDay <= 3) {
        workingDays++;
      } else {
        setError(`Ngày ${currentDate.toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit', year: 'numeric'})} chỉ được chọn tối đa 3 ca!`);
        return false;
      }
    }
    
    // Kiểm tra tối đa 1 ngày nghỉ
    if (restDays > 1) {
      setError('Bạn chỉ được nghỉ tối đa 1 ngày trong tuần!');
      return false;
    }
    
    // Kiểm tra phải làm ít nhất 6 ngày
    if (workingDays < 6) {
      setError('Bạn phải làm việc ít nhất 6 ngày trong tuần!');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!employeeName.trim()) {
      setError('Vui lòng chọn tên nhân viên!');
      return;
    }
    
    if (!validateShifts()) {
      return;
    }
    
    const selectedShifts = Object.entries(shifts)
      .filter(([_, selected]) => selected)
      .map(([key, _]) => {
        const [date, shift] = key.split('_');
        return { date, shift };
      });
    
    const registration = {
      employeeName,
      shifts: selectedShifts,
      timestamp: new Date().toISOString()
    };
    
    const id = await saveRegistration(registration);
    if (id) {
      toast.success('Đăng ký ca làm việc thành công!');
      
      // Gửi email thông báo cho admin
      sendRegistrationNotification(employeeName, selectedShifts);
      
      // Reset form
      setEmployeeName('');
      initializeShifts();
    } else {
      toast.error('Đăng ký thất bại, vui lòng thử lại!');
    }
  };

  const getDayName = (dateStr) => {
    const date = new Date(dateStr);
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return days[date.getDay()];
  };

  if (loading) {
    return (
      <div className="staff-page">
        <div className="loading">Đang tải...</div>
      </div>
    );
  }

  if (!settings || !settings.isActive) {
    return (
      <div className="staff-page">
        <div className="error-container">
          <h2>Staff Page không khả dụng</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-page">
      <div className="staff-header">
        <div className="header-content">
          <div>
            <h1>Đăng ký lịch làm việc</h1>
            <p>Vui lòng đăng ký ca làm việc cho tuần {new Date(settings.dateRange.from).toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit', year: 'numeric'})} đến {new Date(settings.dateRange.to).toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit', year: 'numeric'})}</p>
          </div>
          <button 
            onClick={() => navigate('/xeplich-admin')}
            className="admin-login-btn"
          >
            🔐 Đăng nhập admin
          </button>
        </div>
      </div>

      <div className="staff-content">
        <form onSubmit={handleSubmit} className="registration-form">
          <div className="form-group">
            <label htmlFor="employeeName">Tên nhân viên:</label>
            <select
              id="employeeName"
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              required
              className="employee-select"
            >
              <option value="">-- Chọn nhân viên --</option>
              {settings.employees.map((emp, index) => (
                <option key={index} value={emp}>{emp}</option>
              ))}
            </select>
          </div>

          <div className="shifts-table">
            <h3>Chọn ca làm việc (mỗi ngày 1-3 ca, tối đa 1 ngày nghỉ/tuần)</h3>
            <table>
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Ca A</th>
                  <th>Ca B</th>
                  <th>Ca C</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 7 }, (_, i) => {
                  const currentDate = new Date(settings.dateRange.from);
                  currentDate.setDate(new Date(settings.dateRange.from).getDate() + i);
                  const dateStr = currentDate.toISOString().split('T')[0];
                  
                  return (
                    <tr key={dateStr}>
                      <td>
                        <div>{getDayName(dateStr)}</div>
                        <small>{currentDate.toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit', year: 'numeric'})}</small>
                      </td>
                      {['A', 'B', 'C'].map(shift => (
                        <td key={shift} className="checkbox-cell">
                          <input
                            type="checkbox"
                            id={`${dateStr}_${shift}`}
                            checked={shifts[`${dateStr}_${shift}`] || false}
                            onChange={() => handleShiftChange(`${dateStr}_${shift}`)}
                          />
                          <label htmlFor={`${dateStr}_${shift}`}></label>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="selected-shifts">
            <h4>Ca đã chọn ({Object.keys(shifts).filter(key => shifts[key]).length} ca):</h4>
            <div className="shifts-list">
              {Object.keys(shifts).filter(key => shifts[key]).map(key => {
                const [date, shift] = key.split('_');
                return (
                  <span key={key} className="shift-badge">
                    {getDayName(date)} - Ca {shift}
                  </span>
                );
              })}
            </div>
          </div>

          <button type="submit" className="submit-btn">
            Gửi đăng ký
          </button>
        </form>
      </div>
    </div>
  );
};

export default StaffPage;

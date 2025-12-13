import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveSettings, getSettings, getRegistrations, saveScheduleByWeek, updateRegistrationStatus, checkShiftConflict, deleteRegistration, clearAllRegistrations, clearScheduleByWeek, getAutoShiftConfig, saveAutoShiftConfig, getEmployeeEmails } from '../firebaseService';
import Toastify from 'toastify-js';
import 'toastify-js/src/toastify.css';
import AutoShiftService from '../services/AutoShiftService';
import ShiftWarningService from '../services/ShiftWarningService';
import FinalScheduleTable from './FinalScheduleTable';
import ViewModeToggle from './ViewModeToggle';
import './AdminPage.css';

const AdminPage = ({ onLogout }) => {
  const navigate = useNavigate();
  
  // Toast helper functions
  const showToast = (message, type = 'info') => {
    const backgrounds = {
      success: "linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)",
      error: "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)",
      warning: "linear-gradient(135deg, #f39c12 0%, #e67e22 100%)",
      info: "linear-gradient(135deg, #3498db 0%, #2980b9 100%)"
    };
    
    Toastify({
      text: message,
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: backgrounds[type],
      stopOnFocus: true
    }).showToast();
  };
  
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
  const [shiftWarnings, setShiftWarnings] = useState({ hasWarnings: false, warnings: [] });
  const [autoShiftConfig, setAutoShiftConfig] = useState({
    shiftLimits: {
      A: { weekday: 2, weekend: 3 },
      B: { weekday: 2, weekend: 2 },
      C: { weekday: 1, weekend: 1 }
    },
    prioritizeFairness: true,
    maxShiftsPerEmployee: 7
  });
  const [savingAutoConfig, setSavingAutoConfig] = useState(false);
  const [hasAllocatedSchedule, setHasAllocatedSchedule] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);

  useEffect(() => {
    loadSettings();
    loadRegistrations();
    loadAutoShiftConfig();
  }, []);

  useEffect(() => {
    checkShiftWarnings();
  }, [registrations]);

  useEffect(() => {
    // Check if there are registrations with shifts on page load
    const checkRegistrationsWithShifts = async () => {
      try {
        const allRegistrations = await getRegistrations();
        const hasShifts = allRegistrations.some(reg => reg.shifts && reg.shifts.length > 0);
        setHasAllocatedSchedule(hasShifts);
      } catch (error) {
        console.error('Error checking registrations:', error);
      }
    };
    
    checkRegistrationsWithShifts();
  }, []);

  const loadSettings = async () => {
    const data = await getSettings();
    if (data) {
      setSettings(data);
      setOriginalSettings(data);
    }
  };

  const handleToggleFairness = () => {
    setAutoShiftConfig(prev => ({
      ...prev,
      prioritizeFairness: !prev.prioritizeFairness
    }));
  };

  const handleMaxShiftsChange = (value) => {
    const num = parseInt(value, 10);
    if (Number.isNaN(num) || num <= 0) {
      setAutoShiftConfig(prev => ({ ...prev, maxShiftsPerEmployee: null }));
      return;
    }
    setAutoShiftConfig(prev => ({
      ...prev,
      maxShiftsPerEmployee: num
    }));
  };

  const loadRegistrations = async () => {
    const data = await getRegistrations();
    setRegistrations(data);
  };

  const loadAutoShiftConfig = async () => {
    try {
      const cfg = await getAutoShiftConfig();
      if (cfg) {
        setAutoShiftConfig(prev => ({
          ...prev,
          shiftLimits: cfg.shiftLimits
            ? { ...prev.shiftLimits, ...cfg.shiftLimits }
            : prev.shiftLimits,
          prioritizeFairness:
            typeof cfg.prioritizeFairness === 'boolean'
              ? cfg.prioritizeFairness
              : prev.prioritizeFairness,
          maxShiftsPerEmployee:
            typeof cfg.maxShiftsPerEmployee === 'number'
              ? cfg.maxShiftsPerEmployee
              : prev.maxShiftsPerEmployee
        }));
      }
    } catch (err) {
      console.error('Error loading auto shift config in AdminPage:', err);
    }
  };

  const checkShiftWarnings = async () => {
    try {
      const warnings = await ShiftWarningService.checkShiftGaps();
      setShiftWarnings(warnings);
    } catch (error) {
      console.error('Error checking shift warnings:', error);
    }
  };

  const handleSaveSettings = async () => {
    // Kiểm tra khoảng thời gian đủ 7 ngày (tính cả ngày đầu và ngày cuối)
    if (settings.dateRange.from && settings.dateRange.to) {
      const fromDate = new Date(settings.dateRange.from);
      const toDate = new Date(settings.dateRange.to);
      const diffTime = toDate - fromDate;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 vì tính cả ngày đầu

      if (diffDays !== 7) {
        showToast(`Khoảng thời gian phải đủ 7 ngày! Hiện tại: ${diffDays} ngày`, 'error');
        return;
      }
    } else if (settings.dateRange.from || settings.dateRange.to) {
      showToast('Vui lòng chọn đầy đủ ngày bắt đầu và kết thúc!', 'error');
      return;
    }

    setLoading(true);

    // Kiểm tra nếu dateRange thay đổi, xóa đăng ký cũ (giữ lại lịch chốt cũ)
    if (originalSettings &&
      (settings.dateRange.from !== originalSettings.dateRange.from ||
        settings.dateRange.to !== originalSettings.dateRange.to)) {

      const confirmClear = window.confirm(
        'Bạn đã thay đổi khoảng thời gian. Tất cả đăng ký ca của tuần cũ sẽ bị xóa, nhưng lịch chốt cũ vẫn được giữ trong lịch sử. Bạn có chắc chắn?'
      );

      if (confirmClear) {
        // Chỉ xóa tất cả registrations của tuần cũ, giữ lại lịch chốt cũ
        await clearAllRegistrations();
        setRegistrations([]);
        showToast('Đã xóa dữ liệu cũ!', 'success');
      } else {
        setLoading(false);
        return;
      }
    }

    const success = await saveSettings(settings);
    setLoading(false);
    if (success) {
      setOriginalSettings(settings);
      showToast('Lưu cài đặt thành công!', 'success');
    } else {
      showToast('Lỗi khi lưu cài đặt!', 'error');
    }
  };

  const getDayName = (dateStr) => {
    const date = new Date(dateStr);
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return days[date.getDay()];
  };

  const getShiftHours = (shift) => {
    // Mỗi ca làm việc 5 giờ
    return 5;
  };

  const getTotalHoursForDay = (dateStr) => {
    const shiftsForDay = ['A', 'B', 'C'].filter(shift => {
      // Tìm tất cả registration có ca này vào ngày này
      return registrations.some(reg => 
        reg.allocated && reg.shifts.some(s => 
          s.date === dateStr && s.shift === shift
        )
      );
    });
    return shiftsForDay.length * getShiftHours('A'); // 5 giờ/ca
  };

  const getTotalHoursForWeek = () => {
    let total = 0;
    if (!settings.dateRange.from) return 0;
    
    const startDate = new Date(settings.dateRange.from);
    
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];
      total += getTotalHoursForDay(dateStr);
    }
    
    return total;
  };

  const getAllocatedShiftsForDay = (dateStr) => {
    const allocatedShifts = [];
    
    registrations.forEach(reg => {
      if (reg.allocated) {
        reg.shifts.forEach(shift => {
          if (shift.date === dateStr) {
            allocatedShifts.push({
              employeeName: reg.employeeName,
              shift: shift.shift
            });
          }
        });
      }
    });
    
    return allocatedShifts;
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
        showToast('Xóa đăng ký thành công!', 'success');
      } else {
        showToast('Lỗi khi xóa đăng ký!', 'error');
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

  const handleAutoAllocate = async () => {
    if (registrations.length === 0) {
      showToast('Không có đăng ký nào để phân bổ!', 'warning');
      return;
    }

    setLoading(true);
    try {
      const result = await AutoShiftService.autoAllocateShifts();

      if (result.success) {
        // Tải lại danh sách đăng ký
        await loadRegistrations();

        // Kiểm tra lại các ca còn thiếu sau khi phân bổ
        await checkShiftWarnings();

        showToast(result.message || `Đã phân bổ thành công ${result.allocatedCount} nhân viên!`, 'success');

        // Set state để hiển thị nút lưu lịch chốt
        if (result.allocatedCount > 0) {
          setHasAllocatedSchedule(true);
        }
      } else {
        showToast('Lỗi khi phân bổ ca: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error in auto allocation:', error);
      showToast('Lỗi khi phân bổ ca!', 'error');
    } finally {
      setLoading(false);
    }
  };

  const createScheduleFromAllocations = async () => {
    setSavingSchedule(true);
    try {
      // Lấy tất cả registrations (không chỉ allocated ones)
      const allRegistrations = await getRegistrations();
      
      // Filter những registration có shifts (đã đăng ký)
      const registrationsWithShifts = allRegistrations.filter(reg => reg.shifts && reg.shifts.length > 0);

      if (registrationsWithShifts.length === 0) {
        showToast('Không có đăng ký nào để lưu!', 'warning');
        return;
      }

      console.log('Saving schedule for registrations:', registrationsWithShifts.length);

      // Tạo schedule data từ registrations - chuyển đổi sang format đúng
      const scheduleData = [];
      registrationsWithShifts.forEach(reg => {
        reg.shifts.forEach(shift => {
          scheduleData.push({
            date: shift.date,
            shift: shift.shift,
            employees: [reg.employeeName]
          });
        });
      });

      // Gộp các shifts giống nhau
      const mergedShifts = [];
      scheduleData.forEach(shift => {
        const existingShift = mergedShifts.find(
          s => s.date === shift.date && s.shift === shift.shift
        );
        if (existingShift) {
          // Thêm nhân viên vào ca đã có
          if (!existingShift.employees.includes(shift.employees[0])) {
            existingShift.employees.push(shift.employees[0]);
          }
        } else {
          // Thêm ca mới
          mergedShifts.push({
            date: shift.date,
            shift: shift.shift,
            employees: [shift.employees[0]]
          });
        }
      });

      console.log('Saving merged shifts:', mergedShifts.length);

      // Lưu schedule với format đúng
      const success = await saveScheduleByWeek(settings.dateRange.from, mergedShifts);
      if (success) {
        setHasAllocatedSchedule(true);
        showToast(`Đã lưu lịch chốt thành công cho ${registrationsWithShifts.length} nhân viên!`, 'success');
        
        // Không reload trang ngay lập tức, để người dùng có thể tiếp tục làm việc
        // setTimeout(() => {
        //   window.location.reload();
        // }, 1500);
      }
    } catch (error) {
      console.error('Error creating schedule:', error);
      showToast('Lỗi khi tạo lịch chốt!', 'error');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleRemoveEmployee = (index) => {
    setSettings(prev => ({
      ...prev,
      employees: prev.employees.filter((_, i) => i !== index)
    }));
  };

  const handleAutoConfigChange = (shiftType, field, value) => {
    const num = parseInt(value, 10);
    if (Number.isNaN(num) || num < 0) return;
    setAutoShiftConfig(prev => ({
      ...prev,
      shiftLimits: {
        ...prev.shiftLimits,
        [shiftType]: {
          ...prev.shiftLimits[shiftType],
          [field]: num
        }
      }
    }));
  };

  const handleSaveAutoShiftConfig = async () => {
    setSavingAutoConfig(true);
    try {
      const success = await saveAutoShiftConfig(autoShiftConfig);
      if (success) {
        showToast('Lưu cấu hình phân bổ ca thành công!', 'success');
      } else {
        showToast('Lỗi khi lưu cấu hình phân bổ ca!', 'error');
      }
    } catch (err) {
      console.error('Error saving auto shift config:', err);
      showToast('Lỗi khi lưu cấu hình phân bổ ca!', 'error');
    } finally {
      setSavingAutoConfig(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Admin Page - Quản lý lịch làm việc</h1>
        <div className="admin-header-actions">
          <ViewModeToggle onClick={() => navigate('/manual-schedule')} />
          <button onClick={onLogout} className=" btn btn-danger">Đăng xuất</button>
        </div>
      </div>

      {shiftWarnings.hasWarnings && (
        <div className="shift-warning-card">
          <h2>Cảnh báo thiếu ca làm việc</h2>
          <p className="shift-warning-summary">
            Hiện tại còn <strong>{shiftWarnings.totalMissing}</strong> slot ca làm chưa đủ người.
          </p>
          <ul className="shift-warning-list">
            {shiftWarnings.warnings.map((w, idx) => (
              <li key={idx}>
                <span className="warning-date">{w.dateDisplay}</span>
                <span className="warning-shift">Ca {w.shiftType}</span>
                <span className="warning-text">Thiếu {w.missing} người ({w.current}/{w.limit})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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

          <div className='divider' />

          <div className="setting-group">
            <label>Chọn ngày bắt đầu (Thứ 2):</label>
            <input
              type="date"
              value={settings.dateRange.from}
              onChange={(e) => {
                const selectedDate = new Date(e.target.value);
                // Kiểm tra xem có phải thứ 2 không
                if (selectedDate.getDay() !== 1) {
                  showToast('Bắt buôc chọn ngày Thứ 2!', 'error');
                  return;
                }
                // Tự động tính ngày Chủ nhật (thứ 2 + 6 ngày)
                const toDate = new Date(selectedDate);
                toDate.setDate(selectedDate.getDate() + 6);
                setSettings(prev => ({
                  ...prev,
                  dateRange: {
                    from: e.target.value,
                    to: toDate.toISOString().split('T')[0]
                  }
                }));
              }}
            />
            {settings.dateRange.from && (
              <p className="date-range-display" style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                Từ {String(new Date(settings.dateRange.from).getDate()).padStart(2, '0')}/{String(new Date(settings.dateRange.from).getMonth() + 1).padStart(2, '0')} - {String(new Date(settings.dateRange.to).getDate()).padStart(2, '0')}/{String(new Date(settings.dateRange.to).getMonth() + 1).padStart(2, '0')}
              </p>
            )}
          </div>

          <div className='divider' />

          <div className="setting-group auto-shift-config">
            <div className="employee-input">
              <input
                type="text"
                value={employeeInput}
                onChange={(e) => setEmployeeInput(e.target.value)}
                placeholder="Nhập tên nhân viên..."
                onKeyPress={(e) => e.key === 'Enter' && handleAddEmployee()}
              />
              <button onClick={handleAddEmployee}>Thêm</button>
            </div>
            <label>Danh sách nhân viên:</label>


            <div className="employee-list">
              {settings.employees.map((emp, index) => (
                <div key={index} className="employee-item">
                  <span>{emp}</span>
                  <button onClick={() => handleRemoveEmployee(index)}>x</button>
                </div>
              ))}
            </div>

          <div className='divider' />

            <div className="auto-shift-options auto-shift-config mt-3">
              <label className="auto-option">
                <input
                  type="checkbox"
                  checked={autoShiftConfig.prioritizeFairness}
                  onChange={handleToggleFairness}
                />
                Ưu tiên nhân viên có ít ca hơn
              </label>

              {/* <div className="auto-max-shifts input">
                <span>Tối đa ca nhân viên / tuần:</span>
                <input
                  type="number"
                  min="1"
                  value={autoShiftConfig.maxShiftsPerEmployee || ''}
                  onChange={(e) => handleMaxShiftsChange(e.target.value)}
                  placeholder="Không giới hạn"
                  className="employee-input input
"
                />
              </div> */}
            </div>
          </div>

        

          <button onClick={handleSaveSettings} disabled={loading || !hasChanges()} className={`save-btn ${hasChanges() ? '' : 'disabled'}`}>
            {loading ? 'Đang lưu...' : 'Lưu cài đặt'}
          </button>

          <button onClick={() => navigate('/schedule-history')} className="history-btn">
            Lịch sử lịch làm
          </button>

          <button onClick={() => navigate('/email-manager')} className="email-manager-btn">
            Quản lý Gmail
          </button>
        </div>

        <div className="registrations-section">
          <div className="registrations-header">
            <h2>Đăng ký của nhân viên ({registrations.length})</h2>
            <div className="header-actions">
              <button
                onClick={handleAutoAllocate}
                className="auto-allocate-btn"
                disabled={loading}
              >
                {loading ? 'Đang phân bổ...' : 'Phân bổ ca tự động'}
              </button>
              <button
                onClick={handleRefreshRegistrations}
                className="refresh-registrations-btn"
                disabled={refreshLoading}
              >
                {refreshLoading ? 'Đang tải...' : 'Refresh'}
              </button>
              {hasAllocatedSchedule && (
                <button
                  onClick={createScheduleFromAllocations}
                  className="save-schedule-btn"
                  disabled={loading || savingSchedule}
                >
                  {savingSchedule ? 'Đang lưu...' : 'Lưu lịch chốt'}
                </button>
              )}
            </div>
          </div>

          <div className="registrations-list">
            {registrations.map(reg => (
              <div key={reg.id} className="registration-item approved">
                <div className="registration-info">
                  <div className="employee-header">
                    <h4>{reg.employeeName} (Đăng ký {reg.shifts.length} ca)</h4>
                  </div>
                  <div className="shifts-detail">
                    {reg.shifts.map((shift, index) => {
                      const date = new Date(shift.date);
                      const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
                      const dayName = dayNames[date.getDay()];
                      return (
                        <span key={index} className={`shift-badge shift-${shift.shift}`}>
                          {dayName} - Ca {shift.shift}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="registration-actions">
                  <button
                    className="delete-registration-btn"
                    onClick={() => handleDeleteRegistration(reg.id)}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Bảng lịch chốt - chỉ hiển thị sau khi phân bổ */}
          {registrations.some(reg => reg.allocated) && (
            <FinalScheduleTable
              registrations={registrations.filter(reg => reg.allocated)}
              dateRange={settings.dateRange}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;

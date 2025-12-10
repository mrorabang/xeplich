import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings } from '../firebaseService';
import html2canvas from 'html2canvas';
import './StaffPage.css';
import './FinalScheduleTable.css';

const shiftHours = {
  A: 6, // 6h30-12h30
  B: 5, // 12h30-17h30
  C: 5, // 17h30-22h30
};

const ManualScheduleConverter = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  // key: employeeName_date_shift (vd: "Duyen_2025-12-15_A")
  const [shifts, setShifts] = useState({});
  const scheduleRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      const data = await getSettings();
      setSettings(data);
      initShifts(data);
      setLoading(false);
    };
    load();
  }, []);

  const initShifts = (data) => {
    if (!data || !data.dateRange?.from || !Array.isArray(data.employees)) return;
    const startDate = new Date(data.dateRange.from);
    const newShifts = {};

    data.employees.forEach((emp) => {
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        const dateStr = currentDate.toISOString().split('T')[0];
        ['A', 'B', 'C'].forEach((shift) => {
          const key = `${emp}__${dateStr}__${shift}`;
          newShifts[key] = false;
        });
      }
    });

    setShifts(newShifts);
  };

  const handleShiftToggle = (employee, dateStr, shift) => {
    const key = `${employee}__${dateStr}__${shift}`;
    setShifts((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const getDayName = (dateStr) => {
    const date = new Date(dateStr);
    const days = ['CN', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return days[date.getDay()];
  };

  const getEmployeeSummary = (employee) => {
    if (!settings?.dateRange?.from) return { selected: [], totalHours: 0 };
    const startDate = new Date(settings.dateRange.from);

    const selected = [];
    let totalHours = 0;

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];

      ['A', 'B', 'C'].forEach((shift) => {
        const key = `${employee}__${dateStr}__${shift}`;
        if (shifts[key]) {
          selected.push({ dateStr, shift });
          totalHours += shiftHours[shift] || 0;
        }
      });
    }

    return { selected, totalHours };
  };

  const handleExportSchedulePNG = async () => {
    if (!scheduleRef.current) return;

    try {
      const canvas = await html2canvas(scheduleRef.current, {
        backgroundColor: '#ffffff',
        scale: 3,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        width: scheduleRef.current.scrollWidth,
        height: scheduleRef.current.scrollHeight,
      });

      const link = document.createElement('a');
      link.download = `lich-chot-thucong-${new Date().toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (err) {
      console.error('Error exporting manual schedule PNG:', err);
      alert('Lỗi khi xuất PNG lịch chốt thủ công!');
    }
  };

  if (loading) {
    return (
      <div className="staff-page">
        <div className="loading">Đang tải...</div>
      </div>
    );
  }

  if (!settings || !settings.dateRange?.from || !Array.isArray(settings.employees)) {
    return (
      <div className="staff-page">
        <div className="error-container">
          <h2>Không có tuần làm việc hiện tại</h2>
          <button
            onClick={() => navigate('/xeplich-admin')}
            className="admin-login-link"
          >
            Quay lại Admin
          </button>
        </div>
      </div>
    );
  }

  const startDate = new Date(settings.dateRange.from);
  const employees = settings.employees;

  return (
    <div className="staff-page">
      <div className="staff-header">
        <div className="header-content">
          <div>
            <button
              onClick={() => navigate('/xeplich-admin')}
              className="admin-login-btn"
            >
              Quay lại Admin
            </button>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.2rem' }}>
              Chuyển đổi lịch thủ công
            </h1>
          </div>
        </div>
      </div>

      <div className="staff-content">
        <div className="date-range-banner">
          <div className="date-range-content">
            <span className="date-range-label">Tuần xử lý</span>
            <span className="date-range-dates">
              {new Date(settings.dateRange.from).toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
              <span className="date-range-separator">→</span>
              {new Date(settings.dateRange.to).toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>

        <div className="registration-form">
          {/* Bảng 1: tick ca theo nhân viên - giống bảng đăng ký ca admin */}
          <div className="final-schedule-container" style={{ marginTop: '0' }}>
            <div className="schedule-header">
              <h3>Đăng ký ca thủ công</h3>
            </div>
            <div className="final-table-wrapper">
              <table className="final-schedule-table">
                <thead>
                  <tr>
                    <th className="employee-col" rowSpan="2">Nhân viên</th>
                    {Array.from({ length: 7 }, (_, i) => {
                      const currentDate = new Date(startDate);
                      currentDate.setDate(startDate.getDate() + i);
                      const dateStr = currentDate.toISOString().split('T')[0];
                      return (
                        <th key={dateStr} className="date-col" colSpan="3">
                          <div>{getDayName(dateStr)}</div>
                          <small>{currentDate.toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit'})}</small>
                        </th>
                      );
                    })}
                  </tr>
                  <tr>
                    {Array.from({ length: 7 }, (_, i) => {
                      const currentDate = new Date(startDate);
                      currentDate.setDate(startDate.getDate() + i);
                      const dateStr = currentDate.toISOString().split('T')[0];
                      return ['A', 'B', 'C'].map(shift => (
                        <th key={`${dateStr}_${shift}`} className="shift-col">{shift}</th>
                      ));
                    })}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp}>
                      <td className="employee-name">{emp}</td>
                      {Array.from({ length: 7 }, (_, i) => {
                        const currentDate = new Date(startDate);
                        currentDate.setDate(startDate.getDate() + i);
                        const dateStr = currentDate.toISOString().split('T')[0];
                        return ['A', 'B', 'C'].map(shift => {
                          const key = `${emp}__${dateStr}__${shift}`;
                          return (
                            <td key={`${dateStr}_${shift}`} className={`shift-cell ${shifts[key] ? 'active' : ''}`}>
                              <div className="checkbox-cell" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                                <input
                                  type="checkbox"
                                  id={key}
                                  checked={!!shifts[key]}
                                  onChange={() => handleShiftToggle(emp, dateStr, shift)}
                                  style={{ margin: 0 }}
                                />
                              </div>
                            </td>
                          );
                        });
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bảng 2: lịch chốt dạng thời gian làm việc (giống FinalScheduleTable) */}
          <div className="time-schedule-container">
            <div className="schedule-header">
              <h3>Lịch chốt - Thời gian làm việc (theo tick ở bảng trên)</h3>
              <button
                type="button"
                className="export-png-btn"
                onClick={handleExportSchedulePNG}
              >
                Xuất PNG
              </button>
            </div>
            <div className="final-table-wrapper" ref={scheduleRef}>
              <table className="final-schedule-table time-schedule">
                <thead>
                  <tr>
                    <th className="employee-col">Nhân viên</th>
                    {Array.from({ length: 7 }, (_, i) => {
                      const currentDate = new Date(startDate);
                      currentDate.setDate(startDate.getDate() + i);
                      const dateStr = currentDate.toISOString().split('T')[0];
                      return (
                        <th key={dateStr} className="date-col">
                          <div>{getDayName(dateStr)}</div>
                          <small>{currentDate.toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit'})}</small>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp}>
                      <td className="employee-name">{emp}</td>
                      {Array.from({ length: 7 }, (_, i) => {
                        const currentDate = new Date(startDate);
                        currentDate.setDate(startDate.getDate() + i);
                        const dateStr = currentDate.toISOString().split('T')[0];

                        const dayShifts = ['A', 'B', 'C']
                          .filter((shift) => shifts[`${emp}__${dateStr}__${shift}`])
                          .map((shift) => {
                            let timeLabel = '';
                            if (shift === 'A') timeLabel = '6h30-12h30';
                            if (shift === 'B') timeLabel = '12h30-17h30';
                            if (shift === 'C') timeLabel = '17h30-22h30';
                            return timeLabel;
                          });

                        return (
                          <td key={`${emp}-${dateStr}`} className={`shift-cell ${dayShifts.length > 0 ? 'active' : ''}`}>
                            {dayShifts.length > 0 ? (
                              <div style={{ whiteSpace: 'pre-line' }}>
                                {dayShifts.join('\n')}
                              </div>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="staff-footer">
        <span>Created by Minh Quân</span>
      </div>
    </div>
  );
};

export default ManualScheduleConverter;

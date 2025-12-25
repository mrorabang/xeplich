import React, { useState, useEffect } from 'react';
import { MDBContainer, MDBCard, MDBCardBody, MDBCardTitle, MDBRow, MDBCol, MDBBtn, MDBSpinner, MDBBadge, MDBInput } from 'mdb-react-ui-kit';
import { getRegistrationHistory, saveRegistrationHistory, clearRegistrationHistory } from '../firebaseService';
import '../css/RegistrationHistory.css';

const RegistrationHistory = () => {
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState('');

  useEffect(() => {
    loadRegistrationHistory();
  }, []);

  const loadRegistrationHistory = async () => {
    try {
      setLoading(true);
      const history = await getRegistrationHistory();
      setHistoryData(history);
      
      // Select the most recent week by default
      if (history.length > 0) {
        setSelectedWeek(history[0].weekId);
      }
    } catch (error) {
      console.error('Error loading registration history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (window.confirm('Bạn có chắc muốn xóa toàn bộ lịch sử đăng ký? Hành động này không thể hoàn tác!')) {
      try {
        const success = await clearRegistrationHistory();
        if (success) {
          setHistoryData([]);
          setSelectedWeek('');
          alert('Đã xóa toàn bộ lịch sử đăng ký thành công!');
        } else {
          alert('Lỗi khi xóa lịch sử đăng ký!');
        }
      } catch (error) {
        console.error('Error clearing history:', error);
        alert('Lỗi khi xóa lịch sử đăng ký!');
      }
    }
  };

  const getWeekDisplay = (weekId) => {
    const weekStart = new Date(weekId);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const startFormat = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`;
    const endFormat = `${weekEnd.getDate()}/${weekEnd.getMonth() + 1}`;
    
    return `Tuần ${startFormat}-${endFormat}`;
  };

  const generateWeekDays = () => {
    if (!currentWeekData || !currentWeekData.registrations) return [];
    
    const weekStart = new Date(selectedWeek);
    const days = [];
    
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(weekStart);
      currentDate.setDate(weekStart.getDate() + i);
      const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      
      days.push({
        dayName: dayNames[currentDate.getDay()],
        date: formatDate(currentDate.toISOString()),
        fullDate: currentDate.toISOString().split('T')[0]
      });
    }
    
    return days;
  };

  const getShiftsByDay = (shifts) => {
    const shiftsByDay = {};
    
    if (shifts && Array.isArray(shifts)) {
      shifts.forEach(shift => {
        const dateKey = shift.date;
        // Store all shifts for each date (in case of multiple shifts per day)
        if (!shiftsByDay[dateKey]) {
          shiftsByDay[dateKey] = [];
        }
        shiftsByDay[dateKey].push(shift);
      });
    }
    
    return shiftsByDay;
  };

  const getCurrentWeekData = () => {
    if (!selectedWeek) return null;
    return historyData.find(week => week.weekId === selectedWeek);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  };

  const getShiftLabel = (shift) => {
    const shiftLabels = {
      'A': 'Ca Sáng (7h-15h)',
      'B': 'Ca Chiều (15h-23h)', 
      'C': 'Ca Tối (23h-7h)'
    };
    return shiftLabels[shift] || shift;
  };

  const getDayLabel = (dateStr) => {
    const date = new Date(dateStr);
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return days[date.getDay()];
  };

  if (loading) {
    return (
      <MDBContainer className="registration-history-container">
        <div className="text-center py-5">
          <MDBSpinner role="status">
            <span className="visually-hidden">Loading...</span>
          </MDBSpinner>
          <p className="mt-3">Đang tải lịch sử đăng ký...</p>
        </div>
      </MDBContainer>
    );
  }

  const currentWeekData = getCurrentWeekData();

  return (
    <MDBContainer className="registration-history-container">
      <MDBCard className="mt-4">
        <MDBCardBody>
          <MDBCardTitle tag="h2" className="text-center mb-4">
            Lịch Sử Đăng Ký Ca
          </MDBCardTitle>
          
          {/* <p className="text-center text-muted mb-4">
            (Không bị thay đổi khi admin phân bổ ca)
          </p> */}

          {/* Week Selector */}
          <div className="week-selector mb-4">
            <label htmlFor="weekSelect" className="form-label fw-bold">
              Chọn tuần:
            </label>
            <select 
              id="weekSelect"
              className="form-select"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
            >
              {historyData.map((week) => (
                <option key={week.weekId} value={week.weekId} className='fw-bold text-center'>
                  {getWeekDisplay(week.weekId)} ({week.registrations ? week.registrations.length : 0} nhân viên)
                </option>
              ))}
            </select>
          </div>

          {currentWeekData && currentWeekData.registrations && currentWeekData.registrations.length > 0 ? (
            <div className="schedule-table-wrapper">
              <table className="schedule-matrix">
                <thead>
                  <tr>
                    <th className="employee-col">NHÂN VIÊN</th>
                    {generateWeekDays().map((day, index) => (
                      <th key={index} className="date-col" colSpan="3">
                        <div>{day.dayName}</div>
                        <small>{day.date}</small>
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th></th>
                    {generateWeekDays().map((day, index) => (
                      <React.Fragment key={index}>
                        <th className="shift-col">A</th>
                        <th className="shift-col">B</th>
                        <th className="shift-col">C</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentWeekData.registrations.map((registration, empIndex) => {
                    const shiftsByDay = getShiftsByDay(registration.shifts || []);
                    
                    return (
                      <tr key={empIndex}>
                        <td className="employee-name">{registration.employeeName}</td>
                        {generateWeekDays().map((day, dayIndex) => {
                          const dayShifts = shiftsByDay[day.fullDate] || [];
                          const hasShiftA = dayShifts.some(s => s.shift === 'A');
                          const hasShiftB = dayShifts.some(s => s.shift === 'B');
                          const hasShiftC = dayShifts.some(s => s.shift === 'C');
                          return (
                            <React.Fragment key={dayIndex}>
                              <td className="shift-cell">
                                {hasShiftA ? 'x' : ''}
                              </td>
                              <td className="shift-cell">
                                {hasShiftB ? 'x' : ''}
                              </td>
                              <td className="shift-cell">
                                {hasShiftC ? 'x' : ''}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-5">
              <p className="text-muted">Không có dữ liệu cho tuần được chọn</p>
            </div>
          )}

          {/* Back Button */}
          <div className="text-center mt-4">
            <MDBBtn 
              color="secondary" 
              onClick={() => window.history.back()}
              className="me-2"
            >
              Quay lại
            </MDBBtn>
            <MDBBtn 
              color="danger"
              onClick={handleReset}
              className="me-2"
            >
              Reset Lịch Sử
            </MDBBtn>
            <MDBBtn 
              color="primary"
              onClick={loadRegistrationHistory}
            >
              Làm mới
            </MDBBtn>
          </div>
        </MDBCardBody>
      </MDBCard>
    </MDBContainer>
  );
};

export default RegistrationHistory;

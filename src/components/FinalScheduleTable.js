import React, { useRef } from 'react';
import html2canvas from 'html2canvas';
import './FinalScheduleTable.css';

const FinalScheduleTable = ({ registrations, dateRange }) => {
  const tableRef = useRef();
  const timeTableRef = useRef();
  
  // Lọc các đăng ký đã duyệt
  const approvedRegistrations = registrations.filter(reg => reg.approved === true);

  const getDayName = (dateStr) => {
    const date = new Date(dateStr);
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return days[date.getDay()];
  };

  const getDates = () => {
    if (!dateRange.from) return [];
    const dates = [];
    const startDate = new Date(dateRange.from);
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      dates.push(currentDate.toISOString().split('T')[0]);
    }
    return dates;
  };

  const renderScheduleTable = () => {
    const dates = getDates();
    const shifts = ['A', 'B', 'C'];
    
    return (
      <table className="final-schedule-table">
        <thead>
          <tr>
            <th className="employee-col" rowSpan="2">Nhân viên</th>
            {dates.map(date => (
              <th key={date} className="date-col" colSpan="3">
                <div>{getDayName(date)}</div>
                <small>{new Date(date).toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit'})}</small>
              </th>
            ))}
          </tr>
          <tr>
            {dates.map(date => (
              shifts.map(shift => (
                <th key={`${date}_${shift}`} className="shift-col">{shift}</th>
              ))
            ))}
          </tr>
        </thead>
        <tbody>
          {approvedRegistrations.map(reg => (
            <tr key={reg.id}>
              <td className="employee-name">{reg.employeeName}</td>
              {dates.map(date => (
                shifts.map(shift => {
                  const hasShift = reg.shifts.some(s => s.date === date && s.shift === shift);
                  return (
                    <td key={`${date}_${shift}`} className={`shift-cell ${hasShift ? 'active' : ''}`}>
                      {hasShift ? '✓' : ''}
                    </td>
                  );
                })
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderTimeScheduleTable = () => {
    const dates = getDates();
    const shiftTimes = {
      'A': '6h30-12h30',
      'B': '12h30-17h30', 
      'C': '17h30-22h30'
    };
    
    return (
      <table className="final-schedule-table time-schedule">
        <thead>
          <tr>
            <th className="employee-col">Nhân viên</th>
            {dates.map(date => (
              <th key={date} className="date-col">
                <div>{getDayName(date)}</div>
                <small>{new Date(date).toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit'})}</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {approvedRegistrations.map(reg => (
            <tr key={reg.id}>
              <td className="employee-name">{reg.employeeName}</td>
              {dates.map(date => {
                const dayShifts = reg.shifts.filter(s => s.date === date);
                const shiftTimesStr = dayShifts.map(s => shiftTimes[s.shift]).join('\n');
                return (
                  <td key={date} className={`shift-cell ${dayShifts.length > 0 ? 'active' : ''}`}>
                    {shiftTimesStr}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const handleExportPNG = async () => {
    if (!tableRef.current) return;
    
    try {
      const canvas = await html2canvas(tableRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true
      });
      
      const link = document.createElement('a');
      link.download = `lich-chot-${new Date().toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit', year: 'numeric'})}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error('Error exporting PNG:', error);
      alert('Lỗi khi xuất file PNG!');
    }
  };

  const handleExportTimePNG = async () => {
    if (!timeTableRef.current) return;
    
    try {
      const canvas = await html2canvas(timeTableRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true
      });
      
      const link = document.createElement('a');
      link.download = `lich-chot-thoigian-${new Date().toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit', year: 'numeric'})}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error('Error exporting time PNG:', error);
      alert('Lỗi khi xuất file PNG!');
    }
  };

  if (approvedRegistrations.length === 0) {
    return (
      <div className="final-schedule-container">
        <h3>Lịch chốt</h3>
        <p className="no-data">Chưa có nhân viên nào được duyệt</p>
      </div>
    );
  }

  return (
    <div className="final-schedule-container">
      <div className="schedule-header">
        <h3>Lịch chốt ({approvedRegistrations.length} nhân viên)</h3>
        <button onClick={handleExportPNG} className="export-png-btn">
          📷 Xuất PNG
        </button>
      </div>
      <div className="final-table-wrapper" ref={tableRef}>
        {renderScheduleTable()}
      </div>
      
      <div className="time-schedule-container">
        <div className="schedule-header">
          <h3>Lịch chốt - Thời gian làm việc</h3>
          <button onClick={handleExportTimePNG} className="export-png-btn">
            📷 Xuất PNG
          </button>
        </div>
        <div className="final-table-wrapper" ref={timeTableRef}>
          {renderTimeScheduleTable()}
        </div>
      </div>
    </div>
  );
};

export default FinalScheduleTable;

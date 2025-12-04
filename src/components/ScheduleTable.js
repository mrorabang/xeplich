import React, { useState, useEffect } from 'react';
import { getSchedules } from '../firebaseService';
import './ScheduleTable.css';

const ScheduleTable = ({ refreshKey, onRefresh }) => {
  const [schedules, setSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSchedules();
  }, [refreshKey]);

  const loadSchedules = async () => {
    setLoading(true);
    const data = await getSchedules();
    setSchedules(data);
    if (data.length > 0) {
      setSelectedSchedule(data[0]);
    } else {
      setSelectedSchedule(null);
    }
    setLoading(false);
  };

  const getDayName = (dateStr) => {
    const date = new Date(dateStr);
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return days[date.getDay()];
  };

  const renderScheduleTable = () => {
    if (!selectedSchedule) return <p>Chưa có lịch nào</p>;

    // Lấy danh sách nhân viên từ các ca làm việc
    const employees = [...new Set(selectedSchedule.shifts.flatMap(shift => shift.employees))];
    
    // Lấy 7 ngày từ lịch
    const dates = [...new Set(selectedSchedule.shifts.map(shift => shift.date))].sort();
    const shifts = ['A', 'B', 'C'];

    return (
      <div className="schedule-table-wrapper">
        <table className="schedule-matrix">
          <thead>
            <tr>
              <th className="employee-col">NHÂN VIÊN</th>
              {dates.map(date => (
                <th key={date} className="date-col" colSpan="3">
                  <div>{getDayName(date)}</div>
                  <small>{new Date(date).getDate().toString().padStart(2, '0')}/{(new Date(date).getMonth() + 1).toString().padStart(2, '0')}</small>
                </th>
              ))}
            </tr>
            <tr>
              <th></th>
              {dates.map(date => (
                <React.Fragment key={date}>
                  <th className="shift-col">A</th>
                  <th className="shift-col">B</th>
                  <th className="shift-col">C</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map(employee => (
              <tr key={employee}>
                <td className="employee-name">{employee}</td>
                {dates.map(date => (
                  <React.Fragment key={`${date}_${employee}`}>
                    {shifts.map(shift => {
                      // Tìm ca có nhân viên này
                      const shiftData = selectedSchedule.shifts.find(
                        s => s.date === date && s.shift === shift && s.employees.includes(employee)
                      );
                      return (
                        <td key={`${date}_${shift}`} className="shift-cell">
                          {shiftData ? 'x' : ''}
                        </td>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="schedule-table-container">
      <div className="schedule-controls">
        <h3>Lịch làm việc tuần {selectedSchedule ? new Date(selectedSchedule.weekOf).getDate() + '/' + (new Date(selectedSchedule.weekOf).getMonth() + 1) : ''}</h3>
        <button onClick={loadSchedules} className="refresh-schedule-btn" disabled={loading}>
          {loading ? 'Đang tải...' : '🔄 Refresh'}
        </button>
      </div>
      
      {loading ? <p>Đang tải lịch...</p> : renderScheduleTable()}
    </div>
  );
};

export default ScheduleTable;

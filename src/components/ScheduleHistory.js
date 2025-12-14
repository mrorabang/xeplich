import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getScheduleHistory, deleteScheduleByWeek, getEmployeeEmails } from '../firebaseService';
import FinalScheduleTable from './FinalScheduleTable';
import Toastify from 'toastify-js';
import 'toastify-js/src/toastify.css';
import EmailScheduleService from '../services/EmailScheduleService';
import './ScheduleHistory.css';

const ScheduleHistory = () => {
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

  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingSchedule, setSendingSchedule] = useState(false);

  useEffect(() => {
    loadScheduleHistory();
  }, []);

  const loadScheduleHistory = async () => {
    try {
      const data = await getScheduleHistory();
      setHistoryData(data);
    } catch (error) {
      console.error('Error loading schedule history:', error);
      showToast('Lỗi khi tải lịch sử!', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSchedule = async (weekKey) => {
    if (window.confirm('Bạn có chắc muốn xóa lịch chốt này?')) {
      try {
        const success = await deleteScheduleByWeek(weekKey);
        if (success) {
          setHistoryData(prev => prev.filter(item => item.weekKey !== weekKey));
          showToast('Xóa lịch chốt thành công!', 'success');
        } else {
          showToast('Lỗi khi xóa lịch chốt!', 'error');
        }
      } catch (error) {
        console.error('Error deleting schedule:', error);
        showToast('Lỗi khi xóa lịch chốt!', 'error');
      }
    }
  };

  const handleSendSchedule = async (scheduleData, dateRange, index) => {
    // setSendingSchedule(true);
    // try {
    //   // Lấy element của lịch cần chụp
    //   const scheduleElement = document.querySelector(`#history-schedule-${index}`);
      
    //   if (!scheduleElement) {
    //     showToast('Không tìm thấy element lịch để chụp!', 'error');
    //     return;
    //   }

    //   // Sử dụng EmailScheduleService để gửi
    //   const result = await EmailScheduleService.sendScheduleWithImage(
    //     scheduleElement,
    //     scheduleData,
    //     dateRange
    //   );

    //   if (result.success) {
    //     const employeeNames = result.sentEmployees || [];
    //     const namesText = employeeNames.length > 0 
    //       ? employeeNames.join(', ') 
    //       : '0 nhân viên';
    //     showToast(`Đã gửi lịch làm việc cho: ${namesText}`, 'success');
    //   } else {
    //     showToast(result.error || 'Lỗi khi gửi lịch làm việc!', 'error');
    //   }
      
    // } catch (error) {
    //   console.error('Error sending schedule:', error);
    //   showToast('Lỗi khi gửi lịch làm việc!', 'error');
    // } finally {
    //   setSendingSchedule(false);
    // }
  };

  if (loading) {
    return (
      <div className="schedule-history-page">
        <div className="history-header">
          <h1>Lịch sử lịch làm</h1>
          <button onClick={() => navigate('/xeplich-admin')} className="back-btn">
            ← Quay lại
          </button>
        </div>
        <div className="loading">Đang tải dữ liệu...</div>
      </div>
    );
  }

  return (
    <div className="schedule-history-page">
      <div className="history-header">
        <h1>Lịch sử lịch làm</h1>
        <button onClick={() => navigate('/xeplich-admin')} className="back-btn">
          ← Quay lại
        </button>
      </div>

      <div className="history-content">
        {historyData.length === 0 ? (
          <div className="no-data">
            <h3>Không có lịch chốt nào</h3>
            <p>Chưa có lịch làm việc nào được lưu.</p>
          </div>
        ) : (
          historyData.map((item, index) => {
            const weekKey = item.weekKey;
            const dateRange = item.dateRange;
            const scheduleData = item.scheduleData;

            return (
              <div key={index} className="history-item">
                <div className="history-item-header">
                  <div className="history-date">
                    Tuần {new Date(dateRange.from).toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit', year: 'numeric'})} - {new Date(dateRange.to).toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit', year: 'numeric'})}
                  </div>
                  <div className="history-actions">
                    <button onClick={() => handleSendSchedule(scheduleData, dateRange, index)} className="send-schedule-btn" disabled={sendingSchedule}>
                      {sendingSchedule ? 'Đang gửi...' : 'Gửi lịch qua mail'}
                    </button>
                    <button onClick={() => handleDeleteSchedule(weekKey)} className="delete-btn" disabled={sendingSchedule}>
                      Xóa
                    </button>
                  </div>
                </div>
                <div id={`history-schedule-${index}`} className="history-schedule">
                  <FinalScheduleTable
                    registrations={[]}
                    dateRange={dateRange}
                    scheduleData={scheduleData}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ScheduleHistory;
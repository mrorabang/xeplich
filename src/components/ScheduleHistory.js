import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getScheduleHistory, deleteScheduleByWeek, getEmployeeEmails } from '../firebaseService';
import FinalScheduleTable from './FinalScheduleTable';
import { useToast } from '../services/ToastService';
import EmailScheduleService from '../services/EmailScheduleService';
import './ScheduleHistory.css';

const ScheduleHistory = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
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
      toast.error('Lỗi khi tải lịch sử!');
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
          toast.success('Xóa lịch chốt thành công!');
        } else {
          toast.error('Lỗi khi xóa lịch chốt!');
        }
      } catch (error) {
        console.error('Error deleting schedule:', error);
        toast.error('Lỗi khi xóa lịch chốt!');
      }
    }
  };

  const handleSendSchedule = async (scheduleData, dateRange, index) => {
    setSendingSchedule(true);
    try {
      // Lấy element của lịch cần chụp
      const scheduleElement = document.querySelector(`#history-schedule-${index}`);
      
      if (!scheduleElement) {
        toast.error('Không tìm thấy element lịch để chụp!');
        return;
      }

      // Sử dụng EmailScheduleService để gửi
      const result = await EmailScheduleService.sendScheduleWithImage(
        scheduleElement,
        scheduleData,
        dateRange
      );

      if (result.success) {
        toast.success(`Đã gửi lịch làm việc cho ${result.sentCount || 0} nhân viên!`);
      } else {
        toast.error(result.error || 'Lỗi khi gửi lịch làm việc!');
      }
      
    } catch (error) {
      console.error('Error sending schedule:', error);
      toast.error('Lỗi khi gửi lịch làm việc!');
    } finally {
      setSendingSchedule(false);
    }
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
                      {sendingSchedule ? 'Đang gửi...' : 'Gửi lịch'}
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
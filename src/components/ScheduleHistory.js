import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getScheduleHistory, deleteScheduleByWeek } from '../firebaseService';
import FinalScheduleTable from './FinalScheduleTable';
import { useToast } from '../services/ToastService';
import './ScheduleHistory.css';

const ScheduleHistory = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);

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
                    <button onClick={() => {/* TODO: export PNG */}} className="export-btn">
                      📷 Xuất PNG
                    </button>
                    <button onClick={() => handleDeleteSchedule(weekKey)} className="delete-btn">
                      🗑️ Xóa
                    </button>
                  </div>
                </div>
                <div className="history-schedule">
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
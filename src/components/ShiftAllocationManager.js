import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRegistrations } from '../firebaseService';
import ShiftAllocationService from '../services/ShiftAllocationService';
import { useToast } from '../services/ToastService';
import './ShiftAllocationManager.css';

const ShiftAllocationManager = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allocating, setAllocating] = useState(false);
  const [allocationStats, setAllocationStats] = useState(null);
  const [shiftLimits, setShiftLimits] = useState({
    'A': 3,
    'B': 3,
    'C': 2
  });

  useEffect(() => {
    loadRegistrations();
  }, []);

  const loadRegistrations = async () => {
    try {
      const data = await getRegistrations();
      const approvedRegistrations = data.filter(reg => reg.approved === true);
      setRegistrations(approvedRegistrations);
    } catch (error) {
      console.error('Error loading registrations:', error);
      toast.error('Lỗi khi tải danh sách đăng ký!');
    } finally {
      setLoading(false);
    }
  };

  const handleAllocateShifts = async () => {
    if (registrations.length === 0) {
      toast.warning('Không có đăng ký nào để phân bổ!');
      return;
    }

    setAllocating(true);
    try {
      const result = await ShiftAllocationService.applyAllocation(registrations, shiftLimits);
      
      if (result.success) {
        setAllocationStats(result.stats);
        setRegistrations(result.registrations);
        toast.success('Phân bổ ca làm việc thành công!');
      } else {
        toast.error('Lỗi khi phân bổ ca: ' + result.error);
      }
    } catch (error) {
      console.error('Error allocating shifts:', error);
      toast.error('Lỗi khi phân bổ ca!');
    } finally {
      setAllocating(false);
    }
  };

  const handleLimitChange = (shift, value) => {
    const newLimit = parseInt(value) || 0;
    setShiftLimits(prev => ({
      ...prev,
      [shift]: newLimit
    }));
  };

  const getShiftOverloadInfo = () => {
    const shiftCounts = ShiftAllocationService.countShiftRegistrations(registrations);
    const overloaded = ShiftAllocationService.findOverloadedShifts(shiftCounts, shiftLimits);
    
    return Object.keys(overloaded).map(key => {
      const [date, shift] = key.split('_');
      return {
        date,
        shift,
        registered: overloaded[key].registered,
        limit: overloaded[key].limit,
        excess: overloaded[key].excess
      };
    });
  };

  if (loading) {
    return (
      <div className="allocation-manager">
        <div className="allocation-header">
          <h1>Quản lý phân bổ ca</h1>
          <button onClick={() => navigate('/xeplich-admin')} className="back-btn">
            ← Quay lại
          </button>
        </div>
        <div className="loading">Đang tải dữ liệu...</div>
      </div>
    );
  }

  const overloadInfo = getShiftOverloadInfo();

  return (
    <div className="allocation-manager">
      <div className="allocation-header">
        <h1>Quản lý phân bổ ca</h1>
        <button onClick={() => navigate('/xeplich-admin')} className="back-btn">
          ← Quay lại
        </button>
      </div>

      <div className="allocation-content">
        {/* Cấu hình giới hạn ca */}
        <div className="limits-section">
          <h3>Giới hạn số lượng nhân viên mỗi ca</h3>
          <div className="limits-grid">
            <div className="limit-item">
              <label>Ca sáng (A):</label>
              <input
                type="number"
                min="1"
                max="10"
                value={shiftLimits.A}
                onChange={(e) => handleLimitChange('A', e.target.value)}
              />
            </div>
            <div className="limit-item">
              <label>Ca chiều (B):</label>
              <input
                type="number"
                min="1"
                max="10"
                value={shiftLimits.B}
                onChange={(e) => handleLimitChange('B', e.target.value)}
              />
            </div>
            <div className="limit-item">
              <label>Ca tối (C):</label>
              <input
                type="number"
                min="1"
                max="10"
                value={shiftLimits.C}
                onChange={(e) => handleLimitChange('C', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Thông tin vượt quá giới hạn */}
        {overloadInfo.length > 0 && (
          <div className="overload-section">
            <h3>⚠️ Các ca vượt quá giới hạn</h3>
            <div className="overload-list">
              {overloadInfo.map((info, index) => (
                <div key={index} className="overload-item">
                  <span>{info.date} - Ca {info.shift}</span>
                  <span className="overload-count">
                    {info.registered}/{info.limit} (vượt {info.excess})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Thống kê hiện tại */}
        <div className="stats-section">
          <h3>Thống kê hiện tại</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <label>Tổng nhân viên:</label>
              <span>{registrations.length}</span>
            </div>
            <div className="stat-item">
              <label>Tổng ca đăng ký:</label>
              <span>{registrations.reduce((sum, reg) => sum + reg.shifts.length, 0)}</span>
            </div>
            <div className="stat-item">
              <label>Trung bình ca/người:</label>
              <span>
                {registrations.length > 0 
                  ? (registrations.reduce((sum, reg) => sum + reg.shifts.length, 0) / registrations.length).toFixed(1)
                  : 0}
              </span>
            </div>
          </div>
        </div>

        {/* Kết quả phân bổ */}
        {allocationStats && (
          <div className="result-section">
            <h3>✅ Kết quả phân bổ</h3>
            <div className="result-stats">
              <div className="stat-item">
                <label>Tổng nhân viên:</label>
                <span>{allocationStats.totalEmployees}</span>
              </div>
              <div className="stat-item">
                <label>Tổng ca sau phân bổ:</label>
                <span>{allocationStats.totalShifts}</span>
              </div>
              <div className="stat-item">
                <label>Trung bình ca/người:</label>
                <span>{allocationStats.averageShiftsPerEmployee.toFixed(1)}</span>
              </div>
            </div>
            <div className="shift-distribution">
              <h4>Phân bố ca:</h4>
              {Object.entries(allocationStats.shiftDistribution).map(([shift, count]) => (
                <div key={shift} className="distribution-item">
                  <span>{shift}:</span>
                  <span>{count} người</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nút hành động */}
        <div className="actions">
          <button
            onClick={handleAllocateShifts}
            disabled={allocating || registrations.length === 0}
            className="allocate-btn"
          >
            {allocating ? 'Đang phân bổ...' : '🤖 Phân bổ ca thông minh'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShiftAllocationManager;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRegistrations } from '../firebaseService';
import ShiftAllocationService from '../services/ShiftAllocationService';
import AIEnhancedShiftService from '../services/AIEnhancedShiftService';
import OpenAIShiftService from '../services/OpenAIShiftService';
import Toastify from 'toastify-js';
import 'toastify-js/src/toastify.css';
import '../css/ShiftAllocationManager.css';

const ShiftAllocationManager = () => {
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
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allocating, setAllocating] = useState(false);
  const [allocationStats, setAllocationStats] = useState(null);
  const [aiMode, setAiMode] = useState(false);
  const [aiMetrics, setAiMetrics] = useState(null);
  const [aiInsights, setAiInsights] = useState(null);
  const [allocationMode, setAllocationMode] = useState('auto'); // 'auto', 'enhanced', 'openai'
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
      showToast('Lỗi khi tải danh sách đăng ký!', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAllocateShifts = async () => {
    if (registrations.length === 0) {
      showToast('Không có đăng ký nào để phân bổ!', 'warning');
      return;
    }

    setAllocating(true);
    try {
      let result;
      
      if (allocationMode === 'openai') {
        // Sử dụng OpenAI Service
        result = await OpenAIShiftService.aiAllocateShifts({
          prioritizeFairness: true,
          maxShiftsPerEmployee: 5,
          optimizeFor: 'balanced'
        });
        
        if (result.success) {
          setAiInsights(result.aiInsights);
          showToast('Phân bổ ca bằng OpenAI thành công!', 'success');
        }
      } else if (allocationMode === 'enhanced') {
        // Sử dụng AI Enhanced Shift Service
        result = await AIEnhancedShiftService.aiAllocateShifts({
          prioritizeFairness: true,
          maxShiftsPerEmployee: 5,
          optimizeFor: 'balanced'
        });
        
        if (result.success) {
          setAiMetrics(result.aiMetrics);
          showToast('Phân bổ ca bằng AI Enhanced thành công!', 'success');
        }
      } else {
        // Sử dụng service hiện tại
        result = await ShiftAllocationService.applyAllocation(registrations);
        
        if (result.success) {
          showToast('Phân bổ ca làm việc tự do thành công!', 'success');
        }
      }
      
      if (result.success) {
        setAllocationStats(result.stats);
        setRegistrations(result.registrations || registrations);
      } else {
        showToast('Lỗi khi phân bổ ca: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error allocating shifts:', error);
      showToast('Lỗi khi phân bổ ca!', 'error');
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
        {/* Thông tin về phân bổ tự do */}
        <div className="info-section">
          <h3>🔓 Phân bổ tự do</h3>
          <p className="info-text">
            Chế độ phân bổ tự do - không giới hạn số lượng nhân viên cho mỗi ca.
            Tất cả đăng ký sẽ được giữ nguyên và chỉ cần xác nhận phân bổ.
          </p>
        </div>

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
            {allocating ? 'Đang phân bổ...' : '✅ Xác nhận phân bổ tự do'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShiftAllocationManager;

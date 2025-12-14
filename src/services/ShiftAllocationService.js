import { getRegistrations, updateRegistration } from '../firebaseService';

class ShiftAllocationService {
  constructor() {
    // Cấu hình mặc định cho mỗi ca
    this.defaultLimits = {
      'A': 3, // Ca sáng tối đa 3 người
      'B': 3, // Ca chiều tối đa 3 người (sẽ được điều chỉnh theo ngày)
      'C': 2  // Ca tối tối đa 2 người
    };
  }

  /**
   * Lấy giới hạn cho tất cả các ca theo ngày
   * @param {string} date - Ngày cần kiểm tra
   * @returns {Object} Giới hạn cho từng ca
   */
  getShiftLimitsByDay(date) {
    return {
      'A': this.defaultLimits['A'],
      'B': this.getBLimitByDay(date),
      'C': this.defaultLimits['C']
    };
  }

  /**
   * Lấy giới hạn cho ca B theo ngày trong tuần
   * @param {string} date - Ngày cần kiểm tra (YYYY-MM-DD)
   * @returns {number} Giới hạn cho ca B
   */
  getBLimitByDay(date) {
    const dayOfWeek = new Date(date).getDay(); // 0 = CN, 1 = Thứ 2, ..., 6 = Thứ 7
    const dayNames = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    
    // Thứ 3, 5, 7, CN -> 2 người cho ca B
    // Thứ 2, 4, 6 -> 1 người cho ca B
    if (dayOfWeek === 3 || dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
      return 2; // Thứ 3, 5, 7, CN
    } else {
      return 1; // Thứ 2, 4, 6
    }
  }

  /**
   * Phân bổ ca làm việc tự do (không giới hạn)
   * @param {Array} registrations - Danh sách đăng ký
   * @returns {Array} Danh sách đăng ký đã được phân bổ
   */
  async allocateShifts(registrations) {
    // Phân bổ tự do - giữ nguyên tất cả đăng ký
    return registrations;
  }

  /**
   * Đếm số lượng đăng ký cho mỗi ca
   */
  countShiftRegistrations(registrations) {
    const counts = {};
    
    registrations.forEach(reg => {
      reg.shifts.forEach(shift => {
        const key = `${shift.date}_${shift.shift}`;
        counts[key] = (counts[key] || 0) + 1;
      });
    });
    
    return counts;
  }

  /**
   * Tìm các ca vượt quá giới hạn
   */
  findOverloadedShifts(shiftCounts, limits) {
    const overloaded = {};
    
    Object.keys(shiftCounts).forEach(shiftKey => {
      const [date, shiftType] = shiftKey.split('_');
      let limit;
      
      // Đối với ca B, áp dụng giới hạn theo ngày
      if (shiftType === 'B') {
        limit = this.getBLimitByDay(date);
      } else {
        limit = limits[shiftType] || this.defaultLimits[shiftType];
      }
      
      if (shiftCounts[shiftKey] > limit) {
        overloaded[shiftKey] = {
          registered: shiftCounts[shiftKey],
          limit: limit,
          excess: shiftCounts[shiftKey] - limit
        };
      }
    });
    
    return overloaded;
  }

  /**
   * Xử lý phân bổ cho các ca vượt quá giới hạn
   */
  async processOverloadedShifts(registrations, overloadedShifts, limits) {
    const processedRegistrations = [...registrations];
    
    // Xử lý từng ca vượt quá giới hạn
    for (const shiftKey of Object.keys(overloadedShifts)) {
      const [date, shiftType] = shiftKey.split('_');
      const limit = limits[shiftType];
      
      // Lấy danh sách nhân viên đăng ký ca này
      const employeesForShift = this.getEmployeesForShift(processedRegistrations, date, shiftType);
      
      if (employeesForShift.length > limit) {
        // Sử dụng AI để phân bổ thông minh
        const selectedEmployees = await this.intelligentSelection(
          employeesForShift, 
          limit, 
          processedRegistrations
        );
        
        // Cập nhật lại danh sách đăng ký
        this.updateRegistrationsForShift(processedRegistrations, date, shiftType, selectedEmployees);
      }
    }
    
    return processedRegistrations;
  }

  /**
   * Lấy danh sách nhân viên đăng ký cho một ca cụ thể
   */
  getEmployeesForShift(registrations, date, shiftType) {
    const employees = [];
    
    registrations.forEach(reg => {
      const hasShift = reg.shifts.some(s => s.date === date && s.shift === shiftType);
      if (hasShift) {
        employees.push({
          employeeName: reg.employeeName,
          id: reg.id,
          totalShifts: reg.shifts.length,
          // Thêm các yếu tố để AI phân tích
          registrationOrder: reg.timestamp ? new Date(reg.timestamp).getTime() : Date.now()
        });
      }
    });
    
    return employees;
  }

  /**
   * AI phân tích và chọn nhân viên một cách thông minh
   * Cân bằng giữa: số ca đã đăng ký, thứ tự đăng ký, và độ công bằng
   */
  async intelligentSelection(employees, limit, allRegistrations) {
    // Tính toán điểm cho mỗi nhân viên
    const scoredEmployees = employees.map(employee => {
      let score = 0;
      
      // Yếu tố 1: Số ca đã đăng ký (người đăng ký ít ca hơn được ưu tiên)
      const avgShifts = this.calculateAverageShifts(allRegistrations);
      const shiftDifference = avgShifts - employee.totalShifts;
      score += shiftDifference * 10; // Trọng số cao cho sự cân bằng
      
      // Yếu tố 2: Thứ tự đăng ký (người đăng ký sớm hơn được ưu tiên nhẹ)
      const registrationBonus = Math.max(0, 1000000 - employee.registrationOrder) / 1000000;
      score += registrationBonus * 2;
      
      // Yếu tố 3: Random factor để tăng tính đa dạng
      const randomFactor = Math.random() * 0.5;
      score += randomFactor;
      
      return {
        ...employee,
        score: score
      };
    });
    
    // Sắp xếp theo điểm giảm dần
    scoredEmployees.sort((a, b) => b.score - a.score);
    
    // Chọn top limit nhân viên
    return scoredEmployees.slice(0, limit);
  }

  /**
   * Tính số ca trung bình mỗi nhân viên đăng ký
   */
  calculateAverageShifts(registrations) {
    if (registrations.length === 0) return 0;
    
    const totalShifts = registrations.reduce((sum, reg) => sum + reg.shifts.length, 0);
    return totalShifts / registrations.length;
  }

  /**
   * Cập nhật lại đăng ký cho một ca cụ thể
   */
  updateRegistrationsForShift(registrations, date, shiftType, selectedEmployees) {
    const selectedEmployeeNames = new Set(selectedEmployees.map(emp => emp.employeeName));
    
    registrations.forEach(reg => {
      // Giữ lại ca nếu nhân viên được chọn
      reg.shifts = reg.shifts.filter(shift => {
        if (shift.date === date && shift.shift === shiftType) {
          return selectedEmployeeNames.has(reg.employeeName);
        }
        return true;
      });
    });
  }

  /**
   * Lấy thống kê phân bổ ca
   */
  getAllocationStats(registrations) {
    const stats = {
      totalEmployees: registrations.length,
      totalShifts: 0,
      averageShiftsPerEmployee: 0,
      shiftDistribution: {}
    };
    
    // Tính tổng số ca
    stats.totalShifts = registrations.reduce((sum, reg) => sum + reg.shifts.length, 0);
    stats.averageShiftsPerEmployee = stats.totalEmployees > 0 ? stats.totalShifts / stats.totalEmployees : 0;
    
    // Phân bố theo loại ca
    registrations.forEach(reg => {
      reg.shifts.forEach(shift => {
        const key = `Ca ${shift.shift}`;
        stats.shiftDistribution[key] = (stats.shiftDistribution[key] || 0) + 1;
      });
    });
    
    return stats;
  }

  /**
   * Áp dụng phân bổ tự do và cập nhật vào Firebase
   */
  async applyAllocation(registrations) {
    try {
      // Phân bổ tự do - giữ nguyên đăng ký
      const allocatedRegistrations = await this.allocateShifts(registrations);
      
      // Cập nhật vào Firebase - chỉ đánh dấu đã phân bổ
      for (const reg of allocatedRegistrations) {
        await updateRegistration(reg.id, {
          allocated: true,
          allocatedAt: new Date().toISOString()
        });
      }
      
      return {
        success: true,
        registrations: allocatedRegistrations,
        stats: this.getAllocationStats(allocatedRegistrations)
      };
    } catch (error) {
      console.error('Error applying allocation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new ShiftAllocationService();

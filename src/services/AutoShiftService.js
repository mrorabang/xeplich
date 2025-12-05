import { getRegistrations, updateRegistration } from '../firebaseService';

class AutoShiftService {
  constructor() {
    // Quy định số lượng nhân viên mỗi ca
    this.shiftLimits = {
      'A': { weekday: 2, weekend: 3 }, // Ca sáng: 2 người ngày thường, 3 người cuối tuần
      'B': { weekday: 2, weekend: 2 }, // Ca chiều: 2 người cả ngày thường và cuối tuần
      'C': { weekday: 1, weekend: 1 }  // Ca tối: 1 người cả ngày thường và cuối tuần
    };
  }

  /**
   * Kiểm tra ngày là cuối tuần hay ngày thường
   */
  isWeekend(dateStr) {
    const date = new Date(dateStr);
    const day = date.getDay();
    return day === 0 || day === 6; // Chủ nhật (0) hoặc Thứ 7 (6)
  }

  /**
   * Lấy giới hạn số lượng cho một ca cụ thể
   */
  getShiftLimit(shiftType, dateStr) {
    const isWeekendDay = this.isWeekend(dateStr);
    return this.shiftLimits[shiftType][isWeekendDay ? 'weekend' : 'weekday'];
  }

  /**
   * Tự động phân bổ ca cho tất cả nhân viên đăng ký
   */
  async autoAllocateShifts() {
    try {
      // Lấy tất cả đăng ký (không cần filter approved nữa)
      const allRegistrations = await getRegistrations();
      
      if (allRegistrations.length === 0) {
        return { success: true, message: 'Không có đăng ký nào để phân bổ' };
      }

      // Đếm số lượng đăng ký cho mỗi ca
      const shiftCounts = this.countShiftsByDate(allRegistrations);
      
      // Xác định các ca cần phân bổ lại
      const overloadedShifts = this.findOverloadedShifts(shiftCounts);
      
      // Phân bổ lại các ca quá tải
      const allocatedRegistrations = await this.allocateOverloadedShifts(
        allRegistrations, 
        overloadedShifts
      );

      // Cập nhật vào Firebase
      await this.updateRegistrations(allocatedRegistrations);

      return {
        success: true,
        message: `Đã phân bổ thành công ${allocatedRegistrations.length} nhân viên`,
        allocatedCount: allocatedRegistrations.length,
        overloadCount: Object.keys(overloadedShifts).length
      };

    } catch (error) {
      console.error('Error in auto allocation:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Đếm số lượng đăng ký cho mỗi ca theo ngày
   */
  countShiftsByDate(registrations) {
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
  findOverloadedShifts(shiftCounts) {
    const overloaded = {};
    
    Object.keys(shiftCounts).forEach(shiftKey => {
      const [date, shiftType] = shiftKey.split('_');
      const limit = this.getShiftLimit(shiftType, date);
      const registered = shiftCounts[shiftKey];
      
      if (registered > limit) {
        overloaded[shiftKey] = {
          registered: registered,
          limit: limit,
          excess: registered - limit,
          date: date,
          shiftType: shiftType
        };
      }
    });
    
    return overloaded;
  }

  /**
   * Phân bổ lại các ca quá tải bằng cách random chọn
   */
  async allocateOverloadedShifts(registrations, overloadedShifts) {
    const allocatedRegistrations = [...registrations];
    
    // Nếu không có ca nào quá tải, chỉ cần mark allocated = true
    if (Object.keys(overloadedShifts).length === 0) {
      allocatedRegistrations.forEach(reg => {
        reg.allocated = true;
        reg.allocatedAt = new Date().toISOString();
      });
      return allocatedRegistrations;
    }
    
    // Xử lý từng ca quá tải
    for (const shiftKey of Object.keys(overloadedShifts)) {
      const { date, shiftType, limit, excess } = overloadedShifts[shiftKey];
      
      // Lấy danh sách nhân viên đăng ký ca này
      const employeesForShift = this.getEmployeesForShift(allocatedRegistrations, date, shiftType);
      
      if (employeesForShift.length > limit) {
        // Intelligent chọn employees được giữ lại
        const selectedEmployees = this.intelligentSelectEmployees(employeesForShift, limit, allocatedRegistrations);
        
        // Cập nhật lại đăng ký cho những người không được chọn
        this.removeShiftFromUnselectedEmployees(allocatedRegistrations, date, shiftType, selectedEmployees);
      }
    }
    
    // Mark tất cả registrations đã được allocated
    allocatedRegistrations.forEach(reg => {
      reg.allocated = true;
      reg.allocatedAt = new Date().toISOString();
    });
    
    return allocatedRegistrations;
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
          timestamp: reg.timestamp || Date.now()
        });
      }
    });
    
    return employees;
  }

  /**
   * Intelligent chọn employees từ danh sách - ưu tiên người ít ca hơn để công bằng
   */
  intelligentSelectEmployees(employees, limit, allRegistrations) {
    // Tính tổng số ca của mỗi nhân viên trong toàn bộ lịch
    const employeeShiftCounts = {};
    allRegistrations.forEach(reg => {
      employeeShiftCounts[reg.employeeName] = reg.shifts.length;
    });
    
    // Tính điểm cho mỗi nhân viên: ít ca = điểm cao hơn
    const scoredEmployees = employees.map(emp => {
      const totalShifts = employeeShiftCounts[emp.employeeName] || 0;
      // Số ca càng ít, điểm càng cao
      const score = 20 - totalShifts; // 20 điểm trừ đi số ca hiện tại
      return {
        ...emp,
        score: score,
        totalShifts: totalShifts
      };
    });
    
    // Sắp xếp theo điểm giảm dần, nếu cùng điểm thì random để công bằng
    const sorted = scoredEmployees.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score; // Người ít ca hơn lên trước
      }
      // Nếu cùng điểm, random để công bằng
      return Math.random() - 0.5;
    });
    
    // Chọn top limit
    return sorted.slice(0, limit);
  }

  /**
   * Xóa ca khỏi danh sách đăng ký của những người không được chọn
   */
  removeShiftFromUnselectedEmployees(registrations, date, shiftType, selectedEmployees) {
    const selectedNames = new Set(selectedEmployees.map(emp => emp.employeeName));
    
    registrations.forEach(reg => {
      if (!selectedNames.has(reg.employeeName)) {
        // Xóa ca này khỏi danh sách đăng ký
        reg.shifts = reg.shifts.filter(shift => 
          !(shift.date === date && shift.shift === shiftType)
        );
      }
    });
  }

  /**
   * Cập nhật tất cả registrations vào Firebase
   */
  async updateRegistrations(registrations) {
    const updatePromises = registrations.map(reg => 
      updateRegistration(reg.id, {
        shifts: reg.shifts,
        allocated: reg.allocated,
        allocatedAt: reg.allocatedAt
      })
    );
    
    await Promise.all(updatePromises);
  }

  /**
   * Lấy thông tin thống kê về phân bổ
   */
  getAllocationStats(registrations) {
    const stats = {
      totalEmployees: registrations.length,
      totalShifts: 0,
      averageShiftsPerEmployee: 0,
      shiftDistribution: {},
      overloadInfo: []
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
}

export default new AutoShiftService();

import { getSettings, getRegistrations } from '../firebaseService';

class ShiftWarningService {
  constructor() {
    this.shiftLimits = {
      'A': { weekday: 2, weekend: 3 },
      'B': { weekday: 2, weekend: 2 },
      'C': { weekday: 1, weekend: 1 }
    };
  }

  /**
   * Kiểm tra xem một ngày có phải là cuối tuần không
   */
  isWeekend(dateStr) {
    const date = new Date(dateStr);
    return date.getDay() === 0 || date.getDay() === 6; // CN hoặc T7
  }

  /**
   * Lấy giới hạn cho một loại ca trong một ngày cụ thể
   */
  getShiftLimit(shiftType, dateStr) {
    const date = new Date(dateStr);
    const day = date.getDay(); // 0=CN, 1=T2, 2=T3, 3=T4, 4=T5, 5=T6, 6=T7
    
    if (shiftType === 'B') {
      // Ca B: Thứ 3,5,7,CN được 2 người, còn lại 1 người
      return (day === 2 || day === 4 || day === 6 || day === 0) ? 2 : 1; // T3, T5, T7, CN = 2 người
    }
    
    // Giữ logic cũ cho ca A và C
    const isWeekendDay = this.isWeekend(dateStr);
    return this.shiftLimits[shiftType][isWeekendDay ? 'weekend' : 'weekday'];
  }

  /**
   * Kiểm tra các ca còn thiếu hoặc trống
   */
  async checkShiftGaps() {
    try {
      const settings = await getSettings();
      const registrations = await getRegistrations();
      
      if (!settings || !settings.dateRange) {
        return { hasWarnings: false, warnings: [] };
      }

      const allocatedRegistrations = registrations.filter(reg => reg.allocated);
      const warnings = [];

      // Lấy tất cả các ngày trong tuần
      const startDate = new Date(settings.dateRange.from);
      const endDate = new Date(settings.dateRange.to);
      const dates = [];

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }

      // Kiểm tra từng ngày và từng loại ca
      dates.forEach(date => {
        ['A', 'B', 'C'].forEach(shiftType => {
          const limit = this.getShiftLimit(shiftType, date);
          const currentCount = this.countEmployeesForShift(allocatedRegistrations, date, shiftType);
          
          if (currentCount < limit) {
            const missing = limit - currentCount;
            const dateObj = new Date(date);
            const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
            const dayName = dayNames[dateObj.getDay()];
            
            warnings.push({
              type: 'missing',
              date: date,
              dateDisplay: `${dayName} ${dateObj.getDate()}/${dateObj.getMonth() + 1}`,
              shiftType: shiftType,
              current: currentCount,
              limit: limit,
              missing: missing,
              message: `Thiếu ${missing} nhân viên cho Ca ${shiftType} ngày ${dayName} (${currentCount}/${limit})`
            });
          }
        });
      });

      return {
        hasWarnings: warnings.length > 0,
        warnings: warnings,
        totalMissing: warnings.reduce((sum, w) => sum + w.missing, 0)
      };

    } catch (error) {
      console.error('Error checking shift gaps:', error);
      return { hasWarnings: false, warnings: [] };
    }
  }

  /**
   * Đếm số nhân viên cho một ca cụ thể
   */
  countEmployeesForShift(registrations, date, shiftType) {
    let count = 0;
    
    registrations.forEach(reg => {
      const hasShift = reg.shifts.some(s => s.date === date && s.shift === shiftType);
      if (hasShift) {
        count++;
      }
    });
    
    return count;
  }

  /**
   * Lấy thống kê tổng quan
   */
  async getShiftStatistics() {
    try {
      const settings = await getSettings();
      const registrations = await getRegistrations();
      
      if (!settings || !settings.dateRange) {
        return null;
      }

      const allocatedRegistrations = registrations.filter(reg => reg.allocated);
      const stats = {
        totalEmployees: allocatedRegistrations.length,
        totalShifts: 0,
        shiftDistribution: { A: 0, B: 0, C: 0 },
        weekStats: { weekday: 0, weekend: 0 },
        warnings: []
      };

      // Đếm tổng số ca và phân phối
      allocatedRegistrations.forEach(reg => {
        reg.shifts.forEach(shift => {
          stats.totalShifts++;
          stats.shiftDistribution[shift.shift] = (stats.shiftDistribution[shift.shift] || 0) + 1;
          
          if (this.isWeekend(shift.date)) {
            stats.weekStats.weekend++;
          } else {
            stats.weekStats.weekday++;
          }
        });
      });

      // Kiểm tra cảnh báo
      const warningCheck = await this.checkShiftGaps();
      stats.warnings = warningCheck.warnings;

      return stats;

    } catch (error) {
      console.error('Error getting shift statistics:', error);
      return null;
    }
  }
}

export default new ShiftWarningService();

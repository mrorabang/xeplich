import { collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';

// Settings collection
export const saveSettings = async (settings) => {
  try {
    await setDoc(doc(db, 'settings', 'current'), settings);
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
};

// Auto shift config (cấu hình phân bổ ca)
export const saveAutoShiftConfig = async (config) => {
  try {
    await setDoc(doc(db, 'settings', 'autoShiftConfig'), config, { merge: true });
    return true;
  } catch (error) {
    console.error('Error saving auto shift config:', error);
    return false;
  }
};

export const getAutoShiftConfig = async () => {
  try {
    const docRef = doc(db, 'settings', 'autoShiftConfig');
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  } catch (error) {
    console.error('Error getting auto shift config:', error);
    return null;
  }
};

export const getSettings = async () => {
  try {
    const docRef = doc(db, 'settings', 'current');
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  } catch (error) {
    console.error('Error getting settings:', error);
    return null;
  }
};

// Registrations collection
export const saveRegistration = async (registration) => {
  try {
    const docRef = doc(collection(db, 'registrations'));
    await setDoc(docRef, registration);
    return docRef.id;
  } catch (error) {
    console.error('Error saving registration:', error);
    return null;
  }
};

export const getRegistrations = async () => {
  try {
    const q = query(collection(db, 'registrations'), orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting registrations:', error);
    return [];
  }
};

// Xóa tất cả registrations
export const clearAllRegistrations = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'registrations'));
    const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    return true;
  } catch (error) {
    console.error('Error clearing registrations:', error);
    return false;
  }
};

// Xóa schedule theo tuần
export const clearScheduleByWeek = async (weekStart) => {
  try {
    const docRef = doc(db, 'schedules', weekStart);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error('Error clearing schedule:', error);
    return false;
  }
};

// Cập nhật trạng thái duyệt của đăng ký
export const updateRegistrationStatus = async (registrationId, approved) => {
  try {
    const docRef = doc(db, 'registrations', registrationId);
    await updateDoc(docRef, { approved: approved });
    return true;
  } catch (error) {
    console.error('Error updating registration status:', error);
    return false;
  }
};

// Schedules collection
export const saveSchedule = async (schedule) => {
  try {
    const docRef = doc(collection(db, 'schedules'));
    await setDoc(docRef, schedule);
    return docRef.id;
  } catch (error) {
    console.error('Error saving schedule:', error);
    return null;
  }
};

// Kiểm tra conflict ca làm việc
export const checkShiftConflict = async (weekOf, newShifts) => {
  try {
    const docRef = doc(db, 'schedules', weekOf);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return { hasConflict: false, conflicts: [] };
    }
    
    const existingSchedule = docSnap.data();
    const existingShifts = existingSchedule.shifts || [];
    const conflicts = [];
    
    newShifts.forEach(newShift => {
      const existingShift = existingShifts.find(
        s => s.date === newShift.date && s.shift === newShift.shift
      );
      
      if (existingShift) {
        const date = new Date(newShift.date);
        const dayOfWeek = date.getDay(); // 0=CN, 1=T2, ..., 6=T7
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        let maxPeople;
        if (newShift.shift === 'C') {
          maxPeople = 1; // Ca C cố định 1 người tất cả các ngày
        } else if (isWeekend) {
          maxPeople = newShift.shift === 'A' ? 3 : 2;
        } else {
          maxPeople = 2; // T2-T6 ca A, B tối đa 2 người
        }
        
        const currentCount = existingShift.employees.length;
        const newCount = currentCount + newShift.employees.length;
        
        if (newCount > maxPeople) {
          conflicts.push({
            date: newShift.date,
            shift: newShift.shift,
            current: currentCount,
            max: maxPeople,
            newEmployees: newShift.employees
          });
        }
      }
    });
    
    return {
      hasConflict: conflicts.length > 0,
      conflicts: conflicts
    };
  } catch (error) {
    console.error('Error checking shift conflict:', error);
    return { hasConflict: true, conflicts: [] };
  }
};

// Lưu schedule với ID cố định theo tuần
export const saveScheduleByWeek = async (weekOf, newShifts) => {
  try {
    const docRef = doc(db, 'schedules', weekOf);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      // Cập nhật schedule hiện có
      const existingData = docSnap.data();
      const existingShifts = existingData.shifts || [];
      
      // Gộp shifts mới vào shifts cũ
      newShifts.forEach(newShift => {
        const existingShift = existingShifts.find(
          s => s.date === newShift.date && s.shift === newShift.shift
        );
        if (existingShift) {
          // Thêm nhân viên vào ca đã có
          newShift.employees.forEach(emp => {
            if (!existingShift.employees.includes(emp)) {
              existingShift.employees.push(emp);
            }
          });
        } else {
          // Thêm ca mới
          existingShifts.push(newShift);
        }
      });
      
      await updateDoc(docRef, { shifts: existingShifts });
    } else {
      // Tạo schedule mới
      await setDoc(docRef, { weekOf, shifts: newShifts });
    }
    return true;
  } catch (error) {
    console.error('Error saving schedule by week:', error);
    return false;
  }
};

// Xóa đăng ký
export const deleteRegistration = async (registrationId) => {
  try {
    const docRef = doc(db, 'registrations', registrationId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error('Error deleting registration:', error);
    return false;
  }
};

export const getSchedules = async () => {
  try {
    const q = query(collection(db, 'schedules'), orderBy('weekOf', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting schedules:', error);
    return [];
  }
};

// Lấy lịch sử lịch chốt với format phù hợp cho ScheduleHistory
export const getScheduleHistory = async () => {
  try {
    const schedules = await getSchedules();
    const historyData = [];

    for (const schedule of schedules) {
      const weekKey = schedule.weekOf;
      const shifts = schedule.shifts || [];

      // Tính dateRange từ weekOf
      const startDate = new Date(weekKey);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);

      const dateRange = {
        from: weekKey,
        to: endDate.toISOString().split('T')[0]
      };

      // Chuyển đổi shifts thành scheduleData format
      const scheduleData = [];
      const employeeMap = {};

      shifts.forEach(shift => {
        shift.employees.forEach(employee => {
          if (!employeeMap[employee]) {
            employeeMap[employee] = [];
          }
          employeeMap[employee].push({
            date: shift.date,
            shift: shift.shift
          });
        });
      });

      // Chuyển employeeMap thành array
      Object.keys(employeeMap).forEach(employeeName => {
        scheduleData.push({
          id: `${weekKey}_${employeeName}`,
          employeeName: employeeName,
          shifts: employeeMap[employeeName]
        });
      });

      historyData.push({
        weekKey,
        dateRange,
        scheduleData
      });
    }

    return historyData;
  } catch (error) {
    console.error('Error getting schedule history:', error);
    return [];
  }
};

// Xóa schedule theo weekKey
export const deleteScheduleByWeek = async (weekKey) => {
  try {
    const docRef = doc(db, 'schedules', weekKey);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error('Error deleting schedule by week:', error);
    return false;
  }
};

// Cập nhật registration
export const updateRegistration = async (id, data) => {
  try {
    const docRef = doc(db, 'registrations', id);
    await updateDoc(docRef, data);
    return true;
  } catch (error) {
    console.error('Error updating registration:', error);
    return false;
  }
};

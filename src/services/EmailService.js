import emailjs from '@emailjs/browser';

// Khởi tạo EmailJS
emailjs.init(process.env.REACT_APP_EMAILJS_PUBLIC_KEY);

export const sendRegistrationNotification = async (employeeName, shifts) => {
  // Kiểm tra cấu hình EmailJS
  if (!process.env.REACT_APP_EMAILJS_SERVICE_ID || 
      !process.env.REACT_APP_EMAILJS_REGISTRATION_TEMPLATE_ID ||
      !process.env.REACT_APP_EMAILJS_PUBLIC_KEY ||
      !process.env.REACT_APP_ADMIN_EMAIL) {
    console.log('EmailJS chưa được cấu hình, bỏ qua gửi email');
    return false;
  }

  try {
    // Format danh sách ca làm việc
    const shiftsText = shifts.map(s => {
      const date = new Date(s.date);
      const dayName = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()];
      const dateStr = date.toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit', year: 'numeric'});
      return `${dayName} (${dateStr}) - Ca ${s.shift}`;
    }).join('\n');

    const templateParams = {
      to_email: process.env.REACT_APP_ADMIN_EMAIL,
      employee_name: employeeName,
      shifts_list: shiftsText,
      shifts_count: shifts.length,
      registration_time: new Date().toLocaleString('vi-VN'),
      admin_link: `${window.location.origin}/xeplich-admin`
    };

    const response = await emailjs.send(
      process.env.REACT_APP_EMAILJS_SERVICE_ID,
      process.env.REACT_APP_EMAILJS_REGISTRATION_TEMPLATE_ID,
      templateParams
    );

    console.log('Email sent successfully:', response);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

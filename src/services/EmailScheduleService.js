import html2canvas from 'html2canvas';
import { getOnlyEmployeeEmails } from '../firebaseService';
import emailjs from '@emailjs/browser';

class EmailScheduleService {
  constructor() {
    // EmailJS configuration cho lịch làm việc
    this.serviceId = process.env.REACT_APP_EMAILJS_SERVICE_ID || 'your_service_id';
    this.scheduleTemplateId = process.env.REACT_APP_EMAILJS_SCHEDULE_TEMPLATE_ID || 'template_hubsnbi';
    this.registrationTemplateId = process.env.REACT_APP_EMAILJS_REGISTRATION_TEMPLATE_ID || 'template_registration';
    this.reminderTemplateId = process.env.REACT_APP_EMAILJS_REMINDER_TEMPLATE_ID || 'template_hubsnbi';
    this.publicKey = process.env.REACT_APP_EMAILJS_PUBLIC_KEY || 'your_public_key';
    
    // Initialize EmailJS
    emailjs.init(this.publicKey);
  }

  /**
   * Chụp ảnh PNG của lịch chốt
   * @param {HTMLElement} element - Element cần chụp
   * @param {string} filename - Tên file ảnh
   * @returns {Promise<string>} - Base64 string của ảnh
   */
  async captureScheduleAsImage(element, filename = 'schedule.png') {
    try {
      console.log('Capturing schedule as image...');
      
      // Giảm chất lượng ảnh để fit EmailJS limit (50KB)
      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 1, // Giảm độ phân giải từ 2 xuống 1
        logging: false,
        useCORS: true,
        allowTaint: true,
        width: element.offsetWidth, // Giảm kích thước
        height: element.offsetHeight
      });

      // Chuyển canvas thành base64 với chất lượng thấp hơn
      const imageData = canvas.toDataURL('image/jpeg', 0.7); // Dùng JPEG với quality 0.7
      
      // Kiểm tra kích thước
      const imageSizeKB = Math.round(imageData.length * 0.75 / 1024); // Base64 ~33% larger than binary
      console.log(`Image captured: ${imageSizeKB}KB (limit: 50KB)`);
      
      if (imageSizeKB > 45) { // Cần buffer nhỏ
        // Nếu vẫn quá lớn, giảm thêm chất lượng
        const smallerCanvas = await html2canvas(element, {
          backgroundColor: '#ffffff',
          scale: 0.8, // Giảm thêm scale
          logging: false,
          useCORS: true,
          allowTaint: true
        });
        
        const smallerImageData = smallerCanvas.toDataURL('image/jpeg', 0.5);
        const smallerSizeKB = Math.round(smallerImageData.length * 0.75 / 1024);
        console.log(`Reduced image: ${smallerSizeKB}KB`);
        
        return smallerImageData;
      }
      
      return imageData;
    } catch (error) {
      console.error('Error capturing schedule image:', error);
      throw new Error('Không thể chụp ảnh lịch chốt');
    }
  }

  /**
   * Gửi email với lịch làm việc qua EmailJS
   * @param {Object} scheduleData - Dữ liệu lịch
   * @param {Object} dateRange - Khoảng thời gian
   * @param {string} scheduleImage - Base64 image của lịch
   * @returns {Promise<Object>} - Kết quả gửi email
   */
  async sendScheduleEmail(scheduleData, dateRange, scheduleImage) {
    try {
      console.log('Sending schedule email via EmailJS...');
      
      // Lấy email của nhân viên (loại trừ admin)
      const employeeEmails = await getOnlyEmployeeEmails();
      
      console.log('EmailScheduleService - Employee emails to send:', employeeEmails);
      console.log('EmailScheduleService - Admin email should be excluded:', process.env.REACT_APP_ADMIN_EMAIL);
      
      if (!employeeEmails || Object.keys(employeeEmails).length === 0) {
        throw new Error('Chưa có email nhân viên nào được cấu hình!');
      }

      let sentCount = 0;
      let failedCount = 0;
      const errors = [];
      const sentEmployees = [];

      // Kiểm tra kích thước ảnh
      const imageSizeKB = Math.round(scheduleImage.length * 0.75 / 1024);
      const useImageLink = imageSizeKB > 40; // Nếu quá 40KB thì dùng link

      // Gửi email cho từng nhân viên qua EmailJS
      for (const [employeeName, email] of Object.entries(employeeEmails)) {
        if (email && email.includes('@') && email.trim() !== '') {
          try {
            const templateParams = {
              to_email: email,
              to_name: employeeName,
              subject: `Lịch làm việc từ ${new Date(dateRange.from).toLocaleDateString('vi-VN')} - ${new Date(dateRange.to).toLocaleDateString('vi-VN')}`,
              date_range: `${new Date(dateRange.from).toLocaleDateString('vi-VN')} - ${new Date(dateRange.to).toLocaleDateString('vi-VN')}`,
              schedule_image: useImageLink ? 'Xem lịch làm việc trong file đính kèm' : scheduleImage,
              employee_name: employeeName,
              current_year: new Date().getFullYear(),
              image_size_note: useImageLink ? '(Ảnh quá lớn, xem trong file đính kèm)' : ''
            };

            console.log(`Sending email to ${employeeName} at ${email}`);

            const response = await emailjs.send(this.serviceId, this.scheduleTemplateId, templateParams);
            
            if (response.status === 200) {
              sentCount++;
              sentEmployees.push(employeeName);
              console.log(`Email sent to ${employeeName} at ${email}`);
            } else {
              failedCount++;
              errors.push(`Failed to send to ${employeeName}: ${response.text}`);
            }
          } catch (error) {
            failedCount++;
            errors.push(`Failed to send to ${employeeName}: ${error.message}`);
            console.error(`Failed to send email to ${employeeName}:`, error);
          }
        } else {
          console.warn(`Invalid email for ${employeeName}: ${email}`);
        }
      }

      return {
        success: true,
        sentCount,
        failedCount,
        errors,
        sentEmployees,
        message: `Đã gửi ${sentCount} email, ${failedCount} thất bại`,
        imageSizeKB,
        useImageLink
      };
      
    } catch (error) {
      console.error('Error sending schedule email:', error);
      throw new Error('Lỗi khi gửi email: ' + error.message);
    }
  }

  /**
   * Luồng hoàn chỉnh: chụp ảnh và gửi email
   * @param {HTMLElement} scheduleElement - Element lịch cần chụp
   * @param {Object} scheduleData - Dữ liệu lịch
   * @param {Object} dateRange - Khoảng thời gian
   * @returns {Promise<Object>} - Kết quả gửi email
   */
  async sendScheduleWithImage(scheduleElement, scheduleData, dateRange) {
    try {
      // Bước 1: Chụp ảnh lịch
      const scheduleImage = await this.captureScheduleAsImage(scheduleElement);
      
      // Bước 2: Gửi email với ảnh
      const result = await this.sendScheduleEmail(scheduleData, dateRange, scheduleImage);
      
      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('Error in send schedule with image flow:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Tạo HTML template cho email (dùng cho EmailJS template)
   * @param {Object} data - Dữ liệu email
   * @returns {string} - HTML template
   */
  createEmailTemplate(data) {
    const { subject, dateRange, scheduleImage, employee_name } = data;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 10px;
            margin-bottom: 20px;
          }
          .content {
            background: #f9f9f9;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
          }
          .schedule-image {
            text-align: center;
            margin: 20px 0;
          }
          .schedule-image img {
            max-width: 100%;
            height: auto;
            border: 1px solid #ddd;
            border-radius: 5px;
          }
          .footer {
            text-align: center;
            color: #666;
            font-size: 14px;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${subject}</h1>
          <p>Tuần {{date_range}}</p>
        </div>
        
        <div class="content">
          <p>Chào {{to_name}},</p>
          <p>Bạn nhận được email này với lịch làm việc được phân bổ cho tuần tới. Vui lòng xem chi tiết trong ảnh bên dưới.</p>
          
          <div class="schedule-image">
            <img src="{{schedule_image}}" alt="Lịch làm việc" />
          </div>
          
          <p><strong>Lưu ý:</strong></p>
          <ul>
            <li>Vui lòng đến đúng giờ theo lịch phân bổ</li>
            <li>Nếu có thay đổi, vui lòng báo trước cho quản lý</li>
            <li>Mọi thắc mắc xin liên hệ bộ phận quản lý</li>
          </ul>
        </div>
        
        <div class="footer">
          <p>Email này được gửi tự động từ hệ thống quản lý lịch làm việc</p>
          <p>© {{current_year}} - Công ty của bạn</p>
        </div>
      </body>
      </html>
    `;
  }
/**
   * Gửi email nhắc nhở đăng ký ca cho nhân viên chưa đăng ký
   * @param {Array} unregisteredEmployees - Danh sách nhân viên chưa đăng ký
   * @param {Object} employeeEmails - Email của nhân viên
   * @param {Object} dateRange - Khoảng thời gian đăng ký
   * @returns {Promise<Object>} - Kết quả gửi email
   */
  async sendReminderEmails(unregisteredEmployees, employeeEmails, dateRange) {
    try {
      console.log('Sending reminder emails...');
      
      let sentCount = 0;
      let failedCount = 0;
      const errors = [];
      const sentEmployees = [];

      // Gửi email cho từng nhân viên chưa đăng ký
      for (const employeeName of unregisteredEmployees) {
        const email = employeeEmails[employeeName];
        
        if (email && email.includes('@') && email.trim() !== '') {
          try {
            const templateParams = {
              to_email: email,
              to_name: employeeName,
              subject: 'Nhắc nhở đăng ký ca làm việc',
              date_range: dateRange.from && dateRange.to 
                ? `${new Date(dateRange.from).toLocaleDateString('vi-VN')} - ${new Date(dateRange.to).toLocaleDateString('vi-VN')}`
                : 'Tuần này',
              registration_deadline: dateRange.to 
                ? new Date(dateRange.to).toLocaleDateString('vi-VN')
                : 'Cuối tuần',
              current_year: new Date().getFullYear(),
              staff_page_url: `${window.location.origin}/staff`
            };

            console.log(`Sending reminder email to ${employeeName} at ${email}`);

            const response = await emailjs.send(this.serviceId, this.reminderTemplateId, templateParams);
            
            if (response.status === 200) {
              sentCount++;
              sentEmployees.push(employeeName);
              console.log(`Reminder email sent to ${employeeName} at ${email}`);
            } else {
              failedCount++;
              errors.push(`Failed to send to ${employeeName}: ${response.text}`);
            }
          } catch (error) {
            failedCount++;
            errors.push(`Failed to send to ${employeeName}: ${error.message}`);
            console.error(`Failed to send reminder email to ${employeeName}:`, error);
          }
        } else {
          console.warn(`Invalid email for ${employeeName}: ${email}`);
          failedCount++;
        }
      }

      return {
        success: true,
        sentCount,
        failedCount,
        errors,
        sentEmployees,
        message: `Đã gửi ${sentCount} email nhắc nhở, ${failedCount} thất bại`
      };
      
    } catch (error) {
      console.error('Error sending reminder emails:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new EmailScheduleService();

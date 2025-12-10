const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'build')));

// Email transporter configuration
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com', // Cần cấu hình
    pass: process.env.EMAIL_PASS || 'your-app-password'     // Cần cấu hình
  }
});

// API endpoint để gửi email lịch làm việc
app.post('/api/send-schedule-email', async (req, res) => {
  try {
    const { subject, scheduleData, dateRange, scheduleImage, employees } = req.body;

    console.log('Sending schedule email to employees:', Object.keys(employees));

    let sentCount = 0;
    let failedCount = 0;
    const errors = [];

    // Tạo HTML template
    const htmlTemplate = createEmailTemplate(subject, dateRange, scheduleImage);

    // Gửi email cho từng nhân viên
    for (const [employeeName, email] of Object.entries(employees)) {
      if (email && email.includes('@')) {
        try {
          const mailOptions = {
            from: process.env.EMAIL_USER || 'your-email@gmail.com',
            to: email,
            subject: subject,
            html: htmlTemplate.replace('{{EMPLOYEE_NAME}}', employeeName),
            attachments: [
              {
                filename: 'lich-lam-viec.png',
                content: scheduleImage.split(',')[1], // Remove data:image/png;base64, prefix
                encoding: 'base64'
              }
            ]
          };

          await transporter.sendMail(mailOptions);
          sentCount++;
          console.log(`Email sent to ${employeeName} at ${email}`);
        } catch (error) {
          failedCount++;
          errors.push(`Failed to send to ${employeeName}: ${error.message}`);
          console.error(`Failed to send email to ${employeeName}:`, error);
        }
      } else {
        console.warn(`Invalid email for ${employeeName}: ${email}`);
      }
    }

    res.json({
      success: true,
      sentCount,
      failedCount,
      errors,
      message: `Đã gửi ${sentCount} email, ${failedCount} thất bại`
    });

  } catch (error) {
    console.error('Error in send-schedule-email:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Lỗi server khi gửi email'
    });
  }
});

// HTML template function
function createEmailTemplate(subject, dateRange, scheduleImage) {
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
        <p>Tuần ${new Date(dateRange.from).toLocaleDateString('vi-VN')} - ${new Date(dateRange.to).toLocaleDateString('vi-VN')}</p>
      </div>
      
      <div class="content">
        <p>Chào {{EMPLOYEE_NAME}},</p>
        <p>Bạn nhận được email này với lịch làm việc được phân bổ cho tuần tới. Vui lòng xem chi tiết trong ảnh bên dưới.</p>
        
        <div class="schedule-image">
          <img src="${scheduleImage}" alt="Lịch làm việc" />
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
        <p>© ${new Date().getFullYear()} - Công ty của bạn</p>
      </div>
    </body>
    </html>
  `;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve React app for production
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Email server running on port ${PORT}`);
  console.log('Health check: http://localhost:' + PORT + '/api/health');
});

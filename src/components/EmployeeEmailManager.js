import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveEmployeeEmails, getEmployeeEmails } from '../firebaseService';
import Toastify from 'toastify-js';
import 'toastify-js/src/toastify.css';
import EmailScheduleService from '../services/EmailScheduleService';
import {
  MDBContainer,
  MDBRow,
  MDBCol,
  MDBCard,
  MDBCardBody,
  MDBCardTitle,
  MDBCardText,
  MDBBtn,
  MDBTable,
  MDBTableHead,
  MDBTableBody,
  MDBInput,
  MDBIcon
} from 'mdb-react-ui-kit';
import '../css/EmployeeEmailManager.css';

const EmployeeEmailManager = () => {
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
  const [settings, setSettings] = useState(null);
  const [employeeEmails, setEmployeeEmails] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [settingsData, emailsData] = await Promise.all([
        getSettings(),
        getEmployeeEmails()
      ]);
      
      setSettings(settingsData);
      
      // Dọn dẹp email của nhân viên không còn tồn tại
      if (settingsData && settingsData.employees && emailsData) {
        const cleanedEmails = {};
        settingsData.employees.forEach(emp => {
          if (emailsData[emp]) {
            cleanedEmails[emp] = emailsData[emp];
          }
        });
        
        // Nếu có email bị dọn dẹp, lưu lại
        if (Object.keys(cleanedEmails).length !== Object.keys(emailsData).length) {
          await saveEmployeeEmails(cleanedEmails);
        }
        
        setEmployeeEmails(cleanedEmails);
      } else {
        setEmployeeEmails(emailsData || {});
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      showToast('Lỗi khi tải dữ liệu!', 'error');
      setLoading(false);
    }
  };

  const handleEmailChange = (employee, email) => {
    setEmployeeEmails(prev => ({
      ...prev,
      [employee]: email
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const success = await saveEmployeeEmails(employeeEmails);
      if (success) {
        showToast('Lưu email nhân viên thành công!', 'success');
      } else {
        showToast('Lỗi khi lưu email nhân viên!', 'error');
      }
    } catch (error) {
      console.error('Error saving emails:', error);
      showToast('Lỗi khi lưu email nhân viên!', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    try {
      // Lấy danh sách nhân viên có email
      const employeesWithEmail = Object.entries(employeeEmails).filter(([name, email]) => email && email.trim() && email.includes('@'));
      
      if (employeesWithEmail.length === 0) {
        showToast('Chưa có nhân viên nào có email hợp lệ!', 'error');
        return;
      }

      // Tạo test schedule data
      const testScheduleData = {
        '2024-01-01': { morning: 'Tú', afternoon: 'Tuyền' },
        '2024-01-02': { morning: 'Tuyền', afternoon: 'Tú' }
      };
      
      const testDateRange = {
        from: new Date().toISOString(),
        to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      // Tạo element test
      const testElement = document.createElement('div');
      testElement.innerHTML = `
        <div style="padding: 20px; background: white; border: 1px solid #ddd;">
          <h3>Test Email Schedule</h3>
          <p>Đây là email test để kiểm tra hệ thống gửi mail.</p>
          <p>Gửi đến: ${employeesWithEmail.map(([name]) => name).join(', ')}</p>
        </div>
      `;
      document.body.appendChild(testElement);

      // Gửi email test
      const result = await EmailScheduleService.sendScheduleWithImage(
        testElement,
        testScheduleData,
        testDateRange
      );

      // Xóa element test
      document.body.removeChild(testElement);

      if (result.success) {
        const employeeNames = result.sentEmployees || [];
        const namesText = employeeNames.length > 0 
          ? employeeNames.join(', ') 
          : '0 nhân viên';
        showToast(`Test email thành công! Đã gửi cho: ${namesText}`, 'success');
      } else {
        showToast(result.error || 'Test email thất bại!', 'error');
      }
      
    } catch (error) {
      console.error('Error testing email:', error);
      showToast('Lỗi khi test email!', 'error');
    } finally {
      setTestingEmail(false);
    }
  };

  const handleAutoFill = () => {
    const autoEmails = {};
    // settings.employees.forEach(emp => {
    //   // Tạo email tự động dựa trên tên nhân viên
    //   const cleanName = emp.toLowerCase()
    //     .replace(/\s+/g, '')
    //     .replace(/đ/g, 'd')
    //     .replace(/â/g, 'a')
    //     .replace(/ê/g, 'e')
    //     .replace(/ô/g, 'o')
    //     .replace(/ơ/g, 'o')
    //     .replace(/ư/g, 'u')
    //     .replace(/ă/g, 'a')
    //     .replace(/ấ/g, 'a')
    //     .replace(/ầ/g, 'a')
    //     .replace(/ễ/g, 'e')
    //     .replace(/ứ/g, 'u')
    //     .replace(/ớ/g, 'o')
    //     .replace(/ờ/g, 'o')
    //     .replace(/ị/g, 'i')
    //     .replace(/ị/g, 'i');
      
    //   autoEmails[emp] = `${cleanName}@gmail.com`;
    // });
    
    setEmployeeEmails(autoEmails);
    showToast('Đã tự động điền email theo tên nhân viên!', 'info');
  };

  const handleClearAll = () => {
    // if (window.confirm('Bạn có chắc muốn xóa tất cả email?')) {
    //   setEmployeeEmails({});
    //   toast.success('Đã xóa tất cả email!');
    // }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="loading">Đang tải...</div>
      </div>
    );
  }

  if (!settings || !Array.isArray(settings.employees)) {
    return (
      <div className="admin-page">
        <div className="error-container">
          <h2>Không có dữ liệu nhân viên</h2>
          <button onClick={() => navigate('/xeplich-admin')} className="back-btn">
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Quản lý Email Nhân viên</h1>
        <div className="admin-header-actions">
          <MDBBtn 
            onClick={() => navigate('/xeplich-admin')} 
            className="btn-back"
          >
            <MDBIcon fas icon="arrow-left" className="me-2" />
            Quay lại Admin
          </MDBBtn>
        </div>
      </div>

      <MDBContainer className="py-4">
        <MDBCard>
          <MDBCardBody className="p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <MDBCardTitle tag="h3" className="mb-0">
                Danh sách Email nhân viên
              </MDBCardTitle>
              {/* <div className="d-flex gap-2">
                <MDBBtn
                  onClick={handleAutoFill}
                  disabled={true}
                  color="info"
                  size="sm"
                >
                  <MDBIcon fas icon="magic" className="me-2" />
                  Tự động điền (Vô hiệu hóa)
                </MDBBtn>
                <MDBBtn
                  onClick={handleClearAll}
                  disabled={saving}
                  color="danger"
                  size="sm"
                >
                  <MDBIcon fas icon="trash" className="me-2" />
                  Xóa tất cả
                </MDBBtn>
              </div> */}
            </div>

            <MDBTable responsive striped hover>
              <MDBTableHead>
                <tr>
                  <th style={{ width: '200px' }}>
                    {/* <MDBIcon fas icon="users" className="me-2" /> */}
                    Nhân viên
                  </th>
                  <th>
                    {/* <MDBIcon fas icon="envelope" className="me-2" /> */}
                    Email
                  </th>
                </tr>
              </MDBTableHead>
              <MDBTableBody>
                {settings.employees.map((employee, index) => (
                  <tr key={index}>
                    <td>
                      <div className="d-flex align-items-center">
                        {/* <div className="employee-avatar-mdb">
                          <MDBIcon fas icon="user-circle" />
                        </div> */}
                        <span className="employee-name-mdb fw-bold">{employee}</span>
                      </div>
                    </td>
                    <td>
                      <MDBInput
                        type="email"
                        value={employeeEmails[employee] || ''}
                        onChange={(e) => handleEmailChange(employee, e.target.value)}
                        placeholder="Nhập email..."
                        size="sm"
                        className="email-input-mdb fw-bold"
                        icon={<MDBIcon fas icon="envelope" />}
                      />
                    </td>
                  </tr>
                ))}
              </MDBTableBody>
            </MDBTable>

            <div className="d-flex justify-content-center gap-3 mt-4">
              <MDBBtn
                onClick={handleSave}
                disabled={saving}
                color="primary"
                className="px-4"
              >
                <MDBIcon fas icon="save" className="me-2" />
                {saving ? 'Đang lưu...' : 'Lưu'}
              </MDBBtn>
              
              <MDBBtn
                // onClick={handleTestEmail}
                // disabled={testingEmail || saving}
                color="warning"
                className="px-4"
                disabled={true}
              >
                <MDBIcon fas icon="paper-plane" className="me-2" />
                {testingEmail ? 'Đang gửi...' : 'Gửi thử'}
              </MDBBtn>
            </div>
          </MDBCardBody>
        </MDBCard>
      </MDBContainer>
    </div>
  );
};

export default EmployeeEmailManager;

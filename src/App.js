import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import AdminLogin from './components/AdminLogin';
import AdminPage from './components/AdminPage';
import StaffPage from './components/StaffPage';
import ScheduleHistory from './components/ScheduleHistory';
import ShiftAllocationManager from './components/ShiftAllocationManager';
import ManualScheduleConverter from './components/ManualScheduleConverter';
import EmployeeEmailManager from './components/EmployeeEmailManager';
import 'toastify-js/src/toastify.css';
import './App.css';

function App() {
  const [isAdmin, setIsAdmin] = useState(false);

  const handleAdminLogin = () => {
    setIsAdmin(true);
  };

  const handleAdminLogout = () => {
    // Xóa cache login
    localStorage.removeItem('adminAuth');
    setIsAdmin(false);
  };

  return (
    <div className="App">
      <Routes>
        <Route path="/xeplich-admin" element={
          isAdmin ? 
          <AdminPage onLogout={handleAdminLogout} /> : 
          <AdminLogin onLogin={handleAdminLogin} />
        } />
        <Route path="/" element={<StaffPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/schedule-history" element={<ScheduleHistory/>} />
        <Route path="/shift-allocation" element={<ShiftAllocationManager/>} />
        <Route path="/manual-schedule" element={<ManualScheduleConverter />} />
        <Route path="/email-manager" element={
          isAdmin ? 
          <EmployeeEmailManager /> : 
          <AdminLogin onLogin={handleAdminLogin} />
        } />
      </Routes>
    </div>
  );
}

export default App;

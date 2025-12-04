import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import AdminLogin from './components/AdminLogin';
import AdminPage from './components/AdminPage';
import StaffPage from './components/StaffPage';
import { ToastProvider } from './services/ToastService';
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
    <ToastProvider>
      <div className="App">
        <Routes>
          <Route path="/xeplich-admin" element={
            isAdmin ? 
            <AdminPage onLogout={handleAdminLogout} /> : 
            <AdminLogin onLogin={handleAdminLogin} />
          } />
          <Route path="/" element={<StaffPage />} />
          <Route path="/staff" element={<StaffPage />} />
        </Routes>
      </div>
    </ToastProvider>
  );
}

export default App;

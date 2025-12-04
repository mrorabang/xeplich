import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
    <Router>
      <ToastProvider>
        <div className="App">
          <Routes>
            <Route path="/admin" element={
              isAdmin ? 
              <AdminPage onLogout={handleAdminLogout} /> : 
              <AdminLogin onLogin={handleAdminLogin} />
            } />
            <Route path="/staff" element={<StaffPage />} />
            <Route path="/" element={<Navigate to="/staff" replace />} />
          </Routes>
        </div>
      </ToastProvider>
    </Router>
  );
}

export default App;

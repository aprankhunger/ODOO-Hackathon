import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Fleet from './pages/Fleet';
import Chatbot from './pages/Chatbot';
import Login from './pages/Login';
import TechnicianDashboard from './pages/TechnicianDashboard';
import ActivityLog from './pages/ActivityLog';
import Organization from './pages/Organization';
import Allocations from './pages/Allocations';
import Bookings from './pages/Bookings';
import Maintenance from './pages/Maintenance';
import Assets from './pages/Assets';
import Audits from './pages/Audits';

const API = 'http://localhost:8001';

function App() {
  const [user, setUser] = useState(null); // { id, name, email, role, token } or { role: 'technician', devices }
  const [validating, setValidating] = useState(true);

  // Session validation on app load
  useEffect(() => {
    const token = localStorage.getItem('ia_token');
    if (!token) {
      setValidating(false);
      return;
    }
    fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('invalid session');
        return res.json();
      })
      .then((data) => setUser({ ...data.user, token }))
      .catch(() => localStorage.removeItem('ia_token'))
      .finally(() => setValidating(false));
  }, []);

  const handleLogout = async () => {
    const token = localStorage.getItem('ia_token');
    if (token) {
      try {
        await fetch(`${API}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // best effort
      }
      localStorage.removeItem('ia_token');
    }
    setUser(null);
  };

  if (validating) {
    return (
      <div className="min-h-screen bg-bg guide-grid flex items-center justify-center">
        <div className="bg-surface border-2 border-ink shadow-bauhaus-lg px-10 py-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4" aria-hidden="true">
            <div className="w-4 h-4 rounded-full bg-danger border-2 border-ink animate-bounce"></div>
            <div className="w-4 h-4 bg-primary border-2 border-ink animate-bounce [animation-delay:120ms]"></div>
            <div className="w-4 h-4 bg-accentYellow border-2 border-ink animate-bounce [animation-delay:240ms]"></div>
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted">Validating session…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  const isAdmin = user.role === 'admin';
  const isTechnician = user.role === 'technician';

  return (
    <Router>
      <Layout user={user} onLogout={handleLogout}>
        <Routes>
          {isTechnician ? (
            <>
              <Route path="/" element={<TechnicianDashboard user={user} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route path="/" element={<Dashboard user={user} />} />
              <Route path="/allocations" element={<Allocations user={user} />} />
              <Route path="/bookings" element={<Bookings user={user} />} />
              <Route path="/maintenance" element={<Maintenance user={user} />} />
              <Route path="/assets" element={<Assets user={user} />} />
              <Route path="/audits" element={<Audits user={user} />} />
              {isAdmin && <Route path="/fleet" element={<Fleet />} />}
              {isAdmin && <Route path="/chat" element={<Chatbot />} />}
              {isAdmin && <Route path="/activity" element={<ActivityLog />} />}
              {isAdmin && <Route path="/organization" element={<Organization user={user} />} />}
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;

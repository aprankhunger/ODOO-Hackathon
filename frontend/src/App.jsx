import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Chatbot from './pages/Chatbot';
import Login from './pages/Login';
import TechnicianDashboard from './pages/TechnicianDashboard';
import ActivityLog from './pages/ActivityLog';

function App() {
  const [user, setUser] = useState(null); // { role: 'admin' | 'technician', devices: [] }

  const handleLogout = () => {
    setUser(null);
  };

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <Router>
      <Layout user={user} onLogout={handleLogout}>
        <Routes>
          {user.role === 'admin' ? (
            <>
              <Route path="/" element={<Dashboard />} />
              <Route path="/chat" element={<Chatbot />} />
              <Route path="/activity" element={<ActivityLog />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route path="/" element={<TechnicianDashboard user={user} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;

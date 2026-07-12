import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Chatbot from './pages/Chatbot';
import './App.css';

// Placeholder components for routes not yet implemented
const Assets = () => <div className="text-center p-10"><h2 className="text-2xl">Assets Page</h2><p className="text-gray-400 mt-2">Coming soon...</p></div>;
const Health = () => <div className="text-center p-10"><h2 className="text-2xl">Predictive Health Page</h2><p className="text-gray-400 mt-2">Coming soon...</p></div>;
const Settings = () => <div className="text-center p-10"><h2 className="text-2xl">Settings Page</h2><p className="text-gray-400 mt-2">Coming soon...</p></div>;

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="assets" element={<Assets />} />
          <Route path="health" element={<Health />} />
          <Route path="chat" element={<Chatbot />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;

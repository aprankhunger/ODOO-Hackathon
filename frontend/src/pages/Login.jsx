import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Wrench, ArrowRight, Lock } from 'lucide-react';

const Login = ({ onLogin }) => {
  const [activeTab, setActiveTab] = useState('admin');
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [techCode, setTechCode] = useState('');
  const [error, setError] = useState('');

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminUser === 'admin' && adminPass === 'admin') {
      onLogin({ role: 'admin' });
    } else {
      setError('Invalid admin credentials. Use admin/admin');
    }
  };

  const handleTechLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:8001/api/technician/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: techCode.toUpperCase() })
      });
      if (res.ok) {
        const data = await res.json();
        onLogin({ role: 'technician', devices: data.assigned_devices });
      } else {
        setError('Invalid or expired Technician Code');
      }
    } catch (err) {
      setError('Server connection failed');
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-full max-w-md p-8 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-purple-500"></div>
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            IntelliAsset AI
          </h1>
          <p className="text-gray-400 mt-2">Secure Access Portal</p>
        </div>

        <div className="flex bg-surfaceHover rounded-xl p-1 mb-6">
          <button 
            className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center space-x-2 transition-all ${activeTab === 'admin' ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
            onClick={() => { setActiveTab('admin'); setError(''); }}
          >
            <Shield size={16} /> <span>Admin</span>
          </button>
          <button 
            className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center space-x-2 transition-all ${activeTab === 'technician' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
            onClick={() => { setActiveTab('technician'); setError(''); }}
          >
            <Wrench size={16} /> <span>Technician</span>
          </button>
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/20 text-danger text-sm p-3 rounded-lg mb-4 text-center">
            {error}
          </div>
        )}

        {activeTab === 'admin' ? (
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
              <input 
                type="text" 
                value={adminUser}
                onChange={e => setAdminUser(e.target.value)}
                className="w-full bg-surfaceHover border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                placeholder="admin"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
              <input 
                type="password" 
                value={adminPass}
                onChange={e => setAdminPass(e.target.value)}
                className="w-full bg-surfaceHover border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                placeholder="••••••••"
              />
            </div>
            <button type="submit" className="w-full bg-primary hover:bg-blue-600 text-white py-3 rounded-lg font-medium shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center space-x-2 mt-6">
              <Lock size={18} /> <span>Secure Login</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleTechLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Assignment Code</label>
              <input 
                type="text" 
                value={techCode}
                onChange={e => setTechCode(e.target.value)}
                className="w-full bg-surfaceHover border border-border rounded-lg px-4 py-4 text-white text-center text-2xl font-mono tracking-widest uppercase focus:outline-none focus:border-purple-500 transition-colors"
                placeholder="TECH-XXXX"
              />
              <p className="text-xs text-gray-500 text-center mt-3">Enter the code provided by your administrator.</p>
            </div>
            <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-medium shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center space-x-2 mt-6">
              <span>Access Tickets</span> <ArrowRight size={18} />
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default Login;

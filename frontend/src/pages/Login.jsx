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
    <div className="min-h-screen bg-bg guide-grid flex items-center justify-center p-4 relative overflow-hidden">
      {/* Hanging decorative geometry */}
      <div className="hidden md:block absolute top-0 left-[18%] pointer-events-none" aria-hidden="true">
        <div className="w-px h-40 bg-ink mx-auto"></div>
        <div className="w-14 h-14 rounded-full bg-danger border-2 border-ink animate-sway origin-top"></div>
      </div>
      <div className="hidden md:block absolute top-0 right-[16%] pointer-events-none" aria-hidden="true">
        <div className="w-px h-24 bg-ink mx-auto"></div>
        <div className="w-12 h-12 bg-accentYellow border-2 border-ink rotate-12 animate-sway-slow origin-top"></div>
      </div>
      <div className="hidden md:block absolute bottom-10 left-[10%] pointer-events-none animate-float-y" aria-hidden="true">
        <div
          className="w-0 h-0"
          style={{
            borderLeft: '30px solid transparent',
            borderRight: '30px solid transparent',
            borderBottom: '52px solid #1E4FD8',
          }}
        ></div>
      </div>
      <div className="hidden md:block absolute bottom-24 right-[8%] w-20 h-20 rounded-full border-2 border-ink bg-surface pointer-events-none animate-float-y" aria-hidden="true"></div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-surface border-2 border-ink shadow-bauhaus-lg w-full max-w-md p-8 relative"
      >
        {/* Bauhaus color bar */}
        <div className="absolute top-0 left-0 w-full h-2 flex" aria-hidden="true">
          <div className="flex-1 bg-danger"></div>
          <div className="flex-1 bg-accentYellow"></div>
          <div className="flex-1 bg-primary"></div>
        </div>

        <div className="text-center mb-8 mt-4">
          <div className="flex items-center justify-center gap-2 mb-3" aria-hidden="true">
            <div className="w-5 h-5 rounded-full bg-danger border-2 border-ink"></div>
            <div className="w-5 h-5 bg-primary border-2 border-ink"></div>
            <div
              className="w-0 h-0"
              style={{
                borderLeft: '11px solid transparent',
                borderRight: '11px solid transparent',
                borderBottom: '19px solid #F2B305',
              }}
            ></div>
          </div>
          <h1 className="text-3xl font-display font-black uppercase tracking-tight text-ink">
            IntelliAsset AI
          </h1>
          <p className="text-muted mt-2 text-sm uppercase tracking-widest font-medium">Secure Access Portal</p>
        </div>

        <div className="flex border-2 border-ink mb-6">
          <button
            className={`flex-1 py-2.5 text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-colors ${activeTab === 'admin' ? 'bg-primary text-white' : 'bg-surface text-ink hover:bg-surfaceHover'}`}
            onClick={() => { setActiveTab('admin'); setError(''); }}
          >
            <Shield size={16} /> <span>Admin</span>
          </button>
          <button
            className={`flex-1 py-2.5 text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 border-l-2 border-ink transition-colors ${activeTab === 'technician' ? 'bg-accentYellow text-ink' : 'bg-surface text-ink hover:bg-surfaceHover'}`}
            onClick={() => { setActiveTab('technician'); setError(''); }}
          >
            <Wrench size={16} /> <span>Technician</span>
          </button>
        </div>

        {error && (
          <div className="bg-danger text-white border-2 border-ink text-sm font-medium p-3 mb-4 text-center">
            {error}
          </div>
        )}

        {activeTab === 'admin' ? (
          <form onSubmit={handleAdminLogin} className="flex flex-col gap-4">
            <div>
              <label htmlFor="admin-user" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1.5">Username</label>
              <input
                id="admin-user"
                type="text"
                value={adminUser}
                onChange={e => setAdminUser(e.target.value)}
                className="w-full bg-surface border-2 border-ink px-4 py-3 text-ink placeholder:text-muted focus:outline-none focus:shadow-bauhaus-sm transition-shadow"
                placeholder="admin"
              />
            </div>
            <div>
              <label htmlFor="admin-pass" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1.5">Password</label>
              <input
                id="admin-pass"
                type="password"
                value={adminPass}
                onChange={e => setAdminPass(e.target.value)}
                className="w-full bg-surface border-2 border-ink px-4 py-3 text-ink placeholder:text-muted focus:outline-none focus:shadow-bauhaus-sm transition-shadow"
                placeholder="••••••••"
              />
            </div>
            <button type="submit" className="btn-bauhaus w-full bg-primary text-white py-3 flex items-center justify-center gap-2 mt-4">
              <Lock size={18} /> <span>Secure Login</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleTechLogin} className="flex flex-col gap-4">
            <div>
              <label htmlFor="tech-code" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1.5">Assignment Code</label>
              <input
                id="tech-code"
                type="text"
                value={techCode}
                onChange={e => setTechCode(e.target.value)}
                className="w-full bg-surface border-2 border-ink px-4 py-4 text-ink text-center text-2xl font-mono tracking-widest uppercase placeholder:text-muted focus:outline-none focus:shadow-bauhaus-sm transition-shadow"
                placeholder="TECH-XXXX"
              />
              <p className="text-xs text-muted text-center mt-3">Enter the code provided by your administrator.</p>
            </div>
            <button type="submit" className="btn-bauhaus w-full bg-accentYellow text-ink py-3 flex items-center justify-center gap-2 mt-4">
              <span>Access Tickets</span> <ArrowRight size={18} />
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default Login;

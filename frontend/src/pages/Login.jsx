import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Wrench, ArrowRight, Lock, UserPlus, KeyRound, Home } from 'lucide-react';

const API = 'http://localhost:8001';

const inputClass =
  'w-full bg-surface border-2 border-ink px-4 py-3 text-ink placeholder:text-muted focus:outline-none focus:shadow-bauhaus-sm transition-shadow';
const labelClass = 'block text-xs font-bold uppercase tracking-widest text-ink mb-1.5';

const Login = ({ onLogin }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('signin'); // signin | signup | technician
  const [mode, setMode] = useState('form'); // form | forgot | reset
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  // Sign in / sign up fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // Forgot / reset fields
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [demoCode, setDemoCode] = useState('');

  // Technician
  const [techCode, setTechCode] = useState('');

  const clearMessages = () => { setError(''); setInfo(''); };

  const post = async (path, body) => {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'Something went wrong');
    return data;
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const data = await post('/api/auth/login', { email, password });
      localStorage.setItem('ia_token', data.token);
      onLogin({ ...data.user, token: data.token });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const data = await post('/api/auth/signup', { name, email, password });
      localStorage.setItem('ia_token', data.token);
      onLogin({ ...data.user, token: data.token });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const data = await post('/api/auth/forgot-password', { email });
      setDemoCode(data.demo_reset_code);
      setInfo('Demo mode: your reset code is shown below (no email service configured).');
      setMode('reset');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const data = await post('/api/auth/reset-password', { email, code: resetCode, new_password: newPassword });
      setInfo(data.message);
      setMode('form');
      setActiveTab('signin');
      setPassword('');
      setResetCode('');
      setNewPassword('');
      setDemoCode('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTechLogin = async (e) => {
    e.preventDefault();
    clearMessages();
    try {
      const res = await fetch(`${API}/api/technician/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: techCode.toUpperCase() }),
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

  const switchTab = (tab) => {
    setActiveTab(tab);
    setMode('form');
    clearMessages();
  };

  return (
    <div className="min-h-screen bg-bg guide-grid flex items-center justify-center p-4 relative overflow-hidden">
      {/* Home Button */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 bg-surface border-2 border-ink rounded-none shadow-bauhaus-sm hover:shadow-bauhaus-sm font-bold text-xs uppercase tracking-wide transition-all"
        aria-label="Back to home"
      >
        <Home size={16} />
        <span>Home</span>
      </button>
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

        <div className="text-center mb-6 mt-4">
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
            className={`flex-1 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'signin' ? 'bg-primary text-white' : 'bg-surface text-ink hover:bg-surfaceHover'}`}
            onClick={() => switchTab('signin')}
          >
            <Shield size={15} /> <span>Sign In</span>
          </button>
          <button
            className={`flex-1 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 border-l-2 border-ink transition-colors ${activeTab === 'signup' ? 'bg-danger text-white' : 'bg-surface text-ink hover:bg-surfaceHover'}`}
            onClick={() => switchTab('signup')}
          >
            <UserPlus size={15} /> <span>Sign Up</span>
          </button>
          <button
            className={`flex-1 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 border-l-2 border-ink transition-colors ${activeTab === 'technician' ? 'bg-accentYellow text-ink' : 'bg-surface text-ink hover:bg-surfaceHover'}`}
            onClick={() => switchTab('technician')}
          >
            <Wrench size={15} /> <span>Tech</span>
          </button>
        </div>

        {error && (
          <div className="bg-danger text-white border-2 border-ink text-sm font-medium p-3 mb-4 text-center" role="alert">
            {error}
          </div>
        )}
        {info && (
          <div className="bg-accentYellow text-ink border-2 border-ink text-sm font-medium p-3 mb-4 text-center" role="status">
            {info}
          </div>
        )}

        {activeTab === 'signin' && mode === 'form' && (
          <form onSubmit={handleSignIn} className="flex flex-col gap-4">
            <div>
              <label htmlFor="signin-email" className={labelClass}>Email</label>
              <input
                id="signin-email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label htmlFor="signin-pass" className={labelClass}>Password</label>
              <input
                id="signin-pass"
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-bauhaus w-full bg-primary text-white py-3 flex items-center justify-center gap-2 mt-2 disabled:opacity-60">
              <Lock size={18} /> <span>{loading ? 'Signing in…' : 'Secure Login'}</span>
            </button>
            <button
              type="button"
              onClick={() => { setMode('forgot'); clearMessages(); }}
              className="text-xs font-bold uppercase tracking-widest text-primary hover:text-ink text-center transition-colors"
            >
              Forgot password?
            </button>
          </form>
        )}

        {activeTab === 'signin' && mode === 'forgot' && (
          <form onSubmit={handleForgot} className="flex flex-col gap-4">
            <p className="text-sm text-muted text-center">
              Enter your account email and we&apos;ll generate a reset code.
            </p>
            <div>
              <label htmlFor="forgot-email" className={labelClass}>Email</label>
              <input
                id="forgot-email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@company.com"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-bauhaus w-full bg-danger text-white py-3 flex items-center justify-center gap-2 mt-2 disabled:opacity-60">
              <KeyRound size={18} /> <span>{loading ? 'Generating…' : 'Get Reset Code'}</span>
            </button>
            <button
              type="button"
              onClick={() => { setMode('form'); clearMessages(); }}
              className="text-xs font-bold uppercase tracking-widest text-muted hover:text-ink text-center transition-colors"
            >
              Back to sign in
            </button>
          </form>
        )}

        {activeTab === 'signin' && mode === 'reset' && (
          <form onSubmit={handleReset} className="flex flex-col gap-4">
            {demoCode && (
              <div className="border-2 border-ink bg-bg p-3 text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-muted mb-1">Demo Reset Code</p>
                <p className="text-2xl font-mono font-black tracking-[0.3em] text-ink">{demoCode}</p>
              </div>
            )}
            <div>
              <label htmlFor="reset-code" className={labelClass}>Reset Code</label>
              <input
                id="reset-code"
                type="text"
                required
                value={resetCode}
                onChange={e => setResetCode(e.target.value)}
                className={`${inputClass} text-center font-mono tracking-widest`}
                placeholder="6-digit code"
              />
            </div>
            <div>
              <label htmlFor="reset-pass" className={labelClass}>New Password</label>
              <input
                id="reset-pass"
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className={inputClass}
                placeholder="At least 6 characters"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-bauhaus w-full bg-primary text-white py-3 flex items-center justify-center gap-2 mt-2 disabled:opacity-60">
              <KeyRound size={18} /> <span>{loading ? 'Resetting…' : 'Reset Password'}</span>
            </button>
            <button
              type="button"
              onClick={() => { setMode('form'); clearMessages(); }}
              className="text-xs font-bold uppercase tracking-widest text-muted hover:text-ink text-center transition-colors"
            >
              Back to sign in
            </button>
          </form>
        )}

        {activeTab === 'signup' && (
          <form onSubmit={handleSignUp} className="flex flex-col gap-4">
            <div>
              <label htmlFor="signup-name" className={labelClass}>Full Name</label>
              <input
                id="signup-name"
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className={inputClass}
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label htmlFor="signup-email" className={labelClass}>Email</label>
              <input
                id="signup-email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label htmlFor="signup-pass" className={labelClass}>Password</label>
              <input
                id="signup-pass"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={inputClass}
                placeholder="At least 6 characters"
              />
            </div>
            <p className="text-xs text-muted text-center border-2 border-ink bg-bg p-2.5">
              New accounts start as <span className="font-bold text-ink">Employee</span>. Roles are assigned by an Admin from the Employee Directory.
            </p>
            <button type="submit" disabled={loading} className="btn-bauhaus w-full bg-danger text-white py-3 flex items-center justify-center gap-2 mt-1 disabled:opacity-60">
              <UserPlus size={18} /> <span>{loading ? 'Creating account…' : 'Create Account'}</span>
            </button>
          </form>
        )}

        {activeTab === 'technician' && (
          <form onSubmit={handleTechLogin} className="flex flex-col gap-4">
            <div>
              <label htmlFor="tech-code" className={labelClass}>Assignment Code</label>
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

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, MessageSquare, LogOut, Shield, Wrench } from 'lucide-react';

const Layout = ({ children, user, onLogout }) => {
  const location = useLocation();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col md:flex-row guide-grid">
      {/* Sidebar Navigation */}
      <nav className="w-full md:w-64 bg-surface border-b-2 md:border-b-0 md:border-r-2 border-ink p-4 flex flex-col justify-between md:min-h-screen">
        <div>
          {/* Logo lockup: Bauhaus circle / square / triangle */}
          <div className="flex items-center gap-3 mb-8 px-2 mt-4">
            <div className="relative w-9 h-9 flex-shrink-0">
              <div className="absolute inset-0 bg-primary border-2 border-ink"></div>
              <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-danger border-2 border-ink"></div>
            </div>
            <h1 className="text-xl font-display font-black uppercase tracking-tight text-ink">
              IntelliAsset
            </h1>
          </div>

          <div className="mb-6 px-2">
            <div className={`text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1 px-2 py-1 border-2 border-ink w-fit ${isAdmin ? 'bg-primary text-white' : 'bg-accentYellow text-ink'}`}>
              {isAdmin ? <><Shield size={13} /> Admin Mode</> : <><Wrench size={13} /> Technician</>}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {isAdmin ? (
              <>
                <Link
                  to="/"
                  className={`flex items-center gap-3 px-4 py-3 border-2 border-ink font-bold uppercase text-sm tracking-wide transition-all ${location.pathname === '/' ? 'bg-primary text-white shadow-bauhaus-sm' : 'bg-surface text-ink hover:bg-surfaceHover'}`}
                >
                  <Activity size={18} />
                  <span>Fleet Dashboard</span>
                </Link>
                <Link
                  to="/chat"
                  className={`flex items-center gap-3 px-4 py-3 border-2 border-ink font-bold uppercase text-sm tracking-wide transition-all ${location.pathname === '/chat' ? 'bg-primary text-white shadow-bauhaus-sm' : 'bg-surface text-ink hover:bg-surfaceHover'}`}
                >
                  <MessageSquare size={18} />
                  <span>AI Insights</span>
                </Link>
              </>
            ) : (
              <Link
                to="/"
                className={`flex items-center gap-3 px-4 py-3 border-2 border-ink font-bold uppercase text-sm tracking-wide transition-all ${location.pathname === '/' ? 'bg-accentYellow text-ink shadow-bauhaus-sm' : 'bg-surface text-ink hover:bg-surfaceHover'}`}
              >
                <Wrench size={18} />
                <span>My Tickets</span>
              </Link>
            )}
          </div>

          {/* Decorative Bauhaus stack */}
          <div className="hidden md:flex items-end gap-2 mt-10 px-2" aria-hidden="true">
            <div className="w-6 h-6 rounded-full bg-danger border-2 border-ink"></div>
            <div className="w-6 h-10 bg-accentYellow border-2 border-ink"></div>
            <div
              className="w-0 h-0"
              style={{
                borderLeft: '14px solid transparent',
                borderRight: '14px solid transparent',
                borderBottom: '24px solid #1E4FD8',
              }}
            ></div>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="mt-6 md:mt-auto flex items-center gap-3 px-4 py-3 border-2 border-ink bg-surface text-ink font-bold uppercase text-sm tracking-wide hover:bg-danger hover:text-white transition-colors text-left"
        >
          <LogOut size={18} />
          <span>Log out</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto relative">
        {/* Hanging decorative elements */}
        <div className="hidden lg:block absolute top-0 left-[12%] pointer-events-none" aria-hidden="true">
          <div className="w-px h-16 bg-ink mx-auto"></div>
          <div className="w-8 h-8 rounded-full bg-danger border-2 border-ink animate-sway origin-top"></div>
        </div>
        <div className="hidden lg:block absolute top-0 left-[5%] pointer-events-none" aria-hidden="true">
          <div className="w-px h-9 bg-ink mx-auto"></div>
          <div className="w-6 h-6 bg-accentYellow border-2 border-ink animate-sway-slow origin-top"></div>
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;

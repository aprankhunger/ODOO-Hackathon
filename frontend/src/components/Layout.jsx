import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, MessageSquare, LogOut, Shield, Wrench } from 'lucide-react';

// A hanging pendulum: string + shape sway together from the top anchor
const Hanger = ({ left, stringH, swayClass, children }) => (
  <div
    className="absolute top-0 pointer-events-none"
    style={{ left }}
    aria-hidden="true"
  >
    <div className={`flex flex-col items-center ${swayClass} origin-top`}>
      <div className={`w-px ${stringH} bg-ink`}></div>
      {children}
    </div>
  </div>
);

const Layout = ({ children, user, onLogout }) => {
  const location = useLocation();
  const isAdmin = user?.role === 'admin';

  const linkClass = (active, activeBg = 'bg-primary text-white') =>
    `flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 md:py-3 border-2 border-ink font-bold uppercase text-xs md:text-sm tracking-wide transition-all whitespace-nowrap ${
      active ? `${activeBg} shadow-bauhaus-sm` : 'bg-surface text-ink hover:bg-surfaceHover'
    }`;

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col md:flex-row guide-grid">
      {/* Sidebar Navigation */}
      <nav className="w-full md:w-64 bg-surface border-b-2 md:border-b-0 md:border-r-2 border-ink p-4 flex flex-row md:flex-col items-center md:items-stretch justify-between gap-3 md:min-h-screen">
        <div className="flex flex-row md:flex-col items-center md:items-stretch gap-3 md:gap-0 min-w-0 flex-1 md:flex-none">
          {/* Logo lockup: Bauhaus circle / square */}
          <div className="flex items-center gap-3 md:mb-8 px-0 md:px-2 md:mt-4 flex-shrink-0">
            <div className="relative w-8 h-8 md:w-9 md:h-9 flex-shrink-0">
              <div className="absolute inset-0 bg-primary border-2 border-ink"></div>
              <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-danger border-2 border-ink"></div>
            </div>
            <h1 className="hidden sm:block text-lg md:text-xl font-display font-black uppercase tracking-tight text-ink">
              IntelliAsset
            </h1>
          </div>

          <div className="hidden md:block mb-6 px-2">
            <div className={`text-xs font-bold uppercase tracking-widest flex items-center gap-1 px-2 py-1 border-2 border-ink w-fit ${isAdmin ? 'bg-primary text-white' : 'bg-accentYellow text-ink'}`}>
              {isAdmin ? <><Shield size={13} /> Admin Mode</> : <><Wrench size={13} /> Technician</>}
            </div>
          </div>

          <div className="flex flex-row md:flex-col gap-2 md:gap-3 overflow-x-auto md:overflow-visible min-w-0">
            {isAdmin ? (
              <>
                <Link to="/" className={linkClass(location.pathname === '/')}>
                  <Activity size={18} className="flex-shrink-0" />
                  <span className="hidden sm:inline">Fleet Dashboard</span>
                  <span className="sm:hidden">Fleet</span>
                </Link>
                <Link to="/chat" className={linkClass(location.pathname === '/chat')}>
                  <MessageSquare size={18} className="flex-shrink-0" />
                  <span className="hidden sm:inline">AI Insights</span>
                  <span className="sm:hidden">AI</span>
                </Link>
              </>
            ) : (
              <Link to="/" className={linkClass(location.pathname === '/', 'bg-accentYellow text-ink')}>
                <Wrench size={18} className="flex-shrink-0" />
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
          className="md:mt-auto flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 md:py-3 border-2 border-ink bg-surface text-ink font-bold uppercase text-xs md:text-sm tracking-wide hover:bg-danger hover:text-white transition-colors text-left flex-shrink-0"
        >
          <LogOut size={18} className="flex-shrink-0" />
          <span className="hidden sm:inline">Log out</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 lg:pt-24 overflow-y-auto relative">
        {/* Hanging decorative elements — live inside the reserved top padding (lg:pt-24 = 96px), so they never overlap content */}
        <div className="hidden lg:block" aria-hidden="true">
          <Hanger left="8%" stringH="h-8" swayClass="animate-sway-slow">
            <div className="w-6 h-6 bg-accentYellow border-2 border-ink"></div>
          </Hanger>
          <Hanger left="20%" stringH="h-12" swayClass="animate-sway">
            <div className="w-8 h-8 rounded-full bg-danger border-2 border-ink"></div>
          </Hanger>
          <Hanger left="50%" stringH="h-6" swayClass="animate-sway-slow">
            <div
              className="w-0 h-0"
              style={{
                borderLeft: '12px solid transparent',
                borderRight: '12px solid transparent',
                borderBottom: '20px solid #1E4FD8',
              }}
            ></div>
          </Hanger>
          <Hanger left="88%" stringH="h-10" swayClass="animate-sway">
            <div className="w-6 h-6 bg-primary border-2 border-ink"></div>
          </Hanger>
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, MessageSquare, Menu, LogOut, Shield, Wrench } from 'lucide-react';

const Layout = ({ children, user, onLogout }) => {
  const location = useLocation();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <nav className="w-full md:w-64 bg-surface/50 backdrop-blur-xl border-b md:border-b-0 md:border-r border-border p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center space-x-3 mb-8 px-2 mt-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/20">
              <Activity size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
              IntelliAsset
            </h1>
          </div>
          
          <div className="mb-6 px-2">
            <div className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center ${isAdmin ? 'text-primary' : 'text-purple-500'}`}>
              {isAdmin ? <><Shield size={14} className="mr-1"/> Admin Mode</> : <><Wrench size={14} className="mr-1"/> Technician Mode</>}
            </div>
          </div>

          <div className="space-y-2">
            {isAdmin ? (
              <>
                <Link to="/" className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${location.pathname === '/' ? 'bg-primary text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:bg-surfaceHover hover:text-white'}`}>
                  <Activity size={20} />
                  <span className="font-medium">Fleet Dashboard</span>
                </Link>
                <Link to="/chat" className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${location.pathname === '/chat' ? 'bg-primary text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:bg-surfaceHover hover:text-white'}`}>
                  <MessageSquare size={20} />
                  <span className="font-medium">AI Insights</span>
                </Link>
              </>
            ) : (
              <Link to="/" className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${location.pathname === '/' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-gray-400 hover:bg-surfaceHover hover:text-white'}`}>
                <Wrench size={20} />
                <span className="font-medium">My Tickets</span>
              </Link>
            )}
          </div>
        </div>

        <button 
          onClick={onLogout}
          className="mt-auto flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-danger/10 hover:text-danger transition-colors text-left"
        >
          <LogOut size={20} />
          <span className="font-medium">Log out</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto relative">
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none"></div>
        <div className="max-w-7xl mx-auto relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;

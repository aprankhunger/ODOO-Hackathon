import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, MessageSquareText, Activity, Server, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

const Layout = () => {
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Assets', path: '/assets', icon: Server },
    { name: 'Predictive Health', path: '/health', icon: Activity },
    { name: 'AI Assistant', path: '/chat', icon: MessageSquareText },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans text-white">
      {/* Sidebar */}
      <motion.aside 
        initial={{ x: -250 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-64 h-full glass border-r border-border flex flex-col z-10"
      >
        <div className="p-6 flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Activity size={18} className="text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">IntelliAsset<span className="text-primary">AI</span></h1>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                  isActive 
                    ? 'bg-primary/10 text-primary border border-primary/20 glow-primary font-medium' 
                    : 'text-gray-400 hover:text-white hover:bg-surfaceHover'
                }`
              }
            >
              <item.icon size={20} />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 mt-auto">
          <div className="glass-card p-4 rounded-xl flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700">
              <span className="text-sm font-semibold">IT</span>
            </div>
            <div>
              <p className="text-sm font-medium">IT Admin</p>
              <p className="text-xs text-gray-500">System Manager</p>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 h-full overflow-y-auto relative">
        {/* Ambient Background Gradient */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] -z-10 opacity-50 pointer-events-none"></div>
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px] -z-10 opacity-50 pointer-events-none"></div>

        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;

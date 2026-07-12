import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Server, AlertTriangle, CheckCircle2, Shield, Clock, Thermometer } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard = () => {
  const [telemetryData, setTelemetryData] = useState([]);
  const [currentStatus, setCurrentStatus] = useState({
    cpu: 0,
    ram: 0,
    disk: 0,
    status: 'Unknown',
    uptime: 'N/A',
    battery: 'N/A',
    security: 'Unknown',
    temperature: 'N/A',
    top_processes: [],
    recent_errors: [],
    disk_health: [],
    software: []
  });
  
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/telemetry');
    
    ws.onopen = () => setConnectionStatus('Connected (Live)');
    ws.onclose = () => setConnectionStatus('Disconnected');
    ws.onerror = () => setConnectionStatus('Connection Error');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      setCurrentStatus(data);

      setTelemetryData(prev => {
        const timeStr = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const newPoint = { time: timeStr, cpu: data.cpu, ram: data.ram };
        const newArray = [...prev, newPoint];
        if (newArray.length > 15) return newArray.slice(newArray.length - 15);
        return newArray;
      });
    };

    return () => ws.close();
  }, []);

  const stats = [
    { title: 'Current Status', value: currentStatus.status, icon: currentStatus.status === 'Critical' ? AlertTriangle : CheckCircle2, color: currentStatus.status === 'Critical' ? 'text-danger' : 'text-success', bg: currentStatus.status === 'Critical' ? 'bg-danger/10' : 'bg-success/10' },
    { title: 'Security', value: currentStatus.security, icon: Shield, color: currentStatus.security === 'Protected' ? 'text-success' : 'text-warning', bg: currentStatus.security === 'Protected' ? 'bg-success/10' : 'bg-warning/10' },
    { title: 'Uptime', value: currentStatus.uptime, icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Temperature', value: currentStatus.temperature, icon: Thermometer, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <header className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Fleet Overview</h2>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${connectionStatus === 'Connected (Live)' ? 'bg-success animate-pulse' : 'bg-danger'}`}></div>
            <p className="text-gray-400 text-sm">Agent Status: {connectionStatus}</p>
          </div>
        </div>
        <button className="bg-primary hover:bg-blue-600 text-white shadow-lg shadow-blue-500/30 transition-all">
          Register Asset
        </button>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <motion.div 
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="glass-card p-6 flex flex-col justify-between"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${stat.bg}`}>
                <stat.icon size={24} className={stat.color} />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-bold mb-1">{stat.value}</h3>
              <p className="text-gray-400 font-medium">{stat.title}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts / Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 glass-card p-6 min-h-[400px]">
          <h3 className="text-xl font-bold mb-6 border-b border-border pb-4">Live Hardware Telemetry</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={telemetryData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#52525b" tick={{fill: '#a1a1aa', fontSize: 12}} />
                <YAxis stroke="#52525b" tick={{fill: '#a1a1aa', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(24, 24, 27, 0.9)', borderColor: '#3f3f46', borderRadius: '8px' }} 
                  itemStyle={{ color: '#fff' }}
                />
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <Area type="monotone" dataKey="cpu" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCpu)" name="CPU %" />
                <Area type="monotone" dataKey="ram" stroke="#818cf8" fillOpacity={1} fill="url(#colorRam)" name="RAM %" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="glass-card p-6 min-h-[400px] flex flex-col">
          <h3 className="text-xl font-bold mb-4 border-b border-border pb-4">Deep Diagnostics</h3>
          <div className="space-y-4 flex-1 overflow-y-auto pr-2">
            <div className="bg-surfaceHover p-4 rounded-xl border border-border">
              <p className="text-xs text-gray-400 mb-1">Disk Usage</p>
              <div className="flex items-center space-x-3 mt-1 mb-2">
                <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-success" style={{ width: `${currentStatus.disk}%` }}></div>
                </div>
                <span className="text-sm font-medium">{currentStatus.disk}%</span>
              </div>
              {currentStatus.disk_health && currentStatus.disk_health[0] && (
                <p className="text-xs text-gray-400">SMART: {currentStatus.disk_health[0].status}</p>
              )}
            </div>
            
            <div className="bg-surfaceHover p-4 rounded-xl border border-border">
              <p className="text-xs text-gray-400 mb-2">Top Processes (CPU)</p>
              <ul className="space-y-2">
                {currentStatus.top_processes && currentStatus.top_processes.map((proc, i) => (
                  <li key={i} className="flex justify-between text-sm">
                    <span className="truncate w-32">{proc.name}</span>
                    <span className="text-warning">{proc.cpu_percent}%</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-surfaceHover p-4 rounded-xl border border-border">
              <p className="text-xs text-gray-400 mb-2">System Errors (Event Log)</p>
              {currentStatus.recent_errors && currentStatus.recent_errors.length > 0 ? (
                <ul className="space-y-2">
                  {currentStatus.recent_errors.map((err, i) => (
                    <li key={i} className="text-xs text-danger flex space-x-2">
                      <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                      <span className="truncate">{err.source} (ID: {err.id})</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-success flex items-center space-x-1"><CheckCircle2 size={12}/> <span>No recent crashes</span></p>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Dashboard;

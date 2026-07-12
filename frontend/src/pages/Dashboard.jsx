import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Server, AlertTriangle, CheckCircle2, Shield, Clock, Thermometer, UserPlus, X } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard = () => {
  const [deviceMap, setDeviceMap] = useState({});
  const [telemetryHistory, setTelemetryHistory] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  
  // Technician Assignment State
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignedCode, setAssignedCode] = useState(null);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8001/ws/dashboard');
    
    ws.onopen = () => setConnectionStatus('Connected to Central');
    ws.onclose = () => setConnectionStatus('Disconnected');
    ws.onerror = () => setConnectionStatus('Connection Error');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const { device_id, telemetry } = data;
      
      setDeviceMap(prev => ({
        ...prev,
        [device_id]: telemetry
      }));

      setTelemetryHistory(prev => {
        const timeStr = new Date(telemetry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const newPoint = { time: timeStr, cpu: telemetry.cpu, ram: telemetry.ram };
        const newArray = [...prev, newPoint];
        if (newArray.length > 15) return newArray.slice(newArray.length - 15);
        return newArray;
      });
    };

    return () => ws.close();
  }, []);

  const totalAssets = Object.keys(deviceMap).length;
  const criticalAssets = Object.values(deviceMap).filter(t => t.status === 'Critical').length;
  const healthyAssets = totalAssets - criticalAssets;
  
  const activeDevice = Object.values(deviceMap)[0] || {
    cpu: 0, ram: 0, disk: 0, status: 'Unknown', uptime: 'N/A', battery: 'N/A',
    security: 'Unknown', temperature: 'N/A', top_processes: [], recent_errors: [], disk_health: [], hostname: 'N/A', device_id: null
  };

  const handleAssignTechnician = async () => {
    if (!activeDevice.device_id) return;
    setIsAssigning(true);
    setAssignedCode(null);
    try {
      const res = await fetch('http://localhost:8001/api/admin/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: activeDevice.device_id })
      });
      const data = await res.json();
      setAssignedCode(data.code);
    } catch (err) {
      alert("Failed to assign technician");
    } finally {
      setIsAssigning(false);
    }
  };

  const stats = [
    { title: 'Total Assets', value: totalAssets.toString(), icon: Server, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Healthy Devices', value: healthyAssets.toString(), icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
    { title: 'Critical Failures', value: criticalAssets.toString(), icon: AlertTriangle, color: criticalAssets > 0 ? 'text-danger' : 'text-gray-500', bg: criticalAssets > 0 ? 'bg-danger/10' : 'bg-gray-800' },
    { title: 'Security (Active Node)', value: activeDevice.security, icon: Shield, color: activeDevice.security === 'Protected' ? 'text-success' : 'text-warning', bg: activeDevice.security === 'Protected' ? 'bg-success/10' : 'bg-warning/10' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Modal for Assigned Code */}
      {assignedCode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-surface border border-purple-500/30 p-8 rounded-2xl max-w-sm w-full relative"
          >
            <button onClick={() => setAssignedCode(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={20}/></button>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-600/20 text-purple-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Technician Assigned!</h3>
              <p className="text-gray-400 text-sm mb-6">Give this secure code to the technician. They can use it to log in and view the AI-generated repair report for this device.</p>
              
              <div className="bg-bg border border-border p-4 rounded-xl mb-6">
                <p className="text-3xl font-mono font-bold text-white tracking-widest">{assignedCode}</p>
              </div>
              
              <button onClick={() => setAssignedCode(null)} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-medium transition-colors">
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <header className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Fleet Overview</h2>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${connectionStatus.includes('Connected') ? 'bg-success animate-pulse' : 'bg-danger'}`}></div>
            <p className="text-gray-400 text-sm">Central Hub: {connectionStatus}</p>
          </div>
        </div>
        <button 
          disabled={!activeDevice.device_id || isAssigning}
          onClick={handleAssignTechnician}
          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white shadow-lg shadow-purple-500/30 transition-all px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <UserPlus size={18} />
          <span>{isAssigning ? 'Generating AI Report...' : 'Assign Technician'}</span>
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
          <h3 className="text-xl font-bold mb-2">Live Hardware Telemetry</h3>
          <p className="text-gray-400 text-sm mb-4 border-b border-border pb-4">Displaying node: {activeDevice.hostname}</p>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={telemetryHistory} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
          <h3 className="text-xl font-bold mb-4 border-b border-border pb-4">Deep Diagnostics ({activeDevice.hostname})</h3>
          <div className="space-y-4 flex-1 overflow-y-auto pr-2">
            <div className="bg-surfaceHover p-4 rounded-xl border border-border">
              <p className="text-xs text-gray-400 mb-1">Disk Usage</p>
              <div className="flex items-center space-x-3 mt-1 mb-2">
                <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-success" style={{ width: `${activeDevice.disk}%` }}></div>
                </div>
                <span className="text-sm font-medium">{activeDevice.disk}%</span>
              </div>
              {activeDevice.disk_health && activeDevice.disk_health[0] && (
                <p className="text-xs text-gray-400">SMART: {activeDevice.disk_health[0].status}</p>
              )}
            </div>
            
            <div className="bg-surfaceHover p-4 rounded-xl border border-border">
              <p className="text-xs text-gray-400 mb-2">Top Processes (CPU)</p>
              <ul className="space-y-2">
                {activeDevice.top_processes && activeDevice.top_processes.map((proc, i) => (
                  <li key={i} className="flex justify-between text-sm">
                    <span className="truncate w-32">{proc.name}</span>
                    <span className="text-warning">{proc.cpu_percent}%</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-surfaceHover p-4 rounded-xl border border-border">
              <p className="text-xs text-gray-400 mb-2">System Errors (Event Log)</p>
              {activeDevice.recent_errors && activeDevice.recent_errors.length > 0 ? (
                <ul className="space-y-2">
                  {activeDevice.recent_errors.map((err, i) => (
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

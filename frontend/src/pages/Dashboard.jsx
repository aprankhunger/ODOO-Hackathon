import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Server, AlertTriangle, CheckCircle2, Shield, UserPlus, X } from 'lucide-react';
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
    { title: 'Total Assets', value: totalAssets.toString(), icon: Server, accent: 'bg-primary', iconColor: 'text-white' },
    { title: 'Healthy Devices', value: healthyAssets.toString(), icon: CheckCircle2, accent: 'bg-success', iconColor: 'text-white' },
    { title: 'Critical Failures', value: criticalAssets.toString(), icon: AlertTriangle, accent: criticalAssets > 0 ? 'bg-danger' : 'bg-surfaceHover', iconColor: criticalAssets > 0 ? 'text-white' : 'text-ink' },
    { title: 'Security (Active Node)', value: activeDevice.security, icon: Shield, accent: activeDevice.security === 'Protected' ? 'bg-success' : 'bg-accentYellow', iconColor: activeDevice.security === 'Protected' ? 'text-white' : 'text-ink' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col gap-6"
    >
      {/* Modal for Assigned Code */}
      {assignedCode && (
        <div className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-surface border-2 border-ink shadow-bauhaus-lg p-8 max-w-sm w-full relative"
          >
            <div className="absolute top-0 left-0 w-full h-2 flex" aria-hidden="true">
              <div className="flex-1 bg-danger"></div>
              <div className="flex-1 bg-accentYellow"></div>
              <div className="flex-1 bg-primary"></div>
            </div>
            <button onClick={() => setAssignedCode(null)} aria-label="Close" className="absolute top-4 right-4 text-ink hover:text-danger"><X size={20} /></button>
            <div className="text-center mt-2">
              <div className="w-16 h-16 bg-accentYellow border-2 border-ink rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-ink" />
              </div>
              <h3 className="text-xl font-display font-black uppercase text-ink mb-2">Technician Assigned</h3>
              <p className="text-muted text-sm mb-6 leading-relaxed">Give this secure code to the technician. They can use it to log in and view the AI-generated repair report for this device.</p>

              <div className="bg-surfaceHover border-2 border-ink p-4 mb-6">
                <p className="text-3xl font-mono font-bold text-ink tracking-widest">{assignedCode}</p>
              </div>

              <button onClick={() => setAssignedCode(null)} className="btn-bauhaus w-full bg-primary text-white py-3">
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <header className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 mb-2">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-4 h-4 bg-danger border-2 border-ink rounded-full" aria-hidden="true"></div>
            <h2 className="text-3xl font-display font-black uppercase tracking-tight text-balance">Fleet Overview</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full border border-ink ${connectionStatus.includes('Connected') ? 'bg-success animate-pulse' : 'bg-danger'}`}></div>
            <p className="text-muted text-sm font-medium">Central Hub: {connectionStatus}</p>
          </div>
        </div>
        <button
          disabled={!activeDevice.device_id || isAssigning}
          onClick={handleAssignTechnician}
          className="btn-bauhaus bg-accentYellow text-ink disabled:opacity-50 px-4 py-2.5 flex items-center gap-2 text-sm"
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
            className="glass-card p-6 flex flex-col justify-between gap-4"
          >
            <div className="flex justify-between items-start">
              <div className={`p-3 border-2 border-ink ${stat.accent}`}>
                <stat.icon size={22} className={stat.iconColor} />
              </div>
              <span className="text-xs font-bold text-muted uppercase tracking-widest">0{index + 1}</span>
            </div>
            <div>
              <h3 className="text-3xl font-display font-black mb-1">{stat.value}</h3>
              <p className="text-muted font-medium text-sm uppercase tracking-wide">{stat.title}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts / Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
        <div className="lg:col-span-2 glass-card p-6 min-h-[400px]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 bg-primary border border-ink" aria-hidden="true"></div>
            <h3 className="text-xl font-display font-bold uppercase tracking-tight">Live Hardware Telemetry</h3>
          </div>
          <p className="text-muted text-sm mb-4 border-b-2 border-ink pb-4">Displaying node: {activeDevice.hostname}</p>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={telemetryHistory} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1E4FD8" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#1E4FD8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D8341E" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#D8341E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#191919" tick={{ fill: '#6B675E', fontSize: 12 }} />
                <YAxis stroke="#191919" tick={{ fill: '#6B675E', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#FFFFFF', border: '2px solid #191919', borderRadius: '0px', boxShadow: '3px 3px 0 0 #191919' }}
                  itemStyle={{ color: '#191919', fontWeight: 600 }}
                  labelStyle={{ color: '#6B675E' }}
                />
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(25,25,25,0.12)" vertical={false} />
                <Area type="monotone" dataKey="cpu" stroke="#1E4FD8" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCpu)" name="CPU %" />
                <Area type="monotone" dataKey="ram" stroke="#D8341E" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRam)" name="RAM %" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-6 min-h-[400px] flex flex-col">
          <div className="flex items-center gap-2 border-b-2 border-ink pb-4 mb-4">
            <div className="w-3 h-3 bg-accentYellow border border-ink rounded-full" aria-hidden="true"></div>
            <h3 className="text-xl font-display font-bold uppercase tracking-tight">Deep Diagnostics</h3>
          </div>
          <p className="text-xs text-muted uppercase tracking-widest font-bold mb-4">{activeDevice.hostname}</p>
          <div className="flex flex-col gap-4 flex-1 overflow-y-auto pr-2">
            <div className="bg-surfaceHover p-4 border-2 border-ink">
              <p className="text-xs font-bold uppercase tracking-widest text-ink mb-2">Disk Usage</p>
              <div className="flex items-center gap-3 mt-1 mb-2">
                <div className="flex-1 h-3 bg-surface border border-ink overflow-hidden">
                  <div className="h-full bg-success" style={{ width: `${activeDevice.disk}%` }}></div>
                </div>
                <span className="text-sm font-bold">{activeDevice.disk}%</span>
              </div>
              {activeDevice.disk_health && activeDevice.disk_health[0] && (
                <p className="text-xs text-muted">SMART: {activeDevice.disk_health[0].status}</p>
              )}
            </div>

            <div className="bg-surfaceHover p-4 border-2 border-ink">
              <p className="text-xs font-bold uppercase tracking-widest text-ink mb-3">Top Processes (CPU)</p>
              <ul className="flex flex-col gap-2">
                {activeDevice.top_processes && activeDevice.top_processes.map((proc, i) => (
                  <li key={i} className="flex justify-between text-sm">
                    <span className="truncate w-32">{proc.name}</span>
                    <span className="text-danger font-bold">{proc.cpu_percent}%</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-surfaceHover p-4 border-2 border-ink">
              <p className="text-xs font-bold uppercase tracking-widest text-ink mb-3">System Errors (Event Log)</p>
              {activeDevice.recent_errors && activeDevice.recent_errors.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {activeDevice.recent_errors.map((err, i) => (
                    <li key={i} className="text-xs text-danger flex gap-2 font-medium">
                      <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                      <span className="truncate">{err.source} (ID: {err.id})</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-success font-bold flex items-center gap-1"><CheckCircle2 size={12} /> <span>No recent crashes</span></p>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Dashboard;

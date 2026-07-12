import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, AlertTriangle, CheckCircle, Cpu, HardDrive } from 'lucide-react';

const TechnicianDashboard = ({ user }) => {
  const devices = user.devices || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <header className="mb-8 border-b border-border pb-6">
        <h2 className="text-3xl font-bold tracking-tight mb-2 text-purple-400">Technician Workspace</h2>
        <p className="text-gray-400">You have {devices.length} AI-prioritized repair tickets assigned.</p>
      </header>

      {devices.length === 0 ? (
        <div className="glass-card p-12 text-center text-gray-400">
          <CheckCircle size={48} className="mx-auto mb-4 text-success" />
          <p>No active repair tickets assigned to your code.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {devices.map((device, idx) => {
            const isHighPriority = device.priority === 1;
            const priorityColor = isHighPriority ? 'text-danger' : (device.priority === 2 ? 'text-warning' : 'text-blue-400');
            const priorityBorder = isHighPriority ? 'border-danger/30 bg-danger/5' : 'border-border glass-card';
            
            return (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.1 }}
                className={`p-6 rounded-xl border ${priorityBorder} relative overflow-hidden`}
              >
                {isHighPriority && <div className="absolute top-0 left-0 w-1 h-full bg-danger"></div>}
                
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center space-x-3 mb-1">
                      <h3 className="text-xl font-bold font-mono">{device.device_id}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full border ${isHighPriority ? 'border-danger text-danger' : 'border-gray-600 text-gray-400'}`}>
                        Priority {device.priority}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">Host: {device.hostname} | Assigned: {new Date(device.assigned_at).toLocaleString()}</p>
                  </div>
                  <button className="bg-surfaceHover hover:bg-gray-700 border border-border px-4 py-2 rounded-lg text-sm transition-colors text-white">
                    Mark Resolved
                  </button>
                </div>

                <div className="bg-bg/50 p-5 rounded-lg border border-border mt-4">
                  <h4 className="text-sm font-bold text-gray-300 mb-3 flex items-center"><ShieldAlert size={16} className="mr-2 text-purple-400"/> AI Repair Report</h4>
                  <div className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed font-mono">
                    {device.ai_report}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  );
};

export default TechnicianDashboard;

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, CheckCircle } from 'lucide-react';

const TechnicianDashboard = ({ user }) => {
  const devices = user.devices || [];

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <header className="mb-4 border-b-2 border-ink pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-4 h-4 bg-accentYellow border-2 border-ink" aria-hidden="true"></div>
          <h2 className="text-3xl font-display font-black uppercase tracking-tight text-balance">Technician Workspace</h2>
        </div>
        <p className="text-muted">You have {devices.length} AI-prioritized repair tickets assigned.</p>
      </header>

      {devices.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted">
          <div className="w-16 h-16 bg-success border-2 border-ink rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-white" />
          </div>
          <p className="font-medium">No active repair tickets assigned to your code.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {devices.map((device, idx) => {
            const isHighPriority = device.priority === 1;
            const priorityBg = isHighPriority ? 'bg-danger text-white' : (device.priority === 2 ? 'bg-accentYellow text-ink' : 'bg-primary text-white');

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.1 }}
                className="glass-card p-6 relative overflow-hidden"
              >
                {isHighPriority && <div className="absolute top-0 left-0 w-2 h-full bg-danger" aria-hidden="true"></div>}

                <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4 mb-4 pl-2">
                  <div>
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h3 className="text-xl font-bold font-mono">{device.device_id}</h3>
                      <span className={`text-xs font-bold uppercase tracking-wide px-2 py-1 border-2 border-ink ${priorityBg}`}>
                        Priority {device.priority}
                      </span>
                    </div>
                    <p className="text-sm text-muted">Host: {device.hostname} | Assigned: {new Date(device.assigned_at).toLocaleString()}</p>
                  </div>
                  <button className="btn-bauhaus bg-success text-white px-4 py-2 text-sm flex-shrink-0">
                    Mark Resolved
                  </button>
                </div>

                <div className="bg-surfaceHover p-5 border-2 border-ink mt-4 ml-2">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-ink mb-3 flex items-center"><ShieldAlert size={16} className="mr-2 text-primary" /> AI Repair Report</h4>
                  <div className="text-ink text-sm whitespace-pre-wrap leading-relaxed font-mono">
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

import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Server, AlertTriangle, CheckCircle2 } from 'lucide-react';

const Dashboard = () => {
  const stats = [
    { title: 'Total Assets', value: '1,248', icon: Server, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Healthy Devices', value: '1,192', icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
    { title: 'At Risk', value: '43', icon: Activity, color: 'text-warning', bg: 'bg-warning/10' },
    { title: 'Critical Failures', value: '13', icon: AlertTriangle, color: 'text-danger', bg: 'bg-danger/10' },
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
          <p className="text-gray-400">Real-time intelligence on your enterprise devices.</p>
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

      {/* Placeholder for Charts / Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 glass-card p-6 min-h-[400px]">
          <h3 className="text-xl font-bold mb-4 border-b border-border pb-4">System Health Trend</h3>
          <div className="flex items-center justify-center h-[300px] text-gray-500 italic">
            [Chart Component Placeholder]
          </div>
        </div>
        <div className="glass-card p-6 min-h-[400px]">
          <h3 className="text-xl font-bold mb-4 border-b border-border pb-4">Recent Alerts</h3>
          <div className="flex items-center justify-center h-[300px] text-gray-500 italic">
            [Alert List Placeholder]
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Dashboard;

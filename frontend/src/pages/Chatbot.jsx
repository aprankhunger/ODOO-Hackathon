import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Bot, User, Sparkles } from 'lucide-react';

const Chatbot = () => {
  const [messages, setMessages] = useState([
    { id: 1, sender: 'bot', text: 'Hello! I am IntelliAsset AI. How can I help you analyze your fleet today?' }
  ]);
  const [input, setInput] = useState('');

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const newMsg = { id: Date.now(), sender: 'user', text: input };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    
    // Mock response
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        id: Date.now() + 1, 
        sender: 'bot', 
        text: 'I am analyzing the telemetry data for your request. Currently, Device-X49 is showing a high CPU temperature which could lead to failure in the next 48 hours.' 
      }]);
    }, 1000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto"
    >
      <header className="mb-6 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center glow-primary">
          <Sparkles className="text-primary" size={20} />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Assistant</h2>
          <p className="text-gray-400 text-sm">Query your fleet data using natural language</p>
        </div>
      </header>

      <div className="flex-1 glass-card flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={msg.id} 
              className={`flex items-start space-x-4 ${msg.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.sender === 'bot' ? 'bg-gradient-to-tr from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30' : 'bg-gray-700'}`}>
                {msg.sender === 'bot' ? <Bot size={16} /> : <User size={16} />}
              </div>
              <div className={`px-5 py-3 rounded-2xl max-w-[80%] ${msg.sender === 'bot' ? 'bg-surface border border-border/50 rounded-tl-sm' : 'bg-primary text-white rounded-tr-sm shadow-md'}`}>
                <p className="text-sm leading-relaxed">{msg.text}</p>
              </div>
            </motion.div>
          ))}
        </div>
        
        <div className="p-4 border-t border-border bg-background/50">
          <form onSubmit={handleSend} className="relative flex items-center">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about device health, network issues, or maintenance..." 
              className="w-full bg-surface border border-border rounded-xl px-5 py-4 pr-14 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
            />
            <button 
              type="submit" 
              className="absolute right-2 p-2 bg-primary hover:bg-blue-600 rounded-lg text-white transition-colors"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  );
};

export default Chatbot;

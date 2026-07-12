import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Bot, User, Sparkles } from 'lucide-react';

const Chatbot = () => {
  const [messages, setMessages] = useState([
    { id: 1, sender: 'bot', text: 'Hello! I am IntelliAsset AI. How can I help you analyze your fleet today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || isLoading) return;

    setMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: question }]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('http://localhost:8001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Request failed');
      }
      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'bot', text: data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'bot',
        text: `Sorry, I could not reach the AI service. ${err.message}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto"
    >
      <header className="mb-6 flex items-center gap-3">
        <div className="w-11 h-11 bg-accentYellow border-2 border-ink shadow-bauhaus-sm flex items-center justify-center">
          <Sparkles className="text-ink" size={20} />
        </div>
        <div>
          <h2 className="text-2xl font-display font-black uppercase tracking-tight">AI Assistant</h2>
          <p className="text-muted text-sm">Query your fleet data using natural language</p>
        </div>
      </header>

      <div className="flex-1 bg-surface border-2 border-ink shadow-bauhaus flex flex-col overflow-hidden">
        {/* Bauhaus color bar */}
        <div className="w-full h-1.5 flex flex-shrink-0" aria-hidden="true">
          <div className="flex-1 bg-danger"></div>
          <div className="flex-1 bg-accentYellow"></div>
          <div className="flex-1 bg-primary"></div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {messages.map((msg) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={msg.id}
              className={`flex items-start gap-4 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-9 h-9 border-2 border-ink flex items-center justify-center flex-shrink-0 ${msg.sender === 'bot' ? 'bg-primary rounded-full' : 'bg-danger'}`}>
                {msg.sender === 'bot' ? <Bot size={16} className="text-white" /> : <User size={16} className="text-white" />}
              </div>
              <div className={`px-5 py-3 max-w-[80%] border-2 border-ink ${msg.sender === 'bot' ? 'bg-surfaceHover text-ink shadow-bauhaus-sm' : 'bg-primary text-white shadow-bauhaus-sm'}`}>
                <p className="text-sm leading-relaxed">{msg.text}</p>
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 border-2 border-ink flex items-center justify-center flex-shrink-0 bg-primary rounded-full">
                <Bot size={16} className="text-white" />
              </div>
              <div className="px-5 py-3 border-2 border-ink bg-surfaceHover text-ink shadow-bauhaus-sm">
                <p className="text-sm leading-relaxed animate-pulse">Analyzing fleet data...</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t-2 border-ink bg-bg">
          <form onSubmit={handleSend} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about device health, network issues, or maintenance..."
              className="w-full bg-surface border-2 border-ink px-5 py-4 pr-16 focus:outline-none focus:shadow-bauhaus-sm transition-shadow text-sm text-ink placeholder:text-muted"
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={isLoading}
              className="absolute right-2 p-2.5 bg-accentYellow border-2 border-ink text-ink hover:bg-primary hover:text-white transition-colors disabled:opacity-50"
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

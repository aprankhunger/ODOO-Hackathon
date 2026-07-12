import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { API_BASE } from '../lib/api';

const Chatbot = () => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am IntelliAsset AI. I have full access to your asset telemetry data. Ask me anything about your assets (e.g., "Which assets have high utilization?" or "Are there any maintenance concerns?").' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      });
      
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error: Failed to connect to Central Hub.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col"
    >
      <header className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight mb-2 text-primary">IntelliAsset AI</h2>
        <p className="text-gray-400">Ask natural language questions about your asset telemetry.</p>
      </header>

      <div className="flex-1 glass-card flex flex-col overflow-hidden border border-primary/20 shadow-lg shadow-primary/10">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`flex items-start space-x-4 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg ${
                msg.role === 'user' 
                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600' 
                  : 'bg-gradient-to-br from-purple-500 to-pink-600'
              }`}>
                {msg.role === 'user' ? <User size={20} className="text-white"/> : <Bot size={20} className="text-white"/>}
              </div>
              <div className={`max-w-[80%] rounded-2xl p-5 ${
                msg.role === 'user' 
                  ? 'bg-primary/20 text-white ml-auto border border-primary/30' 
                  : 'bg-surfaceHover text-gray-200 border border-border'
              }`}>
                {msg.role === 'user' ? (
                  <p>{msg.content}</p>
                ) : (
                  <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-bg prose-pre:border-border">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-start space-x-4"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg">
                <Bot size={20} className="text-white"/>
              </div>
              <div className="bg-surfaceHover rounded-2xl p-5 border border-border flex items-center space-x-3">
                <Loader2 size={18} className="animate-spin text-purple-400" />
                <span className="text-gray-400 text-sm font-medium">Analyzing asset data...</span>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-surface border-t border-border">
          <form onSubmit={handleSend} className="flex space-x-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Which laptops have the most critical errors right now?"
              className="flex-1 bg-bg border border-border rounded-xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-colors shadow-inner"
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={isLoading || !input.trim()}
              className="bg-primary hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-primary text-white rounded-xl px-6 py-4 flex items-center justify-center transition-all shadow-lg shadow-primary/20"
            >
              <Send size={20} className={isLoading ? 'opacity-50' : ''} />
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  );
};

export default Chatbot;

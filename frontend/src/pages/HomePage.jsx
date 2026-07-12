import { useState, useEffect } from 'react';
import { ChevronRight, Play, Zap, BarChart3, Users, Truck, Brain, Terminal } from 'lucide-react';

export default function HomePage() {
  const [scrollY, setScrollY] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const features = [
    {
      icon: Truck,
      title: 'Asset Management',
      description: 'Manage all your assets with real-time tracking and status updates.',
      color: 'primary'
    },
    {
      icon: Zap,
      title: 'Smart Allocations',
      description: 'Intelligent resource allocation powered by AI for optimal efficiency.',
      color: 'success'
    },
    {
      icon: BarChart3,
      title: 'Advanced Analytics',
      description: 'Comprehensive reporting and insights to drive data-informed decisions.',
      color: 'warning'
    },
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Seamless coordination between admins, technicians, and dispatch teams.',
      color: 'danger'
    },
    {
      icon: Brain,
      title: 'AI Assistant',
      description: 'Natural language chatbot agent for instant support and automation.',
      color: 'primary'
    },
    {
      icon: BarChart3,
      title: 'Maintenance Tracking',
      description: 'Schedule and track maintenance records for all assets.',
      color: 'success'
    },
  ];

  const stats = [
    { label: 'Total Assets', value: '∞', delay: 0 },
    { label: 'Real-time Tracking', value: '24/7', delay: 100 },
    { label: 'AI Agent Ready', value: '✓', delay: 200 },
  ];

  return (
    <div className="min-h-screen bg-background text-ink overflow-hidden">
      {/* Animated grid background */}
      <div className="fixed inset-0 guide-grid opacity-20 pointer-events-none" />

      {/* HERO SECTION */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 pb-20 px-4 overflow-hidden">
        {/* Animated accent elements */}
        <div 
          className="absolute w-96 h-96 bg-primary rounded-none border-4 border-ink opacity-10 -top-48 -left-48"
          style={{
            transform: `translate(${scrollY * 0.3}px, ${scrollY * 0.3}px)`,
            transition: 'transform 0.3s ease-out'
          }}
        />
        <div 
          className="absolute w-64 h-64 bg-accentYellow rounded-none border-4 border-ink opacity-10 -bottom-32 -right-32"
          style={{
            transform: `translate(${scrollY * -0.2}px, ${scrollY * -0.2}px)`,
          }}
        />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          {/* Top label */}
          <div className="inline-block mb-6 px-4 py-2 border-2 border-ink bg-accentYellow shadow-bauhaus-sm">
            <p className="text-xs font-display font-bold uppercase tracking-widest">
              [INTRODUCING]
            </p>
          </div>

          {/* Main heading */}
          <h1 className="font-display font-black text-7xl md:text-8xl leading-tight mb-6 uppercase tracking-tighter">
            <span className="text-primary">Intelli</span>
            <br />
            Asset
            <br />
            Management
          </h1>

          {/* Subheading */}
          <p className="text-lg md:text-2xl font-medium text-muted mb-12 max-w-2xl mx-auto leading-relaxed">
            Manage, track, and optimize all your assets with AI-powered insights and real-time collaboration tools.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <button className="group btn-bauhaus bg-primary text-white px-8 py-4 text-lg font-bold uppercase">
              Enter Dashboard
              <ChevronRight className="inline ml-2 group-hover:translate-x-1 transition-transform" size={20} />
            </button>
            <button className="group btn-bauhaus bg-surface border-ink text-ink px-8 py-4 text-lg font-bold uppercase flex items-center justify-center gap-2">
              <Play size={20} />
              See Demo
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 md:gap-8">
            {stats.map((stat, i) => (
              <div
                key={i}
                className="p-4 border-2 border-ink bg-surface shadow-bauhaus-sm"
                style={{
                  animation: `fadeInUp 0.6s ease-out ${stat.delay}ms forwards`,
                  opacity: 0,
                }}
              >
                <p className="text-3xl md:text-4xl font-display font-black text-primary mb-2">{stat.value}</p>
                <p className="text-xs md:text-sm uppercase font-bold tracking-wide text-muted">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI AGENT USP SECTION */}
      <section className="relative py-24 px-4 bg-primary/5">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left: Text Content */}
            <div>
              <div className="inline-block mb-4 px-3 py-1 border-2 border-ink bg-accentYellow shadow-bauhaus-sm">
                <span className="text-xs font-bold uppercase tracking-widest">[ UNIQUE ]</span>
              </div>
              
              <h2 className="font-display font-black text-5xl md:text-6xl uppercase leading-tight mb-6">
                AI Agent
                <br />
                <span className="text-primary">Command</span> Line
              </h2>

              <p className="text-base md:text-lg text-muted mb-8 leading-relaxed">
                Control your entire asset infrastructure through a powerful CLI agent. Execute commands, generate reports, and manage operations—all from your terminal with natural language processing.
              </p>

              <div className="mb-8">
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-4">Quick Start:</p>
                <div className="bg-surface border-3 border-ink shadow-bauhaus p-4 md:p-6 font-mono text-sm overflow-x-auto">
                  <pre className="text-ink">
                    <code>{`$ python agent/main.py

> assets allocate --strategy optimal
> assets report --type maintenance
> assets list --status active
> assets analyze --period month`}</code>
                  </pre>
                </div>
              </div>

              <button className="btn-bauhaus bg-ink text-surface px-6 py-3 font-bold uppercase text-sm flex items-center gap-2">
                <Terminal size={18} />
                View CLI Docs
              </button>
            </div>

            {/* Right: Terminal Visual */}
            <div className="relative">
              <div className="bg-ink border-4 border-ink shadow-bauhaus-lg p-6">
                <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-accentYellow">
                  <p className="text-accentYellow font-mono text-xs font-bold">$ FLEET_AGENT.py</p>
                  <div className="flex gap-1">
                    <div className="w-3 h-3 bg-danger border border-accentYellow" />
                    <div className="w-3 h-3 bg-warning border border-accentYellow" />
                    <div className="w-3 h-3 bg-success border border-accentYellow" />
                  </div>
                </div>
                
                <div className="space-y-2 font-mono text-xs text-accentYellow">
                  <p>{'> allocate assets --ai-optimized true'}</p>
                  <p className="text-success">{'✓ Optimal allocation: 47 assignments'}</p>
                  <p className="mt-4">{'> analyze maintenance --predict-failures'}</p>
                  <p className="text-warning">{'⚠ 3 assets require attention'}</p>
                  <p className="mt-4">{'> generate report --format pdf'}</p>
                  <p className="text-success">{'✓ Report generated: report_2024.pdf'}</p>
                  <p className="mt-4 opacity-50 animate-pulse">{'█ awaiting command...'}</p>
                </div>
              </div>
              
              <div className="absolute -top-4 -right-4 w-24 h-24 border-3 border-primary bg-transparent" />
              <div className="absolute -bottom-4 -left-4 w-20 h-20 border-3 border-accentYellow bg-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="relative py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block mb-4 px-3 py-1 border-2 border-ink bg-accentYellow shadow-bauhaus-sm">
              <span className="text-xs font-bold uppercase tracking-widest">[ CAPABILITIES ]</span>
            </div>
            <h2 className="font-display font-black text-5xl md:text-6xl uppercase leading-tight">
              Complete Asset
              <br />
              <span className="text-primary">Ecosystem</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              const colorMap = {
                primary: 'text-primary border-primary shadow-[4px_4px_0_0_#1E4FD8]',
                success: 'text-success border-success shadow-[4px_4px_0_0_#1B8A50]',
                warning: 'text-warning border-warning shadow-[4px_4px_0_0_#E8A200]',
                danger: 'text-danger border-danger shadow-[4px_4px_0_0_#D8341E]',
              };

              return (
                <div
                  key={i}
                  className="group glass-card p-6 hover:scale-105 transition-all duration-300"
                  style={{
                    animation: `slideUp 0.6s ease-out ${i * 100}ms forwards`,
                    opacity: 0,
                  }}
                >
                  <div className={`w-16 h-16 border-3 ${colorMap[feature.color]} mb-4 flex items-center justify-center`}>
                    <Icon size={32} />
                  </div>
                  <h3 className="font-display font-black text-xl uppercase mb-3">{feature.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="relative py-24 px-4 bg-ink text-surface">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-display font-black text-5xl md:text-6xl uppercase leading-tight mb-6">
            Ready to Optimize
            <br />
            <span className="text-accentYellow">Your Assets?</span>
          </h2>
          
          <p className="text-lg md:text-xl text-surface/80 mb-12 max-w-2xl mx-auto">
            Join leading organizations using IntelliAsset to reduce costs and improve efficiency.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="btn-bauhaus bg-accentYellow text-ink px-8 py-4 text-lg font-bold uppercase border-2 border-accentYellow">
              Get Started Free
              <ChevronRight className="inline ml-2" size={20} />
            </button>
            <button className="btn-bauhaus bg-transparent border-2 border-surface text-surface px-8 py-4 text-lg font-bold uppercase hover:bg-surface hover:text-ink">
              Contact Sales
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative py-12 px-4 bg-background border-t-2 border-ink">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <h3 className="font-display font-black text-lg uppercase mb-4">IntelliAsset</h3>
              <p className="text-sm text-muted">Intelligent asset management for the modern enterprise.</p>
            </div>
            
            <div>
              <h4 className="font-bold uppercase text-xs tracking-widest mb-4 text-ink">Product</h4>
              <ul className="space-y-2 text-sm text-muted">
                <li><a href="#" className="hover:text-ink transition">Features</a></li>
                <li><a href="#" className="hover:text-ink transition">Pricing</a></li>
                <li><a href="#" className="hover:text-ink transition">Documentation</a></li>
                <li><a href="#" className="hover:text-ink transition">API</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold uppercase text-xs tracking-widest mb-4 text-ink">Company</h4>
              <ul className="space-y-2 text-sm text-muted">
                <li><a href="#" className="hover:text-ink transition">About</a></li>
                <li><a href="#" className="hover:text-ink transition">Blog</a></li>
                <li><a href="#" className="hover:text-ink transition">Careers</a></li>
                <li><a href="#" className="hover:text-ink transition">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold uppercase text-xs tracking-widest mb-4 text-ink">Legal</h4>
              <ul className="space-y-2 text-sm text-muted">
                <li><a href="#" className="hover:text-ink transition">Privacy</a></li>
                <li><a href="#" className="hover:text-ink transition">Terms</a></li>
                <li><a href="#" className="hover:text-ink transition">Security</a></li>
                <li><a href="#" className="hover:text-ink transition">Compliance</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t-2 border-ink pt-8">
            <div className="flex flex-col md:flex-row items-center justify-between">
              <p className="text-sm text-muted">
                © 2024 IntelliAsset. All rights reserved.
              </p>
              <p className="text-sm font-bold text-primary mt-4 md:mt-0">
                Designed & Built by <span className="uppercase">Apran Khunger</span>
              </p>
              <div className="flex gap-4 mt-4 md:mt-0">
                <a href="#" className="text-ink hover:text-primary transition">GitHub</a>
                <a href="#" className="text-ink hover:text-primary transition">Twitter</a>
                <a href="#" className="text-ink hover:text-primary transition">LinkedIn</a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Global animations */}
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

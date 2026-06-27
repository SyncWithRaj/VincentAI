import React from 'react';
import { LayoutDashboard, Wand2, Sparkles, TrendingUp, Radio, X } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, isOpen, setIsOpen }) {
  const tabs = [
    { id: 'analytics', label: 'Analytics', icon: LayoutDashboard },
    { id: 'live-store', label: 'Live Store', icon: Radio },
    { id: 'aify', label: 'AIfy Post', icon: Wand2 },
    { id: 'create', label: 'Create Post with AI', icon: Sparkles },
    { id: 'trends', label: 'Trends', icon: TrendingUp },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-[#080808]/80 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed top-0 left-0 h-screen w-72 bg-[#080808]/80 backdrop-blur-3xl border-r border-white/5 p-6 flex flex-col z-50 transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        md:sticky md:top-0 md:flex md:w-72 shadow-[4px_0_24px_rgba(0,0,0,0.5)] md:shadow-none
      `}>
        <div className="flex items-center justify-between mb-10 mt-2 pl-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF3D6E] to-[#8B5CF6] flex items-center justify-center shadow-[0_0_16px_rgba(255,61,110,0.4)]">
              <Sparkles size={18} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}>
              Vincent.ai
            </h1>
          </div>

          {/* Mobile close button */}
          <button
            className="md:hidden p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-white/10"
            onClick={() => setIsOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mx-3 mb-4">Creator Menu</div>

        <nav className="flex-1 space-y-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (window.innerWidth < 768) setIsOpen(false);
                }}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl font-medium text-left transition-all duration-300 group ${isActive
                    ? 'bg-[#FF3D6E]/10 border border-[#FF3D6E]/20 text-white shadow-[0_0_12px_rgba(255,61,110,0.15)]'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent hover:border-white/5'
                  }`}
              >
                <Icon size={20} className={`transition-transform duration-300 ${isActive ? 'text-[#FF3D6E] scale-110' : 'text-gray-500 group-hover:scale-110 group-hover:text-[#00F5FF]'}`} />
                <span className="text-[15px]">{tab.label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#FF3D6E] shadow-[0_0_8px_rgba(255,61,110,0.8)]"></div>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-6 border-t border-white/5 flex items-center gap-3 pl-2 group cursor-pointer hover:bg-white/5 p-2 rounded-2xl transition-colors border border-transparent hover:border-white/5">
          <img src="https://ui-avatars.com/api/?name=Creator&background=FF3D6E&color=fff&rounded=true" alt="User" className="w-10 h-10 rounded-full shadow-[0_0_12px_rgba(255,61,110,0.3)]" />
          <div>
            <div className="text-sm font-semibold text-white group-hover:text-[#FF3D6E] transition-colors">Digital Creator</div>
            <div className="text-xs text-gray-500">Premium Account</div>
          </div>
        </div>
      </div>
    </>
  );
}

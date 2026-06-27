import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Menu, Star } from 'lucide-react';
import Sidebar from '../components/dashboard/Sidebar';
import Analytics from '../components/dashboard/Analytics';
import AIfyPost from '../components/dashboard/AIfyPost';
import CreatePostAI from '../components/dashboard/CreatePostAI';
import Trends from '../components/dashboard/Trends';
import LiveStore from '../components/dashboard/LiveStore';

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const itemParam = searchParams.get('itemId');
  const [activeTab, setActiveTab] = useState('analytics');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const renderContent = () => {
    switch (activeTab) {
      case 'analytics':
        return <Analytics />;
      case 'live-store':
        return <LiveStore initialItemId={itemParam || ''} />;
      case 'aify':
        return <AIfyPost />;
      case 'create':
        return <CreatePostAI />;
      case 'trends':
        return <Trends />;
      default:
        return <Analytics />;
    }
  };

  return (
    <div className="flex h-screen bg-[#080808] text-[#F0F0F0] font-sans relative overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Background soft glowing orb effect */}
      <div className="absolute top-0 w-full h-[600px] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(139,92,246,0.2),rgba(255,255,255,0))] pointer-events-none z-0"></div>

      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <main className="flex-1 p-4 md:p-8 overflow-y-auto relative h-full z-10 w-full max-w-full overflow-x-hidden" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,61,110,0.25) transparent' }}>
         <div className="max-w-6xl mx-auto space-y-8">
            <header className="flex justify-between items-center mb-6 md:mb-10 backdrop-blur-xl bg-white/5 border border-white/10 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.3)] p-4 md:p-6 rounded-3xl relative overflow-hidden">
               {/* Header subtle shine */}
               <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none -translate-x-full animate-[shimmer_3s_infinite]"></div>

               <div className="flex items-center gap-4 relative z-10">
                 <button 
                    className="md:hidden p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors border border-white/10 shadow-sm"
                    onClick={() => setIsSidebarOpen(true)}
                 >
                    <Menu size={20} />
                 </button>
                 <div>
                   <h2 className="text-xl md:text-3xl font-bold text-white tracking-tight pt-1" style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}>
                     {activeTab.replace(/[-_]/g, ' ').replace(/([A-Z])/g, ' $1').trim()}
                   </h2>
                   <p className="text-sm text-gray-400 mt-1 hidden sm:block">Manage and elevate your creator journey.</p>
                 </div>
               </div>
               <div className="flex items-center gap-2 bg-[#FF3D6E]/10 px-4 py-2 rounded-xl border border-[#FF3D6E]/30 text-[#FF3D6E] font-medium text-sm md:text-base shadow-[0_0_12px_rgba(255,61,110,0.2)] relative z-10">
                  <Star size={18} className="text-[#FF3D6E]" fill="currentColor" />
                  <span>Premium Active</span>
               </div>
            </header>
            
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
               {renderContent()}
            </div>
         </div>
      </main>
    </div>
  );
}

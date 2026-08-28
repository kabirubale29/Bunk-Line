import React from 'react';
import { Clock, ShieldAlert, BarChart2, Settings, ShieldCheck } from 'lucide-react';

export default function Navigation({ activeTab, setActiveTab, onOpenLogo, isAdmin = false, currentEmail = '' }) {
  const isDedicatedAdmin = (currentEmail || '').trim().toLowerCase() === 'ubalekabir29@gmail.com';

  const tabs = isDedicatedAdmin
    ? [{ id: 'admin', label: 'Admin', icon: ShieldCheck }]
    : [
        { id: 'today', label: 'Today', icon: Clock },
        { id: 'danger', label: 'Danger Zone', icon: ShieldAlert },
        { id: 'stats', label: 'Stats', icon: BarChart2 },
        { id: 'setup', label: 'Setup', icon: Settings },
      ];

  return (
    <>
      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-brand-card border-t border-brand-border z-30 pb-safe">
        <div className="flex justify-around items-center h-16">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center justify-center w-full h-full py-1 text-xs font-semibold focus:outline-none transition-colors active:scale-95"
                style={{ WebkitTapHighlightColor: 'transparent' }}
                aria-label={tab.label}
              >
                <Icon
                  size={22}
                  className={`mb-1 transition-all ${
                    isActive ? 'text-brand-primary scale-110' : 'text-brand-textMuted'
                  }`}
                />
                <span className={isActive ? 'text-brand-primary' : 'text-brand-textMuted'}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop Sidebar Navigation */}
      <aside className="hidden md:flex flex-col w-64 fixed top-0 bottom-0 left-0 bg-brand-card border-r border-brand-border py-8 px-4 z-30">
        <button
          onClick={onOpenLogo}
          className="px-4 mb-8 flex items-center gap-3 text-left group cursor-pointer focus:outline-none"
          title="Click to view logo full screen"
        >
          <img src="/logo.png" alt="Bunk Line" className="w-10 h-10 object-contain shrink-0 transition-transform group-hover:scale-110" />
          <div>
            <h1 className="text-xl font-black tracking-tight text-brand-primary group-hover:underline">
              Bunk Line
            </h1>
            <p className="text-[10px] text-brand-textMuted font-bold uppercase tracking-widest">
              Attendance Tracker
            </p>
          </div>
        </button>

        <nav className="flex-1 space-y-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl font-bold transition-all text-sm ${
                  isActive
                    ? 'bg-brand-primary text-brand-text shadow-lg shadow-brand-primary/10'
                    : 'text-brand-textSec hover:bg-brand-cardEl hover:text-brand-text'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-brand-text' : 'text-brand-textMuted'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

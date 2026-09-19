import React from 'react';
import { Shield, RefreshCw, Bell, Sliders, LayoutDashboard } from 'lucide-react';

interface NavbarProps {
  currentTab: 'dashboard' | 'alerts' | 'config' | 'service-detail';
  onSelectTab: (tab: 'dashboard' | 'alerts' | 'config') => void;
  activeAlertsCount: number;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  activeAlertsCount,
  isRefreshing,
  onRefresh,
}) => {
  return (
    <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelectTab('dashboard')}>
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white flex items-center gap-2">
                CyberForce <span className="text-xs font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase">Monitor</span>
              </span>
              <p className="text-[11px] text-slate-400 hidden sm:block">Third-Party Infrastructure & Quota Alerting</p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentTab === 'dashboard' || currentTab === 'service-detail'
                  ? 'bg-slate-800 text-sky-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Services</span>
            </button>

            <button
              onClick={() => onSelectTab('alerts')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                currentTab === 'alerts'
                  ? 'bg-slate-800 text-sky-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Bell className="h-4 w-4" />
              <span>Alerts</span>
              {activeAlertsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-xs font-bold bg-rose-500 text-white animate-pulse">
                  {activeAlertsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onSelectTab('config')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentTab === 'config'
                  ? 'bg-slate-800 text-sky-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Sliders className="h-4 w-4" />
              <span>Thresholds</span>
            </button>
          </nav>

          {/* Action Button: Run Now */}
          <div className="flex items-center gap-3">
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3.5 py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-semibold rounded-lg text-xs sm:text-sm transition-all shadow-md shadow-sky-500/20 active:scale-95"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Run Monitoring</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { ServiceDetailPage } from './pages/ServiceDetailPage';
import { AlertsPage } from './pages/AlertsPage';
import { ConfigurationPage } from './pages/ConfigurationPage';
import { api } from './services/api';
import { DashboardMetrics, ServiceListItem } from './types';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'alerts' | 'config' | 'service-detail'>('dashboard');
  const [selectedServiceKey, setSelectedServiceKey] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [services, setServices] = useState<ServiceListItem[]>([]);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchOverviewData = async () => {
    try {
      const [m, s] = await Promise.all([api.getMetrics(), api.getServices()]);
      setMetrics(m);
      setServices(s);
    } catch (err: any) {
      console.error('Failed to fetch dashboard data:', err);
    }
  };

  useEffect(() => {
    fetchOverviewData();
    // Poll every 30 seconds for live updates
    const interval = setInterval(fetchOverviewData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await api.runMonitoringCycle();
      await fetchOverviewData();
      setFeedbackMessage({
        type: 'success',
        text: 'Live monitoring cycle dispatched across all 12 services successfully!',
      });
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: 'Monitoring run encountered an error: ' + (err.response?.data?.error || err.message),
      });
      setTimeout(() => setFeedbackMessage(null), 5000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSelectService = (serviceKey: string) => {
    setSelectedServiceKey(serviceKey);
    setCurrentTab('service-detail');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          if (tab === 'dashboard') setSelectedServiceKey(null);
        }}
        activeAlertsCount={metrics?.activeAlerts ?? 0}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
      />

      {/* User feedback banner */}
      {feedbackMessage && (
        <div
          className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 w-full`}
        >
          <div
            className={`p-3 rounded-xl border flex items-center gap-2 text-xs sm:text-sm font-medium ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {currentTab === 'dashboard' && (
          <DashboardPage
            metrics={metrics}
            services={services}
            selectedFilter={selectedFilter}
            onFilterChange={setSelectedFilter}
            onSelectService={handleSelectService}
          />
        )}

        {currentTab === 'service-detail' && selectedServiceKey && (
          <ServiceDetailPage
            serviceKey={selectedServiceKey}
            onBack={() => {
              setCurrentTab('dashboard');
              setSelectedServiceKey(null);
            }}
          />
        )}

        {currentTab === 'alerts' && <AlertsPage />}

        {currentTab === 'config' && <ConfigurationPage />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          CyberForce External Services Monitoring & Alerting System • DevOps Production Infrastructure
        </div>
      </footer>
    </div>
  );
};

export default App;

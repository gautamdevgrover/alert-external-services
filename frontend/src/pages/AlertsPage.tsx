import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, Check, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { AlertsResponse } from '../types';

export const AlertsPage: React.FC = () => {
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'resolved'>('all');
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const res = await api.getAlerts(activeTab === 'all' ? undefined : activeTab);
      setData(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [activeTab]);

  const handleResolve = async (id: number) => {
    try {
      setResolvingId(id);
      await api.resolveAlert(id);
      await loadAlerts();
    } catch (err: any) {
      alert('Failed to resolve alert: ' + err.message);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Bell className="h-6 w-6 text-sky-400" />
            Alerts & Incidents Log
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Audit log of all triggered notifications, threshold violations, and service recoveries.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'all'
                ? 'bg-slate-800 text-sky-400 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Alerts ({data?.summary.total ?? 0})
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'active'
                ? 'bg-slate-800 text-rose-400 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Active ({data?.summary.active ?? 0})
          </button>
          <button
            onClick={() => setActiveTab('resolved')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'resolved'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Resolved ({data?.summary.resolved ?? 0})
          </button>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm flex flex-col items-center justify-center">
            <RefreshCw className="h-6 w-6 text-sky-400 animate-spin mb-2" />
            Loading alerts...
          </div>
        ) : !data || data.alerts.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2 opacity-50" />
            No alerts found for this filter. All external services operational.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 sm:px-6">Service</th>
                  <th className="py-3 px-4">Alert Type</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Message</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4">Resolved</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {data.alerts.map((a) => {
                  const isResolved = a.status === 'resolved';

                  return (
                    <tr key={a.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Service */}
                      <td className="py-3.5 px-4 sm:px-6 font-semibold uppercase text-slate-200">
                        {a.service_key}
                      </td>

                      {/* Alert Type */}
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {a.alert_type}
                      </td>

                      {/* Severity */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                            a.severity === 'critical'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : a.severity === 'warning'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {a.severity}
                        </span>
                      </td>

                      {/* Message */}
                      <td className="py-3.5 px-4 text-slate-200 max-w-sm">
                        {a.message}
                      </td>

                      {/* Created */}
                      <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                        {new Date(a.created_at).toLocaleString()}
                      </td>

                      {/* Resolved */}
                      <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                        {a.resolved_at ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            {new Date(a.resolved_at).toLocaleTimeString()}
                          </span>
                        ) : (
                          <span className="text-rose-400 font-medium">Unresolved</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        {!isResolved ? (
                          <button
                            onClick={() => handleResolve(a.id)}
                            disabled={resolvingId === a.id}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-400 border border-slate-700 rounded text-slate-300 transition-colors text-[11px]"
                          >
                            {resolvingId === a.id ? 'Resolving...' : 'Mark Resolved'}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500">Completed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

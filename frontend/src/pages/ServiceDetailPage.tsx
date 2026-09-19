import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Info,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { api } from '../services/api';
import { ServiceDetailResponse, ServiceHistoryResponse } from '../types';
import { StatusBadge } from '../components/StatusBadge';

interface ServiceDetailPageProps {
  serviceKey: string;
  onBack: () => void;
}

export const ServiceDetailPage: React.FC<ServiceDetailPageProps> = ({ serviceKey, onBack }) => {
  const [detail, setDetail] = useState<ServiceDetailResponse | null>(null);
  const [history, setHistory] = useState<ServiceHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [detailData, historyData] = await Promise.all([
        api.getServiceDetail(serviceKey),
        api.getServiceHistory(serviceKey, 30),
      ]);
      setDetail(detailData);
      setHistory(historyData);
    } catch (err: any) {
      setError(err.message || 'Failed to load service details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [serviceKey]);

  const handleRunNow = async () => {
    try {
      setRefreshing(true);
      await api.runMonitoringCycle(serviceKey);
      await loadData();
    } catch (err: any) {
      alert('Failed to trigger monitoring check: ' + err.message);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <RefreshCw className="h-8 w-8 text-sky-400 animate-spin mb-4" />
        <p className="text-slate-400 text-sm">Loading service telemetry & history...</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-6 my-8 text-center">
        <AlertTriangle className="h-8 w-8 text-rose-400 mx-auto mb-2" />
        <p className="text-rose-200 font-semibold mb-2">{error || 'Service not found'}</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300"
        >
          <ArrowLeft className="h-4 w-4" /> Return to Services List
        </button>
      </div>
    );
  }

  const { service, latestResult, thresholdConfig, recentAlerts } = detail;
  const status = latestResult?.status || (service.isConfigured ? 'healthy' : 'down');

  // Prepare chart data from snapshots and recent checks
  const chartData = (history?.dailySnapshots || []).map((s) => ({
    date: s.date.slice(5), // MM-DD
    usage: s.usage ?? (s.percentageUsed ?? 0),
    remaining: s.remaining ?? 0,
    cost: s.cost ?? 0,
  }));

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Back to Services"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">{service.name}</h1>
              <StatusBadge status={status} size="md" />
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                {service.category}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{service.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunNow}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Check Live Now
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric Value */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Current Metric ({latestResult?.metric_type || 'standard'})
          </span>
          <div className="mt-2 text-2xl font-bold font-mono text-white">
            {latestResult?.remaining !== null && latestResult?.remaining !== undefined
              ? latestResult?.currency === 'USD'
                ? `$${latestResult.remaining.toFixed(2)}`
                : `${latestResult.remaining.toLocaleString()} credits`
              : latestResult?.current_spend !== null && latestResult?.current_spend !== undefined
              ? `$${latestResult.current_spend.toFixed(2)} spend`
              : latestResult?.percentage_used !== null && latestResult?.percentage_used !== undefined
              ? `${latestResult.percentage_used}% utilized`
              : 'Manual Monitoring'}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {latestResult?.limit_val ? `Total limit: ${latestResult.limit_val.toLocaleString()}` : 'Live quota metric'}
          </span>
        </div>

        {/* Threshold Policy */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Threshold Rules
          </span>
          <div className="mt-2 text-sm text-slate-200 space-y-1 font-mono">
            <div className="flex justify-between">
              <span className="text-amber-400">Warning:</span>
              <span>{thresholdConfig?.warningThreshold} {thresholdConfig?.unit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-rose-400">Critical:</span>
              <span>{thresholdConfig?.criticalThreshold} {thresholdConfig?.unit}</span>
            </div>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Cooldown: {thresholdConfig?.alertCooldownMinutes || 360} mins
          </span>
        </div>

        {/* Last Check Timestamp */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Last Successful Check
          </span>
          <div className="mt-2 text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Clock className="h-4 w-4 text-sky-400" />
            {latestResult?.checked_at ? new Date(latestResult.checked_at).toLocaleTimeString() : 'Never'}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Response time: {latestResult?.response_time_ms ?? 0}ms
          </span>
        </div>

        {/* Configuration Status */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Environment Credentials
          </span>
          <div className="mt-2 flex items-center gap-2">
            {service.isConfigured ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <ShieldCheck className="h-4 w-4" /> Configured
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                <ShieldAlert className="h-4 w-4" /> Missing Env Keys
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block truncate">
            Requires: {service.requiredEnvVars.join(', ')}
          </span>
        </div>
      </div>

      {/* Safe Error Details (if present) */}
      {latestResult?.error_message && (
        <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-red-300">
              API Error: {latestResult.error_code || 'PROVIDER_ERROR'}
            </h4>
            <p className="text-sm text-red-200 mt-1 font-mono">{latestResult.error_message}</p>
          </div>
        </div>
      )}

      {/* Historical Telemetry Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usage / Remaining Trend */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-sky-400" />
              Historical Usage / Balance (Daily Snapshots)
            </h3>
            <span className="text-xs text-slate-500">Last 30 days</span>
          </div>

          {chartData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="usage"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorUsage)"
                    name="Usage / Val"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs">
              <Info className="h-5 w-5 mb-2 opacity-50" />
              Historical daily snapshots will accumulate here automatically.
            </div>
          )}
        </div>

        {/* Cost / Spend Trend (where available) */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-400" />
              Historical Spend Trend ($ USD)
            </h3>
            <span className="text-xs text-slate-500">Last 30 days</span>
          </div>

          {chartData.some((d) => d.cost > 0) ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Bar dataKey="cost" fill="#10b981" radius={[4, 4, 0, 0]} name="Cost ($)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs">
              <Info className="h-5 w-5 mb-2 opacity-50" />
              Cost information is tracked for spend-oriented providers (e.g. AWS, MongoDB Atlas).
            </div>
          )}
        </div>
      </div>

      {/* Alert History for Service */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <h3 className="text-sm font-bold text-slate-200 mb-4">Recent Alerts for {service.name}</h3>

        {recentAlerts.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm">
            <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-2 opacity-60" />
            No alerts logged for this service. Operating normally.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase">
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Message</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Triggered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentAlerts.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-mono font-semibold text-slate-200">
                      {a.alert_type}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold uppercase ${
                          a.severity === 'critical'
                            ? 'bg-rose-500/20 text-rose-400'
                            : a.severity === 'warning'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        {a.severity}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-300 max-w-xs truncate">{a.message}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`capitalize ${
                          a.status === 'active' ? 'text-amber-400 font-bold' : 'text-slate-500'
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {new Date(a.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

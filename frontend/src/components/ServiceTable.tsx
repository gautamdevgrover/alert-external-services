import React, { useState } from 'react';
import { ChevronRight, Search, ExternalLink, AlertCircle } from 'lucide-react';
import { ServiceListItem } from '../types';
import { StatusBadge } from './StatusBadge';

interface ServiceTableProps {
  services: ServiceListItem[];
  onSelectService: (serviceKey: string) => void;
  selectedFilter: string;
}

export const ServiceTable: React.FC<ServiceTableProps> = ({
  services,
  onSelectService,
  selectedFilter,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const categories = ['all', ...Array.from(new Set(services.map((s) => s.category)))];

  const filtered = services.filter((s) => {
    // Status filter
    if (selectedFilter !== 'all') {
      const status = s.latestResult?.status || 'manual';
      if (status !== selectedFilter) return false;
    }

    // Category filter
    if (categoryFilter !== 'all' && s.category !== categoryFilter) {
      return false;
    }

    // Search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      return (
        s.name.toLowerCase().includes(term) ||
        s.key.toLowerCase().includes(term) ||
        s.category.toLowerCase().includes(term)
      );
    }

    return true;
  });

  const renderMetric = (s: ServiceListItem) => {
    const r = s.latestResult;
    if (!r) {
      return <span className="text-slate-500 italic text-xs">No data yet</span>;
    }

    if (r.status === 'down') {
      return (
        <div className="text-rose-400 text-xs font-mono max-w-xs truncate" title={r.error?.message || 'Error'}>
          {r.error?.message ? (r.error.message.length > 35 ? r.error.message.slice(0, 35) + '...' : r.error.message) : 'Connection failed'}
        </div>
      );
    }

    if (r.metricType === 'balance') {
      return (
        <div>
          <span className="font-mono text-sm font-semibold text-emerald-400">
            ${r.remaining !== null && r.remaining !== undefined ? r.remaining.toFixed(2) : '0.00'}
          </span>
          <span className="text-xs text-slate-400 ml-1">balance</span>
        </div>
      );
    }

    if (r.metricType === 'credits') {
      return (
        <div>
          <span className="font-mono text-sm font-semibold text-sky-400">
            {r.remaining !== null && r.remaining !== undefined ? r.remaining.toLocaleString() : 'N/A'}
          </span>
          <span className="text-xs text-slate-400 ml-1">remaining</span>
          {r.limit && (
            <div className="text-[11px] text-slate-500 font-mono">
              of {r.limit.toLocaleString()}
            </div>
          )}
        </div>
      );
    }

    if (r.metricType === 'spend') {
      return (
        <div>
          <span className="font-mono text-sm font-semibold text-amber-300">
            ${r.currentSpend !== null && r.currentSpend !== undefined ? r.currentSpend.toFixed(2) : '0.00'}
          </span>
          <span className="text-xs text-slate-400 ml-1">spend</span>
          {r.budget && (
            <div className="text-[11px] text-slate-500 font-mono">
              budget ${r.budget.toFixed(0)}
            </div>
          )}
        </div>
      );
    }

    if (r.metricType === 'usage') {
      return (
        <div>
          <span className="font-mono text-sm font-semibold text-indigo-400">
            {r.percentageUsed !== null && r.percentageUsed !== undefined
              ? `${r.percentageUsed}%`
              : `${r.used ?? 0} units`}
          </span>
          <span className="text-xs text-slate-400 ml-1">utilized</span>
        </div>
      );
    }

    return (
      <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">
        Manual monitoring required
      </span>
    );
  };

  const renderThreshold = (s: ServiceListItem) => {
    const r = s.latestResult;
    if (!r) return <span className="text-slate-500 text-xs">-</span>;

    if (r.thresholdStatus === 'critical') {
      return (
        <span className="text-xs font-semibold text-rose-400 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> Critical Limit
        </span>
      );
    }

    if (r.thresholdStatus === 'warning') {
      return (
        <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> Warning Level
        </span>
      );
    }

    return <span className="text-xs text-slate-400">Normal</span>;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
      {/* Table controls */}
      <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search external services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 font-medium">Category:</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 capitalize"
          >
            {categories.map((c) => (
              <option key={c} value={c} className="capitalize">
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Services Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4 sm:px-6">Service</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Metric Type</th>
              <th className="py-3 px-4">Remaining / Usage</th>
              <th className="py-3 px-4">Threshold</th>
              <th className="py-3 px-4">Last Check</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-sm">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  No services found matching filters.
                </td>
              </tr>
            ) : (
              filtered.map((s) => {
                const latest = s.latestResult;
                const status = latest?.status || (s.isConfigured ? 'healthy' : 'down');

                return (
                  <tr
                    key={s.key}
                    onClick={() => onSelectService(s.key)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                  >
                    {/* Service Name & Category */}
                    <td className="py-4 px-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sky-400 text-sm uppercase">
                          {s.key.substring(0, 2)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-100 flex items-center gap-2">
                            {s.name}
                            {s.website && (
                              <a
                                href={s.website}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-slate-500 hover:text-sky-400 transition-colors"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 font-normal">
                            {s.category}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-4 px-4">
                      <StatusBadge status={status} />
                    </td>

                    {/* Metric Type */}
                    <td className="py-4 px-4">
                      <span className="capitalize text-xs font-mono text-slate-300 px-2 py-0.5 rounded bg-slate-800 border border-slate-700/60">
                        {latest?.metricType || 'standard'}
                      </span>
                    </td>

                    {/* Remaining / Usage */}
                    <td className="py-4 px-4">{renderMetric(s)}</td>

                    {/* Threshold Status */}
                    <td className="py-4 px-4">{renderThreshold(s)}</td>

                    {/* Last Check */}
                    <td className="py-4 px-4">
                      {latest?.checkedAt ? (
                        <div className="text-xs text-slate-300">
                          <div>{new Date(latest.checkedAt).toLocaleTimeString()}</div>
                          <div className="text-[11px] text-slate-500">
                            {new Date(latest.checkedAt).toLocaleDateString()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Never checked</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectService(s.key);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 group-hover:text-sky-400 group-hover:bg-slate-800 transition-colors"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

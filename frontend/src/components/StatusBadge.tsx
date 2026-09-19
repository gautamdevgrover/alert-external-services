import React from 'react';
import { ServiceStatus } from '../types';

interface StatusBadgeProps {
  status: ServiceStatus | string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const normalized = status.toLowerCase();

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs font-semibold',
    lg: 'px-3 py-1.5 text-sm font-bold',
  }[size];

  switch (normalized) {
    case 'healthy':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${sizeClasses}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Healthy
        </span>
      );
    case 'warning':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 ${sizeClasses}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
          Warning
        </span>
      );
    case 'critical':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 ${sizeClasses}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-ping"></span>
          Critical
        </span>
      );
    case 'down':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 ${sizeClasses}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
          Down
        </span>
      );
    case 'manual':
    default:
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-slate-700/50 text-slate-300 border border-slate-600/40 ${sizeClasses}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
          Manual
        </span>
      );
  }
};

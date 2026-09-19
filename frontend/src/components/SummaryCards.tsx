import React from 'react';
import { Server, CheckCircle2, AlertTriangle, AlertOctagon, XCircle, Wrench } from 'lucide-react';
import { DashboardMetrics } from '../types';

interface SummaryCardsProps {
  metrics: DashboardMetrics | null;
  selectedFilter: string;
  onFilterChange: (status: string) => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  metrics,
  selectedFilter,
  onFilterChange,
}) => {
  const cards = [
    {
      id: 'all',
      title: 'Total Services',
      count: metrics?.totalServices ?? 12,
      icon: Server,
      color: 'text-sky-400',
      border: 'border-slate-700/60',
      bg: 'bg-slate-900/60',
      activeBorder: 'ring-2 ring-sky-500',
    },
    {
      id: 'healthy',
      title: 'Healthy',
      count: metrics?.healthy ?? 0,
      icon: CheckCircle2,
      color: 'text-emerald-400',
      border: 'border-emerald-500/20',
      bg: 'bg-emerald-950/20',
      activeBorder: 'ring-2 ring-emerald-500',
    },
    {
      id: 'warning',
      title: 'Warning',
      count: metrics?.warning ?? 0,
      icon: AlertTriangle,
      color: 'text-amber-400',
      border: 'border-amber-500/20',
      bg: 'bg-amber-950/20',
      activeBorder: 'ring-2 ring-amber-500',
    },
    {
      id: 'critical',
      title: 'Critical',
      count: metrics?.critical ?? 0,
      icon: AlertOctagon,
      color: 'text-rose-400',
      border: 'border-rose-500/20',
      bg: 'bg-rose-950/20',
      activeBorder: 'ring-2 ring-rose-500',
    },
    {
      id: 'down',
      title: 'Down',
      count: metrics?.down ?? 0,
      icon: XCircle,
      color: 'text-red-500',
      border: 'border-red-500/20',
      bg: 'bg-red-950/20',
      activeBorder: 'ring-2 ring-red-500',
    },
    {
      id: 'manual',
      title: 'Manual Required',
      count: metrics?.manual ?? 0,
      icon: Wrench,
      color: 'text-slate-400',
      border: 'border-slate-600/30',
      bg: 'bg-slate-800/30',
      activeBorder: 'ring-2 ring-slate-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-8">
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected = selectedFilter === card.id;

        return (
          <button
            key={card.id}
            onClick={() => onFilterChange(card.id)}
            className={`flex flex-col p-4 rounded-xl border ${card.border} ${card.bg} text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${
              isSelected ? card.activeBorder : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">{card.title}</span>
              <Icon className={`h-4 w-4 ${card.color}`} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold tracking-tight ${card.color}`}>
                {card.count}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

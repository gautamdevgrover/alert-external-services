import React from 'react';
import { SummaryCards } from '../components/SummaryCards';
import { ServiceTable } from '../components/ServiceTable';
import { DashboardMetrics, ServiceListItem } from '../types';

interface DashboardPageProps {
  metrics: DashboardMetrics | null;
  services: ServiceListItem[];
  selectedFilter: string;
  onFilterChange: (status: string) => void;
  onSelectService: (serviceKey: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  metrics,
  services,
  selectedFilter,
  onFilterChange,
  onSelectService,
}) => {
  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <SummaryCards
        metrics={metrics}
        selectedFilter={selectedFilter}
        onFilterChange={onFilterChange}
      />

      {/* Services Table */}
      <ServiceTable
        services={services}
        onSelectService={onSelectService}
        selectedFilter={selectedFilter}
      />
    </div>
  );
};

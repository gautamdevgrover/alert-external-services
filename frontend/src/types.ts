export type ServiceStatus = 'healthy' | 'warning' | 'critical' | 'down' | 'manual';
export type MetricType = 'credits' | 'balance' | 'spend' | 'usage' | 'manual';
export type ThresholdStatus = 'normal' | 'warning' | 'critical';

export interface ServiceListItem {
  key: string;
  name: string;
  category: string;
  description?: string;
  website?: string;
  isEnabled: boolean;
  isConfigured: boolean;
  envVarNames: string[];
  lastVerifiedAt?: string | null;
  latestResult: {
    status: ServiceStatus;
    metricType: MetricType;
    currentSpend?: number | null;
    forecastedSpend?: number | null;
    budget?: number | null;
    used?: number | null;
    limit?: number | null;
    remaining?: number | null;
    percentageUsed?: number | null;
    currency?: string;
    thresholdStatus: ThresholdStatus;
    checkedAt: string;
    responseTimeMs: number;
    error?: {
      code: string;
      message: string;
    } | null;
    metadata?: Record<string, any>;
  } | null;
}

export interface DashboardMetrics {
  totalServices: number;
  healthy: number;
  warning: number;
  critical: number;
  down: number;
  manual: number;
  activeAlerts: number;
  lastRun: {
    id: number;
    run_type: string;
    started_at: string;
    completed_at?: string;
    status: string;
  } | null;
  generatedAt: string;
}

export interface AlertItem {
  id: number;
  service_key: string;
  alert_type: string;
  severity: 'warning' | 'critical' | 'info';
  message: string;
  details?: any;
  status: 'active' | 'resolved';
  created_at: string;
  resolved_at?: string | null;
}

export interface AlertsResponse {
  summary: {
    active: number;
    resolved: number;
    total: number;
  };
  alerts: AlertItem[];
}

export interface ThresholdItem {
  id: number;
  serviceKey: string;
  serviceName: string;
  category: string;
  warningThreshold: number;
  criticalThreshold: number;
  unit: string;
  comparison: 'less_than' | 'greater_than';
  alertCooldownMinutes: number;
  isEnabled: boolean;
  serviceEnabled: boolean;
  updatedAt: string;
}

export interface ServiceDetailResponse {
  service: {
    key: string;
    name: string;
    category: string;
    description?: string;
    website?: string;
    isEnabled: boolean;
    isConfigured: boolean;
    requiredEnvVars: string[];
  };
  latestResult: any;
  thresholdConfig: ThresholdItem;
  recentAlerts: AlertItem[];
}

export interface ServiceHistoryResponse {
  serviceKey: string;
  dailySnapshots: Array<{
    date: string;
    status: ServiceStatus;
    metricType: MetricType;
    usage?: number | null;
    remaining?: number | null;
    cost?: number | null;
    percentageUsed?: number | null;
    thresholdStatus: ThresholdStatus;
  }>;
  recentChecks: Array<{
    checkedAt: string;
    status: ServiceStatus;
    metricType: MetricType;
    used?: number | null;
    limit?: number | null;
    remaining?: number | null;
    currentSpend?: number | null;
    forecastedSpend?: number | null;
    budget?: number | null;
    percentageUsed?: number | null;
    responseTimeMs: number;
  }>;
}

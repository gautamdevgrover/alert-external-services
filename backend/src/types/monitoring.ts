export type ServiceStatus = 'healthy' | 'warning' | 'critical' | 'down' | 'manual';
export type MetricType = 'credits' | 'balance' | 'spend' | 'usage' | 'manual';
export type ThresholdStatus = 'normal' | 'warning' | 'critical';

export type AlertType =
  | 'SERVICE_DOWN'
  | 'API_AUTH_FAILURE'
  | 'API_ERROR'
  | 'LOW_CREDITS'
  | 'LOW_BALANCE'
  | 'HIGH_USAGE'
  | 'HIGH_SPEND'
  | 'BILLING_WARNING'
  | 'RECOVERY';

export type AlertSeverity = 'warning' | 'critical' | 'info';

export interface NormalizedMonitoringResult {
  service: string;
  status: ServiceStatus;
  metricType: MetricType;
  used?: number | null;
  limit?: number | null;
  remaining?: number | null;
  currentSpend?: number | null;
  forecastedSpend?: number | null;
  budget?: number | null;
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
}

export interface HealthCheckResult {
  isHealthy: boolean;
  responseTimeMs: number;
  statusCode?: number;
  error?: {
    code: string;
    message: string;
  } | null;
  details?: Record<string, any>;
}

export interface ServiceDefinition {
  id: number;
  key: string;
  name: string;
  category: string;
  description?: string;
  website?: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceCredentialReference {
  id: number;
  serviceKey: string;
  envVarNames: string[];
  isConfigured: boolean;
  lastVerifiedAt?: string | null;
}

export interface ThresholdConfig {
  id: number;
  serviceKey: string;
  warningThreshold: number;
  criticalThreshold: number;
  unit: string;
  comparison: 'less_than' | 'greater_than';
  alertCooldownMinutes: number;
  isEnabled: boolean;
  updatedAt: string;
}

export interface AlertRecord {
  id: number;
  serviceKey: string;
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  details?: Record<string, any>;
  status: 'active' | 'resolved';
  createdAt: string;
  resolvedAt?: string | null;
}

export interface AlertState {
  serviceKey: string;
  currentState: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'DOWN';
  lastAlertType?: AlertType | null;
  lastAlertAt?: string | null;
  lastStateChangeAt: string;
  cooldownUntil?: string | null;
}

export interface UsageSnapshot {
  id: number;
  snapshotDate: string;
  serviceKey: string;
  status: ServiceStatus;
  metricType: MetricType;
  usageVal?: number | null;
  remainingVal?: number | null;
  costVal?: number | null;
  percentageUsed?: number | null;
  thresholdStatus: ThresholdStatus;
  createdAt: string;
}

export interface MonitoringRun {
  id: number;
  runType: 'scheduled' | 'manual' | 'snapshot';
  startedAt: string;
  completedAt?: string | null;
  totalServices: number;
  healthyCount: number;
  warningCount: number;
  criticalCount: number;
  downCount: number;
  manualCount: number;
  status: 'in_progress' | 'completed' | 'failed';
  errorMessage?: string | null;
}

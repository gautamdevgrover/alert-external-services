import {
  HealthCheckResult,
  NormalizedMonitoringResult,
  ServiceStatus,
  MetricType,
} from '../types/monitoring';
import { sanitizeData } from '../utils/logger';

export abstract class BaseProvider {
  abstract readonly serviceKey: string;
  abstract readonly serviceName: string;

  abstract isConfigured(): boolean;
  abstract getRequiredEnvVars(): string[];
  abstract checkHealth(): Promise<HealthCheckResult>;
  abstract getMetrics(): Promise<NormalizedMonitoringResult>;

  protected formatError(err: any): { code: string; message: string } {
    if (!err) {
      return { code: 'UNKNOWN_ERROR', message: 'An unknown error occurred' };
    }

    const code =
      err.code ||
      (err.response && `HTTP_${err.response.status}`) ||
      err.name ||
      'PROVIDER_ERROR';

    let rawMessage =
      (err.response && err.response.data && (err.response.data.message || err.response.data.error || JSON.stringify(err.response.data))) ||
      (err.cause ? `${err.message} (${err.cause.message || err.cause})` : err.message) ||
      'Error contacting provider API';

    if (typeof rawMessage !== 'string') {
      rawMessage = JSON.stringify(rawMessage);
    }

    // Always sanitize error message to prevent accidental token leakage
    const cleanMessage = sanitizeData(rawMessage);

    return {
      code: String(code),
      message: String(cleanMessage).substring(0, 500),
    };
  }

  protected createBaseResult(
    status: ServiceStatus,
    metricType: MetricType,
    responseTimeMs: number,
    error: { code: string; message: string } | null = null
  ): NormalizedMonitoringResult {
    return {
      service: this.serviceKey,
      status,
      metricType,
      checkedAt: new Date().toISOString(),
      responseTimeMs,
      thresholdStatus: 'normal',
      error,
    };
  }
}

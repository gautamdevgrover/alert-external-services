import { query } from '../db';
import { getAllProviders, getProvider, BaseProvider } from '../providers';
import {
  NormalizedMonitoringResult,
  ThresholdConfig,
  ThresholdStatus,
  ServiceStatus,
} from '../types/monitoring';
import { AlertService } from './alert.service';
import { logger } from '../utils/logger';

export class MonitoringService {
  private alertService: AlertService;

  constructor(alertService?: AlertService) {
    this.alertService = alertService || new AlertService();
  }

  /**
   * Helper to execute with 3 retries and exponential backoff
   * Attempt 1 -> wait 2s -> Attempt 2 -> wait 5s -> Attempt 3
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    serviceKey: string,
    maxRetries = 3
  ): Promise<T> {
    const delays = [2000, 5000]; // delays before retry 2 and retry 3

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (err: any) {
        logger.warn(`Monitoring attempt ${attempt} failed for ${serviceKey}`, {
          attempt,
          error: err.message,
        });

        if (attempt === maxRetries) {
          throw err;
        }

        const delay = delays[attempt - 1] || 5000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error(`Exceeded max retries for ${serviceKey}`);
  }

  /**
   * Evaluate threshold for a metric result
   */
  evaluateThreshold(
    result: NormalizedMonitoringResult,
    config?: ThresholdConfig
  ): ThresholdStatus {
    if (!config || !config.isEnabled) return 'normal';

    const { warningThreshold, criticalThreshold, comparison } = config;

    // Determine value to evaluate
    let evalValue: number | null = null;

    if (result.metricType === 'credits' || result.metricType === 'usage') {
      if (result.percentageUsed !== null && result.percentageUsed !== undefined) {
        // e.g. for ElevenLabs/Apollo: if threshold comparison is less_than (remaining %),
        // remaining % = 100 - percentageUsed
        if (comparison === 'less_than') {
          evalValue = 100 - result.percentageUsed;
        } else {
          evalValue = result.percentageUsed;
        }
      } else if (result.remaining !== null && result.remaining !== undefined) {
        evalValue = result.remaining;
      }
    } else if (result.metricType === 'balance') {
      evalValue = result.remaining ?? null;
    } else if (result.metricType === 'spend') {
      if (result.percentageUsed !== null && result.percentageUsed !== undefined) {
        evalValue = result.percentageUsed;
      } else if (result.currentSpend !== null && result.currentSpend !== undefined) {
        evalValue = result.currentSpend;
      }
    }

    if (evalValue === null) return 'normal';

    if (comparison === 'less_than') {
      // e.g. Balance or remaining credits: lower is worse
      if (evalValue <= criticalThreshold) return 'critical';
      if (evalValue <= warningThreshold) return 'warning';
    } else {
      // e.g. Spend or usage %: higher is worse
      if (evalValue >= criticalThreshold) return 'critical';
      if (evalValue >= warningThreshold) return 'warning';
    }

    return 'normal';
  }

  /**
   * Monitor a single service with retries and threshold checks
   */
  async monitorService(provider: BaseProvider): Promise<NormalizedMonitoringResult> {
    const serviceKey = provider.serviceKey;
    logger.info(`Starting monitoring for ${serviceKey}...`);

    // Fetch threshold configuration from database
    let thresholdConfig: ThresholdConfig | undefined;
    try {
      const threshRes = await query(
        'SELECT * FROM threshold_config WHERE service_key = $1',
        [serviceKey]
      );
      if (threshRes.rows.length > 0) {
        const row = threshRes.rows[0];
        thresholdConfig = {
          id: row.id,
          serviceKey: row.service_key,
          warningThreshold: parseFloat(row.warning_threshold),
          criticalThreshold: parseFloat(row.critical_threshold),
          unit: row.unit,
          comparison: row.comparison,
          alertCooldownMinutes: row.alert_cooldown_minutes,
          isEnabled: row.is_enabled,
          updatedAt: row.updated_at,
        };
      }
    } catch (err: any) {
      logger.error('Failed to load threshold config', { service: serviceKey, error: err.message });
    }

    let result: NormalizedMonitoringResult;

    try {
      // 3 retries with backoff on failure
      result = await this.executeWithRetry(() => provider.getMetrics(), serviceKey, 3);
    } catch (err: any) {
      // All 3 retries failed -> Mark DOWN
      result = {
        service: serviceKey,
        status: 'down',
        metricType: 'manual',
        checkedAt: new Date().toISOString(),
        responseTimeMs: 0,
        thresholdStatus: 'normal',
        error: {
          code: 'RETRIES_EXHAUSTED',
          message: `All 3 retry attempts failed: ${err.message}`,
        },
      };
    }

    // Evaluate threshold if healthy
    if (result.status === 'healthy') {
      const thresholdStatus = this.evaluateThreshold(result, thresholdConfig);
      result.thresholdStatus = thresholdStatus;
      if (thresholdStatus === 'critical') {
        result.status = 'critical';
      } else if (thresholdStatus === 'warning') {
        result.status = 'warning';
      }
    }

    // Save monitoring result to DB
    try {
      await query(
        `INSERT INTO monitoring_results (
          service_key, status, metric_type, current_spend, forecasted_spend,
          budget, used, limit_val, remaining, percentage_used, currency,
          threshold_status, raw_metadata, error_code, error_message,
          response_time_ms, checked_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          result.service,
          result.status,
          result.metricType,
          result.currentSpend ?? null,
          result.forecastedSpend ?? null,
          result.budget ?? null,
          result.used ?? null,
          result.limit ?? null,
          result.remaining ?? null,
          result.percentageUsed ?? null,
          result.currency || 'USD',
          result.thresholdStatus,
          result.metadata ? JSON.stringify(result.metadata) : null,
          result.error?.code ?? null,
          result.error?.message ?? null,
          result.responseTimeMs,
          result.checkedAt,
        ]
      );

      // Update service credentials reference configuration verification timestamp
      await query(
        `UPDATE service_credentials_reference
         SET is_configured = $1, last_verified_at = NOW()
         WHERE service_key = $2`,
        [provider.isConfigured(), serviceKey]
      );
    } catch (dbErr: any) {
      logger.error('Failed to persist monitoring result', { service: serviceKey, error: dbErr.message });
    }

    // Process result via Alert Service
    try {
      await this.alertService.processMonitoringResult(result, thresholdConfig);
    } catch (alertErr: any) {
      logger.error('Failed to evaluate alert engine', { service: serviceKey, error: alertErr.message });
    }

    return result;
  }

  /**
   * Run full monitoring loop across all 12 registered providers
   */
  async runFullMonitoringCycle(runType: 'scheduled' | 'manual' = 'scheduled'): Promise<{
    runId: number;
    results: NormalizedMonitoringResult[];
  }> {
    const startTime = new Date();
    logger.info(`Starting full monitoring run (${runType})...`);

    // Create monitoring_run record
    let runId = 0;
    try {
      const runRes = await query(
        `INSERT INTO monitoring_runs (run_type, started_at, status)
         VALUES ($1, $2, 'in_progress')
         RETURNING id`,
        [runType, startTime]
      );
      runId = parseInt(runRes.rows[0].id, 10);
    } catch (err: any) {
      logger.error('Failed to create monitoring run record', { error: err.message });
    }

    const allProviders = getAllProviders();
    const results: NormalizedMonitoringResult[] = [];

    let healthyCount = 0;
    let warningCount = 0;
    let criticalCount = 0;
    let downCount = 0;
    let manualCount = 0;

    for (const provider of allProviders) {
      try {
        const res = await this.monitorService(provider);
        results.push(res);

        if (res.status === 'healthy') healthyCount++;
        else if (res.status === 'warning') warningCount++;
        else if (res.status === 'critical') criticalCount++;
        else if (res.status === 'down') downCount++;
        else if (res.status === 'manual') manualCount++;
      } catch (err: any) {
        logger.error(`Unhandled error during provider monitoring: ${provider.serviceKey}`, {
          error: err.message,
        });
        downCount++;
      }
    }

    const completedTime = new Date();

    // Update monitoring_run record
    if (runId > 0) {
      try {
        await query(
          `UPDATE monitoring_runs
           SET completed_at = $1,
               total_services = $2,
               healthy_count = $3,
               warning_count = $4,
               critical_count = $5,
               down_count = $6,
               manual_count = $7,
               status = 'completed'
           WHERE id = $8`,
          [
            completedTime,
            allProviders.length,
            healthyCount,
            warningCount,
            criticalCount,
            downCount,
            manualCount,
            runId,
          ]
        );
      } catch (err: any) {
        logger.error('Failed to finalize monitoring run record', { error: err.message });
      }
    }

    logger.info(`Completed monitoring run (${runType})`, {
      total: allProviders.length,
      healthy: healthyCount,
      warning: warningCount,
      critical: criticalCount,
      down: downCount,
      manual: manualCount,
      durationMs: completedTime.getTime() - startTime.getTime(),
    });

    return { runId, results };
  }

  /**
   * Daily snapshot generator (stores daily historical data in usage_snapshots)
   */
  async createDailySnapshots(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    logger.info(`Generating daily usage snapshots for ${today}...`);

    const allProviders = getAllProviders();

    for (const provider of allProviders) {
      try {
        // Query latest monitoring result for this service
        const latestRes = await query(
          `SELECT * FROM monitoring_results
           WHERE service_key = $1
           ORDER BY checked_at DESC
           LIMIT 1`,
          [provider.serviceKey]
        );

        if (latestRes.rows.length === 0) continue;

        const row = latestRes.rows[0];

        await query(
          `INSERT INTO usage_snapshots (
            snapshot_date, service_key, status, metric_type, usage_val,
            remaining_val, cost_val, percentage_used, threshold_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (snapshot_date, service_key) DO UPDATE
          SET status = EXCLUDED.status,
              metric_type = EXCLUDED.metric_type,
              usage_val = EXCLUDED.usage_val,
              remaining_val = EXCLUDED.remaining_val,
              cost_val = EXCLUDED.cost_val,
              percentage_used = EXCLUDED.percentage_used,
              threshold_status = EXCLUDED.threshold_status`,
          [
            today,
            row.service_key,
            row.status,
            row.metric_type,
            row.used ?? null,
            row.remaining ?? null,
            row.current_spend ?? null,
            row.percentage_used ?? null,
            row.threshold_status,
          ]
        );
      } catch (err: any) {
        logger.error(`Failed to store daily snapshot for ${provider.serviceKey}`, {
          error: err.message,
        });
      }
    }

    logger.info(`Daily snapshots generation finished for ${today}`);
  }
}

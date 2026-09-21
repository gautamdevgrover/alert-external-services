import { query } from '../db';
import {
  NormalizedMonitoringResult,
  AlertType,
  AlertSeverity,
  AlertRecord,
  ThresholdConfig,
} from '../types/monitoring';
import { INotificationChannel } from './notification/notification.interface';
import { EmailAlertProvider } from './notification/email.provider';
import { WebhookAlertProvider } from './notification/webhook.provider';
import { logger } from '../utils/logger';

export class AlertService {
  private channels: INotificationChannel[];

  constructor(channels?: INotificationChannel[]) {
    this.channels = channels || [new EmailAlertProvider(), new WebhookAlertProvider()];
  }

  /**
   * Process a monitoring result and trigger alerts if state changes or cooldown expires
   */
  async processMonitoringResult(
    result: NormalizedMonitoringResult,
    thresholdConfig?: ThresholdConfig
  ): Promise<AlertRecord | null> {
    const serviceKey = result.service;

    // 1. Get current stored alert state for service
    const stateRes = await query(
      'SELECT * FROM alert_state WHERE service_key = $1',
      [serviceKey]
    );

    let currentState = 'HEALTHY';
    let lastAlertAt: Date | null = null;
    let cooldownUntil: Date | null = null;

    if (stateRes.rows.length > 0) {
      currentState = stateRes.rows[0].current_state;
      lastAlertAt = stateRes.rows[0].last_alert_at ? new Date(stateRes.rows[0].last_alert_at) : null;
      cooldownUntil = stateRes.rows[0].cooldown_until ? new Date(stateRes.rows[0].cooldown_until) : null;
    } else {
      await query(
        'INSERT INTO alert_state (service_key, current_state, last_state_change_at) VALUES ($1, $2, NOW())',
        [serviceKey, 'HEALTHY']
      );
    }

    // 2. Determine target state and alert parameters
    const target = this.determineStateAndAlert(result, thresholdConfig);
    const targetState = target.state;
    const now = new Date();

    logger.debug('Alert state check', {
      service: serviceKey,
      currentState,
      targetState,
      hasAlert: !!target.alertType,
    });

    // 3. Check for RECOVERY transition
    if (
      (currentState === 'DOWN' || currentState === 'CRITICAL' || currentState === 'WARNING') &&
      targetState === 'HEALTHY'
    ) {
      const recoveryAlert = await this.triggerRecovery(serviceKey, currentState, result);
      return recoveryAlert;
    }

    // 4. If target is HEALTHY, nothing more to do
    if (targetState === 'HEALTHY') {
      return null;
    }

    // 5. Anti-Spam Check:
    // Only send an alert if:
    // a) The state changed (e.g. HEALTHY -> WARNING, or WARNING -> CRITICAL)
    // OR
    // b) The cooldown has expired
    const stateChanged = currentState !== targetState;
    const cooldownExpired = !cooldownUntil || now.getTime() >= cooldownUntil.getTime();

    if (!stateChanged && !cooldownExpired) {
      logger.debug('Alert suppressed by anti-spam deduplication / cooldown', {
        service: serviceKey,
        state: currentState,
        cooldownUntil: cooldownUntil?.toISOString(),
      });
      return null;
    }

    // 6. Record and dispatch new alert
    const cooldownMinutes = thresholdConfig?.alertCooldownMinutes || 360;
    const newCooldownUntil = new Date(now.getTime() + cooldownMinutes * 60000);

    const alertRes = await query(
      `INSERT INTO alerts (service_key, alert_type, severity, message, details, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING *`,
      [
        serviceKey,
        target.alertType!,
        target.severity!,
        target.message!,
        JSON.stringify({
          monitoringResult: result,
          thresholdConfig,
          previousState: currentState,
        }),
      ]
    );

    const alertRecord: AlertRecord = {
      id: parseInt(alertRes.rows[0].id, 10),
      serviceKey: alertRes.rows[0].service_key,
      alertType: alertRes.rows[0].alert_type,
      severity: alertRes.rows[0].severity,
      message: alertRes.rows[0].message,
      details: alertRes.rows[0].details,
      status: alertRes.rows[0].status,
      createdAt: alertRes.rows[0].created_at,
    };

    // Update alert_state
    await query(
      `UPDATE alert_state
       SET current_state = $1::VARCHAR,
           last_alert_type = $2,
           last_alert_at = NOW(),
           last_state_change_at = CASE WHEN current_state != $1::VARCHAR THEN NOW() ELSE last_state_change_at END,
           cooldown_until = $3
       WHERE service_key = $4`,
      [targetState, target.alertType, newCooldownUntil, serviceKey]
    );

    // Send notifications to all configured channels
    for (const channel of this.channels) {
      try {
        await channel.sendAlert({
          alert: alertRecord,
          monitoringResult: result,
          previousStatus: currentState,
          recommendedAction: target.recommendedAction,
        });
      } catch (err: any) {
        logger.error('Error dispatching alert to channel', {
          channel: channel.channelName,
          error: err.message,
        });
      }
    }

    return alertRecord;
  }

  private determineStateAndAlert(
    result: NormalizedMonitoringResult,
    thresholdConfig?: ThresholdConfig
  ): {
    state: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'DOWN';
    alertType?: AlertType;
    severity?: AlertSeverity;
    message?: string;
    recommendedAction?: string;
  } {
    // 1. Service is completely DOWN or API error
    if (result.status === 'down') {
      const errCode = result.error?.code || '';
      const isAuthFail =
        errCode === 'HTTP_401' ||
        errCode === 'HTTP_403' ||
        errCode.includes('AUTH') ||
        errCode.includes('CREDENTIALS');

      const alertType: AlertType = isAuthFail ? 'API_AUTH_FAILURE' : 'SERVICE_DOWN';
      return {
        state: 'DOWN',
        alertType,
        severity: 'critical',
        message: `${result.service.toUpperCase()} is DOWN: ${result.error?.message || 'API request failed'}`,
        recommendedAction: isAuthFail
          ? 'Check and update API credentials in environment variables.'
          : 'Check service provider status page and verify network connectivity.',
      };
    }

    // 2. Threshold checks (critical or warning)
    if (result.thresholdStatus === 'critical') {
      let alertType: AlertType = 'LOW_CREDITS';
      let message = `${result.service.toUpperCase()} has reached CRITICAL threshold`;
      let recommendedAction = 'Recharge or increase quota immediately.';

      if (result.metricType === 'balance') {
        alertType = 'LOW_BALANCE';
        message = `${result.service.toUpperCase()} balance is critically low: $${result.remaining?.toFixed(2)}`;
        recommendedAction = 'Add funds to prepaid balance.';
      } else if (result.metricType === 'spend') {
        alertType = 'HIGH_SPEND';
        message = `${result.service.toUpperCase()} spend has reached critical limit: $${result.currentSpend?.toFixed(2)}`;
        recommendedAction = 'Review cloud resources and budget thresholds.';
      } else if (result.metricType === 'usage') {
        alertType = 'HIGH_USAGE';
        message = `${result.service.toUpperCase()} usage is critical (${result.percentageUsed}%)`;
      }

      return {
        state: 'CRITICAL',
        alertType,
        severity: 'critical',
        message,
        recommendedAction,
      };
    }

    if (result.thresholdStatus === 'warning') {
      let alertType: AlertType = 'LOW_CREDITS';
      let message = `${result.service.toUpperCase()} has reached WARNING threshold`;
      let recommendedAction = 'Plan recharge or review usage.';

      if (result.metricType === 'balance') {
        alertType = 'LOW_BALANCE';
        message = `${result.service.toUpperCase()} balance is low: $${result.remaining?.toFixed(2)}`;
        recommendedAction = 'Plan account balance top-up.';
      } else if (result.metricType === 'spend') {
        alertType = 'BILLING_WARNING';
        message = `${result.service.toUpperCase()} spend is elevated: $${result.currentSpend?.toFixed(2)}`;
        recommendedAction = 'Review current billing usage.';
      } else if (result.metricType === 'usage') {
        alertType = 'HIGH_USAGE';
        message = `${result.service.toUpperCase()} usage is high (${result.percentageUsed}%)`;
      }

      return {
        state: 'WARNING',
        alertType,
        severity: 'warning',
        message,
        recommendedAction,
      };
    }

    return { state: 'HEALTHY' };
  }

  private async triggerRecovery(
    serviceKey: string,
    previousState: string,
    result: NormalizedMonitoringResult
  ): Promise<AlertRecord> {
    logger.info('Service recovered to HEALTHY', { service: serviceKey, previousState });

    // Mark previous active alerts as resolved
    await query(
      `UPDATE alerts
       SET status = 'resolved', resolved_at = NOW()
       WHERE service_key = $1 AND status = 'active'`,
      [serviceKey]
    );

    // Create a RECOVERY alert record
    const alertRes = await query(
      `INSERT INTO alerts (service_key, alert_type, severity, message, details, status, resolved_at)
       VALUES ($1, 'RECOVERY', 'info', $2, $3, 'resolved', NOW())
       RETURNING *`,
      [
        serviceKey,
        `${serviceKey.toUpperCase()} has recovered. Status is now HEALTHY.`,
        JSON.stringify({
          previousState,
          currentState: 'HEALTHY',
          monitoringResult: result,
        }),
      ]
    );

    const alertRecord: AlertRecord = {
      id: parseInt(alertRes.rows[0].id, 10),
      serviceKey: alertRes.rows[0].service_key,
      alertType: 'RECOVERY',
      severity: 'info',
      message: `${serviceKey.toUpperCase()} has recovered. Status is now HEALTHY.`,
      status: 'resolved',
      createdAt: alertRes.rows[0].created_at,
      resolvedAt: alertRes.rows[0].resolved_at,
    };

    // Update alert_state
    await query(
      `UPDATE alert_state
       SET current_state = 'HEALTHY',
           last_alert_type = 'RECOVERY',
           last_alert_at = NOW(),
           last_state_change_at = NOW(),
           cooldown_until = NULL
       WHERE service_key = $1`,
      [serviceKey]
    );

    // Send recovery notification
    for (const channel of this.channels) {
      try {
        await channel.sendAlert({
          alert: alertRecord,
          monitoringResult: result,
          previousStatus: previousState,
          recommendedAction: 'No action required. Service operational.',
        });
      } catch (err: any) {
        logger.error('Error sending recovery alert', {
          channel: channel.channelName,
          error: err.message,
        });
      }
    }

    return alertRecord;
  }
}

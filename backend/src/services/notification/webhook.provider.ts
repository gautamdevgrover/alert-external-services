import axios from 'axios';
import { INotificationChannel, AlertNotificationPayload } from './notification.interface';
import { config } from '../../config';
import { logger } from '../../utils/logger';

export class WebhookAlertProvider implements INotificationChannel {
  readonly channelName = 'webhook';

  isEnabled(): boolean {
    return !!config.alertWebhookUrl;
  }

  async sendAlert(payload: AlertNotificationPayload): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    const { alert, monitoringResult, previousStatus, recommendedAction } = payload;
    const isRecovery = alert.alertType === 'RECOVERY';

    const webhookPayload = {
      text: `[${alert.severity.toUpperCase()}] CyberForce Alert: ${alert.serviceKey.toUpperCase()} - ${alert.message}`,
      attachments: [
        {
          color: isRecovery ? '#10B981' : alert.severity === 'critical' ? '#EF4444' : '#F59E0B',
          fields: [
            { title: 'Service', value: alert.serviceKey.toUpperCase(), short: true },
            { title: 'Alert Type', value: alert.alertType, short: true },
            { title: 'Status', value: monitoringResult?.status.toUpperCase() || 'UNKNOWN', short: true },
            { title: 'Previous Status', value: previousStatus?.toUpperCase() || 'N/A', short: true },
            { title: 'Timestamp', value: alert.createdAt, short: false },
            ...(recommendedAction ? [{ title: 'Action', value: recommendedAction, short: false }] : []),
          ],
        },
      ],
      alert,
      monitoringResult,
    };

    try {
      await axios.post(config.alertWebhookUrl, webhookPayload, {
        timeout: config.requestTimeoutMs,
      });
      logger.info('Alert webhook dispatched successfully', {
        service: alert.serviceKey,
        alertType: alert.alertType,
      });
      return true;
    } catch (err: any) {
      logger.error('Failed to dispatch alert webhook', {
        error: err.message,
        service: alert.serviceKey,
      });
      return false;
    }
  }
}

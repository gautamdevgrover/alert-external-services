import nodemailer from 'nodemailer';
import { INotificationChannel, AlertNotificationPayload } from './notification.interface';
import { config } from '../../config';
import { logger } from '../../utils/logger';

export class EmailAlertProvider implements INotificationChannel {
  readonly channelName = 'email';
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (config.email.smtpHost && config.email.alertEmail) {
      this.transporter = nodemailer.createTransport({
        host: config.email.smtpHost,
        port: config.email.smtpPort,
        secure: config.email.smtpSecure,
        auth: config.email.smtpUser
          ? {
              user: config.email.smtpUser,
              pass: config.email.smtpPassword,
            }
          : undefined,
      });
    }
  }

  isEnabled(): boolean {
    return !!(config.email.alertEmail && this.transporter);
  }

  private buildSubject(payload: AlertNotificationPayload): string {
    const { alert } = payload;
    const serviceName = alert.serviceKey.toUpperCase();

    if (alert.alertType === 'RECOVERY') {
      return `[RECOVERED] CyberForce - ${serviceName}`;
    }

    const tag = alert.severity === 'critical' ? 'CRITICAL' : 'WARNING';
    return `[${tag}] CyberForce - ${serviceName} Alert: ${alert.alertType.replace(/_/g, ' ')}`;
  }

  private buildHtml(payload: AlertNotificationPayload): string {
    const { alert, monitoringResult, previousStatus, recommendedAction } = payload;
    const isRecovery = alert.alertType === 'RECOVERY';
    const accentColor = isRecovery ? '#10B981' : alert.severity === 'critical' ? '#EF4444' : '#F59E0B';

    let metricDetails = '';
    if (monitoringResult) {
      if (monitoringResult.remaining !== undefined && monitoringResult.remaining !== null) {
        const unit = monitoringResult.currency === 'USD' ? '$' : '';
        const suffix = monitoringResult.currency !== 'USD' && monitoringResult.currency ? ` ${monitoringResult.currency}` : '';
        metricDetails += `<p><strong>Remaining:</strong> ${unit}${monitoringResult.remaining.toLocaleString()}${suffix}</p>`;
      }
      if (monitoringResult.limit !== undefined && monitoringResult.limit !== null) {
        metricDetails += `<p><strong>Total Limit / Quota:</strong> ${monitoringResult.limit.toLocaleString()}</p>`;
      }
      if (monitoringResult.currentSpend !== undefined && monitoringResult.currentSpend !== null) {
        metricDetails += `<p><strong>Current Spend:</strong> $${monitoringResult.currentSpend.toFixed(2)}</p>`;
      }
      if (monitoringResult.budget !== undefined && monitoringResult.budget !== null) {
        metricDetails += `<p><strong>Budget:</strong> $${monitoringResult.budget.toFixed(2)}</p>`;
      }
      if (monitoringResult.percentageUsed !== undefined && monitoringResult.percentageUsed !== null) {
        metricDetails += `<p><strong>Usage:</strong> ${monitoringResult.percentageUsed}%</p>`;
      }
    }

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>CyberForce Alert</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .header { background-color: ${accentColor}; color: #ffffff; padding: 20px 24px; font-size: 20px; font-weight: bold; }
    .content { padding: 24px; color: #1f2937; line-height: 1.6; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; background-color: ${accentColor}20; color: ${accentColor}; }
    .details-box { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 16px 0; }
    .action-box { background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin-top: 16px; }
    .footer { padding: 16px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      ${isRecovery ? 'Service Recovered' : 'CyberForce External Service Alert'}
    </div>
    <div class="content">
      <p><span class="badge">${alert.severity}</span></p>
      <h2>${alert.serviceKey.toUpperCase()} - ${alert.message}</h2>
      
      <div class="details-box">
        <p><strong>Service:</strong> ${alert.serviceKey.toUpperCase()}</p>
        <p><strong>Alert Type:</strong> ${alert.alertType}</p>
        ${previousStatus ? `<p><strong>Previous Status:</strong> ${previousStatus.toUpperCase()}</p>` : ''}
        <p><strong>Current Status:</strong> ${monitoringResult?.status.toUpperCase() || alert.severity.toUpperCase()}</p>
        ${metricDetails}
        <p><strong>Time:</strong> ${new Date(alert.createdAt).toLocaleString()}</p>
      </div>

      ${
        recommendedAction
          ? `<div class="action-box">
               <strong>Recommended Action:</strong> ${recommendedAction}
             </div>`
          : ''
      }
    </div>
    <div class="footer">
      Automated alert from CyberForce Monitoring System. Do not reply to this email.
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  async sendAlert(payload: AlertNotificationPayload): Promise<boolean> {
    const subject = this.buildSubject(payload);
    const html = this.buildHtml(payload);

    if (!this.isEnabled()) {
      logger.warn('Email notification skipped: SMTP or recipient email not configured', {
        subject,
        service: payload.alert.serviceKey,
        alertType: payload.alert.alertType,
      });
      return false;
    }

    try {
      await this.transporter!.sendMail({
        from: config.email.from,
        to: config.email.alertEmail,
        subject,
        html,
        text: `${subject}\n\n${payload.alert.message}\nTime: ${payload.alert.createdAt}`,
      });

      logger.info('Alert email sent successfully', {
        to: config.email.alertEmail,
        subject,
        service: payload.alert.serviceKey,
      });
      return true;
    } catch (err: any) {
      logger.error('Failed to send alert email', {
        error: err.message,
        service: payload.alert.serviceKey,
      });
      return false;
    }
  }
}

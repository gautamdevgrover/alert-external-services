import { AlertRecord, NormalizedMonitoringResult } from '../../types/monitoring';

export interface AlertNotificationPayload {
  alert: AlertRecord;
  monitoringResult?: NormalizedMonitoringResult;
  previousStatus?: string;
  recommendedAction?: string;
}

export interface INotificationChannel {
  readonly channelName: string;
  isEnabled(): boolean;
  sendAlert(payload: AlertNotificationPayload): Promise<boolean>;
}

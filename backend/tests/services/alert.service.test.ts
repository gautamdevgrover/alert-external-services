import { AlertService } from '../../src/services/alert.service';
import { NormalizedMonitoringResult, ThresholdConfig } from '../../src/types/monitoring';
import * as db from '../../src/db';

jest.mock('../../src/db', () => ({
  query: jest.fn(),
}));

describe('AlertService', () => {
  let alertService: AlertService;
  let mockChannel: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockChannel = {
      channelName: 'mock_channel',
      isEnabled: jest.fn().mockReturnValue(true),
      sendAlert: jest.fn().mockResolvedValue(true),
    };
    alertService = new AlertService([mockChannel]);
  });

  it('should trigger a CRITICAL alert on state transition from HEALTHY to CRITICAL', async () => {
    // Current DB state: HEALTHY
    (db.query as jest.Mock).mockImplementation((text: string) => {
      if (text.includes('SELECT * FROM alert_state')) {
        return Promise.resolve({
          rows: [
            {
              service_key: 'elevenlabs',
              current_state: 'HEALTHY',
              last_alert_at: null,
              cooldown_until: null,
            },
          ],
        });
      }
      if (text.includes('INSERT INTO alerts')) {
        return Promise.resolve({
          rows: [
            {
              id: 1,
              service_key: 'elevenlabs',
              alert_type: 'LOW_CREDITS',
              severity: 'critical',
              message: 'ELEVENLABS has reached CRITICAL threshold',
              created_at: new Date().toISOString(),
              status: 'active',
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const mockResult: NormalizedMonitoringResult = {
      service: 'elevenlabs',
      status: 'critical',
      metricType: 'credits',
      remaining: 5000,
      limit: 100000,
      percentageUsed: 95,
      thresholdStatus: 'critical',
      checkedAt: new Date().toISOString(),
      responseTimeMs: 120,
    };

    const alert = await alertService.processMonitoringResult(mockResult);

    expect(alert).not.toBeNull();
    expect(alert?.severity).toBe('critical');
    expect(alert?.alertType).toBe('LOW_CREDITS');
    expect(mockChannel.sendAlert).toHaveBeenCalledTimes(1);
  });

  it('should suppress duplicate alert if state remains unchanged and cooldown has not expired', async () => {
    // Current DB state: already CRITICAL with active cooldown
    const futureDate = new Date(Date.now() + 3600 * 1000); // 1 hour from now

    (db.query as jest.Mock).mockImplementation((text: string) => {
      if (text.includes('SELECT * FROM alert_state')) {
        return Promise.resolve({
          rows: [
            {
              service_key: 'elevenlabs',
              current_state: 'CRITICAL',
              last_alert_at: new Date().toISOString(),
              cooldown_until: futureDate.toISOString(),
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const mockResult: NormalizedMonitoringResult = {
      service: 'elevenlabs',
      status: 'critical',
      metricType: 'credits',
      remaining: 4500,
      limit: 100000,
      percentageUsed: 95.5,
      thresholdStatus: 'critical',
      checkedAt: new Date().toISOString(),
      responseTimeMs: 110,
    };

    const alert = await alertService.processMonitoringResult(mockResult);

    // Duplicate alert should be suppressed
    expect(alert).toBeNull();
    expect(mockChannel.sendAlert).not.toHaveBeenCalled();
  });

  it('should trigger a RECOVERY alert when transitioning from DOWN to HEALTHY', async () => {
    (db.query as jest.Mock).mockImplementation((text: string) => {
      if (text.includes('SELECT * FROM alert_state')) {
        return Promise.resolve({
          rows: [
            {
              service_key: 'apollo',
              current_state: 'DOWN',
              last_alert_at: new Date().toISOString(),
              cooldown_until: new Date().toISOString(),
            },
          ],
        });
      }
      if (text.includes('INSERT INTO alerts')) {
        return Promise.resolve({
          rows: [
            {
              id: 2,
              service_key: 'apollo',
              alert_type: 'RECOVERY',
              severity: 'info',
              message: 'APOLLO has recovered. Status is now HEALTHY.',
              created_at: new Date().toISOString(),
              resolved_at: new Date().toISOString(),
              status: 'resolved',
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const mockResult: NormalizedMonitoringResult = {
      service: 'apollo',
      status: 'healthy',
      metricType: 'credits',
      remaining: 2000,
      thresholdStatus: 'normal',
      checkedAt: new Date().toISOString(),
      responseTimeMs: 90,
    };

    const alert = await alertService.processMonitoringResult(mockResult);

    expect(alert).not.toBeNull();
    expect(alert?.alertType).toBe('RECOVERY');
    expect(alert?.severity).toBe('info');
    expect(mockChannel.sendAlert).toHaveBeenCalledTimes(1);
    expect(mockChannel.sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        previousStatus: 'DOWN',
      })
    );
  });
});

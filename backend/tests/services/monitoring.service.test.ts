import { MonitoringService } from '../../src/services/monitoring.service';
import { NormalizedMonitoringResult, ThresholdConfig } from '../../src/types/monitoring';

describe('MonitoringService - Threshold Evaluation', () => {
  let monitoringService: MonitoringService;

  beforeEach(() => {
    monitoringService = new MonitoringService();
  });

  it('should evaluate balance thresholds correctly (less_than: lower is worse)', () => {
    const thresholdConfig: ThresholdConfig = {
      id: 1,
      serviceKey: 'plivo',
      warningThreshold: 10,
      criticalThreshold: 5,
      unit: 'USD',
      comparison: 'less_than',
      alertCooldownMinutes: 360,
      isEnabled: true,
      updatedAt: new Date().toISOString(),
    };

    const healthyResult: NormalizedMonitoringResult = {
      service: 'plivo',
      status: 'healthy',
      metricType: 'balance',
      remaining: 25.0,
      thresholdStatus: 'normal',
      checkedAt: new Date().toISOString(),
      responseTimeMs: 50,
    };

    const warningResult: NormalizedMonitoringResult = {
      ...healthyResult,
      remaining: 8.5,
    };

    const criticalResult: NormalizedMonitoringResult = {
      ...healthyResult,
      remaining: 3.2,
    };

    expect(monitoringService.evaluateThreshold(healthyResult, thresholdConfig)).toBe('normal');
    expect(monitoringService.evaluateThreshold(warningResult, thresholdConfig)).toBe('warning');
    expect(monitoringService.evaluateThreshold(criticalResult, thresholdConfig)).toBe('critical');
  });

  it('should evaluate spend/usage thresholds correctly (greater_than: higher is worse)', () => {
    const thresholdConfig: ThresholdConfig = {
      id: 2,
      serviceKey: 'aws',
      warningThreshold: 80,
      criticalThreshold: 90,
      unit: '%',
      comparison: 'greater_than',
      alertCooldownMinutes: 360,
      isEnabled: true,
      updatedAt: new Date().toISOString(),
    };

    const normalResult: NormalizedMonitoringResult = {
      service: 'aws',
      status: 'healthy',
      metricType: 'spend',
      percentageUsed: 65,
      thresholdStatus: 'normal',
      checkedAt: new Date().toISOString(),
      responseTimeMs: 50,
    };

    const warningResult: NormalizedMonitoringResult = {
      ...normalResult,
      percentageUsed: 82,
    };

    const criticalResult: NormalizedMonitoringResult = {
      ...normalResult,
      percentageUsed: 94,
    };

    expect(monitoringService.evaluateThreshold(normalResult, thresholdConfig)).toBe('normal');
    expect(monitoringService.evaluateThreshold(warningResult, thresholdConfig)).toBe('warning');
    expect(monitoringService.evaluateThreshold(criticalResult, thresholdConfig)).toBe('critical');
  });
});

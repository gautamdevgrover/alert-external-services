import { Router, Request, Response } from 'express';
import { MonitoringService } from '../../services/monitoring.service';
import { getProvider } from '../../providers';
import { logger } from '../../utils/logger';

const router = Router();
const monitoringService = new MonitoringService();

/**
 * POST /api/monitoring/run - Manually trigger full monitoring cycle or single service
 */
router.post('/run', async (req: Request, res: Response) => {
  const { service } = req.body;

  try {
    if (service) {
      const provider = getProvider(String(service).toLowerCase());
      if (!provider) {
        return res.status(404).json({ error: `Provider '${service}' not found` });
      }

      logger.info(`Manual check triggered for service: ${service}`);
      const result = await monitoringService.monitorService(provider);
      return res.json({
        message: `Monitoring check completed for ${service}`,
        result,
      });
    }

    logger.info('Manual full monitoring cycle triggered via API');
    const { runId, results } = await monitoringService.runFullMonitoringCycle('manual');
    res.json({
      message: 'Full monitoring cycle completed successfully',
      runId,
      results,
    });
  } catch (err: any) {
    logger.error('Error during manual monitoring run', { error: err.message });
    res.status(500).json({ error: 'Failed to run monitoring cycle' });
  }
});

/**
 * POST /api/monitoring/snapshot - Manually trigger daily snapshot generation
 */
router.post('/snapshot', async (req: Request, res: Response) => {
  try {
    logger.info('Manual daily snapshot triggered via API');
    await monitoringService.createDailySnapshots();
    res.json({ message: 'Daily snapshots generated successfully' });
  } catch (err: any) {
    logger.error('Error generating daily snapshots', { error: err.message });
    res.status(500).json({ error: 'Failed to generate snapshots' });
  }
});

export default router;

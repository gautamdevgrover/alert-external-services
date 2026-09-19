import { Router, Request, Response } from 'express';
import { query } from '../../db';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/metrics - Overview KPI summary metrics for Dashboard home cards
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // 1. Get total services
    const servicesCountRes = await query('SELECT COUNT(*) as total FROM services');
    const totalServices = parseInt(servicesCountRes.rows[0].total || '0', 10);

    // 2. Get latest status of each service
    const latestStatusRes = await query(`
      SELECT DISTINCT ON (service_key) service_key, status, metric_type, checked_at
      FROM monitoring_results
      ORDER BY service_key, checked_at DESC
    `);

    let healthy = 0;
    let warning = 0;
    let critical = 0;
    let down = 0;
    let manual = 0;

    for (const row of latestStatusRes.rows) {
      if (row.status === 'healthy') healthy++;
      else if (row.status === 'warning') warning++;
      else if (row.status === 'critical') critical++;
      else if (row.status === 'down') down++;
      else if (row.status === 'manual') manual++;
    }

    // Any service that has never been checked yet counts as manual/unknown
    const checkedServiceKeys = new Set(latestStatusRes.rows.map((r) => r.service_key));
    const allServicesRes = await query('SELECT key FROM services');
    for (const row of allServicesRes.rows) {
      if (!checkedServiceKeys.has(row.key)) {
        manual++;
      }
    }

    // 3. Active alerts count
    const activeAlertsRes = await query(
      "SELECT COUNT(*) as count FROM alerts WHERE status = 'active'"
    );
    const activeAlerts = parseInt(activeAlertsRes.rows[0].count || '0', 10);

    // 4. Latest monitoring run
    const lastRunRes = await query(
      'SELECT * FROM monitoring_runs ORDER BY started_at DESC LIMIT 1'
    );

    res.json({
      totalServices,
      healthy,
      warning,
      critical,
      down,
      manual,
      activeAlerts,
      lastRun: lastRunRes.rows[0] || null,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('Error fetching dashboard metrics', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve dashboard metrics' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { query } from '../../db';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/history/:service - Historical metrics and daily snapshots for charts
 */
router.get('/:service', async (req: Request, res: Response) => {
  const serviceKey = req.params.service.toLowerCase();
  const { days = 30 } = req.query;

  try {
    // 1. Fetch daily snapshots
    const snapshotsRes = await query(
      `SELECT * FROM usage_snapshots
       WHERE service_key = $1
       ORDER BY snapshot_date ASC
       LIMIT $2`,
      [serviceKey, parseInt(String(days), 10)]
    );

    // 2. Fetch high-res recent monitoring results (last 50 checks)
    const recentChecksRes = await query(
      `SELECT 
        checked_at, status, metric_type, used, limit_val, remaining,
        current_spend, forecasted_spend, budget, percentage_used, response_time_ms
       FROM monitoring_results
       WHERE service_key = $1
       ORDER BY checked_at DESC
       LIMIT 50`,
      [serviceKey]
    );

    res.json({
      serviceKey,
      dailySnapshots: snapshotsRes.rows.map((r) => ({
        date: r.snapshot_date,
        status: r.status,
        metricType: r.metric_type,
        usage: r.usage_val ? parseFloat(r.usage_val) : null,
        remaining: r.remaining_val ? parseFloat(r.remaining_val) : null,
        cost: r.cost_val ? parseFloat(r.cost_val) : null,
        percentageUsed: r.percentage_used ? parseFloat(r.percentage_used) : null,
        thresholdStatus: r.threshold_status,
      })),
      recentChecks: recentChecksRes.rows.reverse().map((r) => ({
        checkedAt: r.checked_at,
        status: r.status,
        metricType: r.metric_type,
        used: r.used ? parseFloat(r.used) : null,
        limit: r.limit_val ? parseFloat(r.limit_val) : null,
        remaining: r.remaining ? parseFloat(r.remaining) : null,
        currentSpend: r.current_spend ? parseFloat(r.current_spend) : null,
        forecastedSpend: r.forecasted_spend ? parseFloat(r.forecasted_spend) : null,
        budget: r.budget ? parseFloat(r.budget) : null,
        percentageUsed: r.percentage_used ? parseFloat(r.percentage_used) : null,
        responseTimeMs: r.response_time_ms,
      })),
    });
  } catch (err: any) {
    logger.error(`Error fetching history for service ${serviceKey}`, { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve service history' });
  }
});

export default router;

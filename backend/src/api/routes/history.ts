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

    const parseNum = (val: any) =>
      val !== null && val !== undefined && val !== '' ? parseFloat(val) : null;

    res.json({
      serviceKey,
      dailySnapshots: snapshotsRes.rows.map((r) => ({
        date: r.snapshot_date,
        status: r.status,
        metricType: r.metric_type,
        usage: parseNum(r.usage_val),
        remaining: parseNum(r.remaining_val),
        cost: parseNum(r.cost_val),
        percentageUsed: parseNum(r.percentage_used),
        thresholdStatus: r.threshold_status,
      })),
      recentChecks: recentChecksRes.rows.reverse().map((r) => ({
        checkedAt: r.checked_at,
        status: r.status,
        metricType: r.metric_type,
        used: parseNum(r.used),
        limit: parseNum(r.limit_val),
        remaining: parseNum(r.remaining),
        currentSpend: parseNum(r.current_spend),
        forecastedSpend: parseNum(r.forecasted_spend),
        budget: parseNum(r.budget),
        percentageUsed: parseNum(r.percentage_used),
        responseTimeMs: r.response_time_ms,
      })),
    });
  } catch (err: any) {
    logger.error(`Error fetching history for service ${serviceKey}`, { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve service history' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { query } from '../../db';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/alerts - List alerts with optional status and service filters
 */
router.get('/', async (req: Request, res: Response) => {
  const { status, service, limit = 50 } = req.query;

  try {
    let sql = 'SELECT * FROM alerts WHERE 1=1';
    const params: any[] = [];

    if (status && (status === 'active' || status === 'resolved')) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }

    if (service) {
      params.push(String(service).toLowerCase());
      sql += ` AND service_key = $${params.length}`;
    }

    params.push(parseInt(String(limit), 10));
    sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const alertsRes = await query(sql, params);

    // Also fetch alert counts summary
    const countRes = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'active') as active_count,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
        COUNT(*) as total_count
      FROM alerts
    `);

    res.json({
      summary: {
        active: parseInt(countRes.rows[0].active_count || '0', 10),
        resolved: parseInt(countRes.rows[0].resolved_count || '0', 10),
        total: parseInt(countRes.rows[0].total_count || '0', 10),
      },
      alerts: alertsRes.rows,
    });
  } catch (err: any) {
    logger.error('Error fetching alerts', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve alerts' });
  }
});

/**
 * POST /api/alerts/:id/resolve - Manually resolve an alert
 */
router.post('/:id/resolve', async (req: Request, res: Response) => {
  const alertId = parseInt(req.params.id, 10);

  try {
    const updateRes = await query(
      `UPDATE alerts
       SET status = 'resolved', resolved_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [alertId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({ message: 'Alert marked as resolved', alert: updateRes.rows[0] });
  } catch (err: any) {
    logger.error('Error resolving alert', { id: alertId, error: err.message });
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

export default router;

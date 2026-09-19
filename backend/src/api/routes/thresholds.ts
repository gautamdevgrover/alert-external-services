import { Router, Request, Response } from 'express';
import { query } from '../../db';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/thresholds - Get all threshold configurations
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const thresholdsRes = await query(`
      SELECT t.*, s.name, s.category, s.is_enabled as service_enabled
      FROM threshold_config t
      JOIN services s ON t.service_key = s.key
      ORDER BY s.name ASC
    `);

    res.json(
      thresholdsRes.rows.map((r) => ({
        id: r.id,
        serviceKey: r.service_key,
        serviceName: r.name,
        category: r.category,
        warningThreshold: parseFloat(r.warning_threshold),
        criticalThreshold: parseFloat(r.critical_threshold),
        unit: r.unit,
        comparison: r.comparison,
        alertCooldownMinutes: r.alert_cooldown_minutes,
        isEnabled: r.is_enabled,
        serviceEnabled: r.service_enabled,
        updatedAt: r.updated_at,
      }))
    );
  } catch (err: any) {
    logger.error('Error fetching threshold configs', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve threshold configurations' });
  }
});

/**
 * PUT /api/thresholds/:service - Update threshold configurations for a service
 */
router.put('/:service', async (req: Request, res: Response) => {
  const serviceKey = req.params.service.toLowerCase();
  const {
    warningThreshold,
    criticalThreshold,
    alertCooldownMinutes,
    isEnabled,
  } = req.body;

  try {
    const updateRes = await query(
      `UPDATE threshold_config
       SET warning_threshold = COALESCE($1, warning_threshold),
           critical_threshold = COALESCE($2, critical_threshold),
           alert_cooldown_minutes = COALESCE($3, alert_cooldown_minutes),
           is_enabled = COALESCE($4, is_enabled),
           updated_at = NOW()
       WHERE service_key = $5
       RETURNING *`,
      [
        warningThreshold !== undefined ? Number(warningThreshold) : null,
        criticalThreshold !== undefined ? Number(criticalThreshold) : null,
        alertCooldownMinutes !== undefined ? parseInt(String(alertCooldownMinutes), 10) : null,
        isEnabled !== undefined ? Boolean(isEnabled) : null,
        serviceKey,
      ]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: `Threshold configuration for '${serviceKey}' not found` });
    }

    logger.info(`Updated threshold configuration for ${serviceKey}`, {
      warningThreshold,
      criticalThreshold,
      alertCooldownMinutes,
      isEnabled,
    });

    res.json({
      message: 'Threshold configuration updated successfully',
      config: updateRes.rows[0],
    });
  } catch (err: any) {
    logger.error(`Error updating threshold config for ${serviceKey}`, { error: err.message });
    res.status(500).json({ error: 'Failed to update threshold configuration' });
  }
});

export default router;

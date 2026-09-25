import { Router, Request, Response } from 'express';
import { query } from '../../db';
import { getAllProviders, getProvider } from '../../providers';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/services - List all 12 services with their latest monitoring status and metrics
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // 1. Get all services metadata from db
    const servicesRes = await query(
      'SELECT * FROM services ORDER BY name ASC'
    );

    // 2. Get latest monitoring result for each service
    const latestResultsRes = await query(
      `SELECT DISTINCT ON (service_key) *
       FROM monitoring_results
       ORDER BY service_key, checked_at DESC`
    );

    const latestMap = new Map<string, any>();
    for (const r of latestResultsRes.rows) {
      latestMap.set(r.service_key, r);
    }

    // 3. Get credential configuration status
    const credsRes = await query(
      'SELECT * FROM service_credentials_reference'
    );
    const credsMap = new Map<string, any>();
    for (const c of credsRes.rows) {
      credsMap.set(c.service_key, c);
    }

    // 4. Combine into clean response (secrets are NEVER returned)
    const data = servicesRes.rows.map((s) => {
      const provider = getProvider(s.key);
      const latest = latestMap.get(s.key);
      const cred = credsMap.get(s.key);

      const parseNum = (val: any) =>
        val !== null && val !== undefined && val !== '' ? parseFloat(val) : null;

      return {
        key: s.key,
        name: s.name,
        category: s.category,
        description: s.description,
        website: s.website,
        isEnabled: s.is_enabled,
        isConfigured: provider ? provider.isConfigured() : false,
        envVarNames: cred?.env_var_names || (provider ? provider.getRequiredEnvVars() : []),
        lastVerifiedAt: cred?.last_verified_at,
        latestResult: latest
          ? {
              status: latest.status,
              metricType: latest.metric_type,
              currentSpend: parseNum(latest.current_spend),
              forecastedSpend: parseNum(latest.forecasted_spend),
              budget: parseNum(latest.budget),
              used: parseNum(latest.used),
              limit: parseNum(latest.limit_val),
              remaining: parseNum(latest.remaining),
              percentageUsed: parseNum(latest.percentage_used),
              currency: latest.currency,
              thresholdStatus: latest.threshold_status,
              checkedAt: latest.checked_at,
              responseTimeMs: latest.response_time_ms,
              error: latest.error_code
                ? {
                    code: latest.error_code,
                    message: latest.error_message,
                  }
                : null,
              metadata: latest.raw_metadata,
            }
          : null,
      };
    });

    res.json(data);
  } catch (err: any) {
    logger.error('Error fetching services list', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve services list' });
  }
});

/**
 * GET /api/services/:service - Details for a specific service
 */
router.get('/:service', async (req: Request, res: Response) => {
  const serviceKey = req.params.service.toLowerCase();

  try {
    const serviceRes = await query('SELECT * FROM services WHERE key = $1', [serviceKey]);
    if (serviceRes.rows.length === 0) {
      return res.status(404).json({ error: `Service '${serviceKey}' not found` });
    }

    const service = serviceRes.rows[0];
    const provider = getProvider(serviceKey);

    // Latest monitoring result
    const latestRes = await query(
      'SELECT * FROM monitoring_results WHERE service_key = $1 ORDER BY checked_at DESC LIMIT 1',
      [serviceKey]
    );

    // Threshold config
    const thresholdRes = await query(
      'SELECT * FROM threshold_config WHERE service_key = $1',
      [serviceKey]
    );

    // Recent 10 alerts
    const alertsRes = await query(
      'SELECT * FROM alerts WHERE service_key = $1 ORDER BY created_at DESC LIMIT 10',
      [serviceKey]
    );

    const parseNum = (val: any) =>
      val !== null && val !== undefined && val !== '' ? parseFloat(val) : null;

    const rawLatest = latestRes.rows[0];
    const latestResult = rawLatest
      ? {
          ...rawLatest,
          current_spend: parseNum(rawLatest.current_spend),
          forecasted_spend: parseNum(rawLatest.forecasted_spend),
          budget: parseNum(rawLatest.budget),
          used: parseNum(rawLatest.used),
          limit_val: parseNum(rawLatest.limit_val),
          remaining: parseNum(rawLatest.remaining),
          percentage_used: parseNum(rawLatest.percentage_used),
        }
      : null;

    const rawThresh = thresholdRes.rows[0];
    const thresholdConfig = rawThresh
      ? {
          ...rawThresh,
          warningThreshold: parseNum(rawThresh.warning_threshold),
          criticalThreshold: parseNum(rawThresh.critical_threshold),
          alertCooldownMinutes: rawThresh.alert_cooldown_minutes,
          isEnabled: rawThresh.is_enabled,
        }
      : null;

    res.json({
      service: {
        key: service.key,
        name: service.name,
        category: service.category,
        description: service.description,
        website: service.website,
        isEnabled: service.is_enabled,
        isConfigured: provider ? provider.isConfigured() : false,
        requiredEnvVars: provider ? provider.getRequiredEnvVars() : [],
      },
      latestResult,
      thresholdConfig,
      recentAlerts: alertsRes.rows,
    });
  } catch (err: any) {
    logger.error(`Error fetching service details: ${serviceKey}`, { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve service details' });
  }
});

export default router;

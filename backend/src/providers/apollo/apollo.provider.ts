import axios from 'axios';
import { BaseProvider } from '../base.provider';
import { HealthCheckResult, NormalizedMonitoringResult } from '../../types/monitoring';
import { config } from '../../config';

export class ApolloProvider extends BaseProvider {
  readonly serviceKey = 'apollo';
  readonly serviceName = 'Apollo.io';

  private apiKey = config.providers.apollo.apiKey;

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  getRequiredEnvVars(): string[] {
    return ['APOLLO_API_KEY'];
  }

  async checkHealth(): Promise<HealthCheckResult> {
    if (!this.isConfigured()) {
      return {
        isHealthy: false,
        responseTimeMs: 0,
        error: {
          code: 'CREDENTIALS_MISSING',
          message: 'Apollo API key not configured',
        },
      };
    }

    const start = Date.now();
    try {
      // Try /auth/health first or api_profile
      const response = await axios.get('https://api.apollo.io/api/v1/users/api_profile', {
        headers: {
          'x-api-key': this.apiKey,
          'Cache-Control': 'no-cache',
        },
        timeout: config.requestTimeoutMs,
      });

      return {
        isHealthy: response.status >= 200 && response.status < 300,
        responseTimeMs: Date.now() - start,
        statusCode: response.status,
      };
    } catch (err: any) {
      // If 404 on api_profile, try fallback auth/health
      if (err.response?.status === 404) {
        try {
          const resHealth = await axios.get('https://api.apollo.io/api/v1/auth/health', {
            headers: { 'x-api-key': this.apiKey },
            timeout: config.requestTimeoutMs,
          });
          return {
            isHealthy: resHealth.status >= 200 && resHealth.status < 300,
            responseTimeMs: Date.now() - start,
            statusCode: resHealth.status,
          };
        } catch (hErr: any) {
          return {
            isHealthy: false,
            responseTimeMs: Date.now() - start,
            statusCode: hErr.response?.status,
            error: this.formatError(hErr),
          };
        }
      }

      return {
        isHealthy: false,
        responseTimeMs: Date.now() - start,
        statusCode: err.response?.status,
        error: this.formatError(err),
      };
    }
  }

  async getMetrics(): Promise<NormalizedMonitoringResult> {
    if (!this.isConfigured()) {
      return {
        ...this.createBaseResult('down', 'credits', 0, {
          code: 'CREDENTIALS_MISSING',
          message: 'APOLLO_API_KEY is missing in environment',
        }),
        used: null,
        limit: null,
        remaining: null,
      };
    }

    const start = Date.now();
    try {
      // Query usage stats (requires Master Key)
      let usageData: any = null;
      let usageHeaders: Record<string, any> = {};
      try {
        const usageRes = await axios.post(
          'https://api.apollo.io/api/v1/usage_stats/api_usage_stats',
          {},
          {
            headers: {
              'x-api-key': this.apiKey,
              'Content-Type': 'application/json',
            },
            timeout: config.requestTimeoutMs,
          }
        );
        usageData = usageRes.data;
        usageHeaders = usageRes.headers || {};
      } catch (uErr: any) {
        // Master API key might be missing, or endpoint not accessible on tier
      }

      // Query user profile / health to confirm status & retrieve profile headers
      let profileRes: any = null;
      try {
        profileRes = await axios.get('https://api.apollo.io/api/v1/users/api_profile', {
          headers: {
            'x-api-key': this.apiKey,
          },
          timeout: config.requestTimeoutMs,
        });
      } catch (pErr: any) {
        if (pErr.response?.status === 404 || pErr.response?.status === 403) {
          profileRes = await axios.get('https://api.apollo.io/api/v1/auth/health', {
            headers: { 'x-api-key': this.apiKey },
            timeout: config.requestTimeoutMs,
          });
        } else if (!usageData) {
          throw pErr;
        }
      }

      const responseTimeMs = Date.now() - start;
      const combinedHeaders = { ...(profileRes?.headers || {}), ...usageHeaders };

      // Extract rate limit headers (both standard and Apollo 24-hour headers)
      const rateLimitRemaining = combinedHeaders['x-24-hour-requests-left']
        ? parseInt(combinedHeaders['x-24-hour-requests-left'], 10)
        : combinedHeaders['x-rate-limit-remaining']
        ? parseInt(combinedHeaders['x-rate-limit-remaining'], 10)
        : null;

      const rateLimitTotal = combinedHeaders['x-rate-limit-24-hour']
        ? parseInt(combinedHeaders['x-rate-limit-24-hour'], 10)
        : combinedHeaders['x-rate-limit-limit']
        ? parseInt(combinedHeaders['x-rate-limit-limit'], 10)
        : null;

      const rateLimitUsed = combinedHeaders['x-24-hour-usage']
        ? parseInt(combinedHeaders['x-24-hour-usage'], 10)
        : null;

      // Check if Apollo returned credits in user profile or usage stats
      const user = profileRes?.data?.user || profileRes?.data;
      const credits = user?.credits ?? user?.available_credits;

      if (credits !== undefined && credits !== null) {
        const remaining = typeof credits === 'number' ? credits : parseFloat(credits);
        return {
          ...this.createBaseResult('healthy', 'credits', responseTimeMs),
          remaining,
          metadata: {
            userEmail: user?.email,
            rateLimitRemaining,
          },
        };
      }

      // If api_usage array is present
      if (usageData && Array.isArray(usageData.api_usage) && usageData.api_usage.length > 0) {
        let totalUsed = 0;
        let totalLimit = 0;
        for (const item of usageData.api_usage) {
          totalUsed += item.used_today || 0;
          totalLimit += item.limit_per_minute || 0;
        }
        return {
          ...this.createBaseResult('healthy', 'usage', responseTimeMs),
          used: totalUsed,
          limit: totalLimit > 0 ? totalLimit : null,
          remaining: totalLimit > totalUsed ? totalLimit - totalUsed : null,
          metadata: {
            apiUsage: usageData.api_usage,
          },
        };
      }

      // If rate limit remaining is available from headers
      if (rateLimitRemaining !== null) {
        const used =
          rateLimitUsed !== null
            ? rateLimitUsed
            : rateLimitTotal !== null
            ? Math.max(0, rateLimitTotal - rateLimitRemaining)
            : null;
        const percentageUsed =
          rateLimitTotal && rateLimitTotal > 0 && used !== null
            ? Number(((used / rateLimitTotal) * 100).toFixed(2))
            : null;

        return {
          ...this.createBaseResult('healthy', 'credits', responseTimeMs),
          remaining: rateLimitRemaining,
          limit: rateLimitTotal,
          used,
          percentageUsed,
          metadata: {
            type: 'daily_api_quota',
            userEmail: user?.email,
            dailyLimit: rateLimitTotal,
            dailyUsed: used,
            dailyRemaining: rateLimitRemaining,
            hourlyLimit: combinedHeaders['x-rate-limit-hourly']
              ? parseInt(combinedHeaders['x-rate-limit-hourly'], 10)
              : undefined,
            hourlyRemaining: combinedHeaders['x-hourly-requests-left']
              ? parseInt(combinedHeaders['x-hourly-requests-left'], 10)
              : undefined,
            minuteLimit: combinedHeaders['x-rate-limit-minute']
              ? parseInt(combinedHeaders['x-rate-limit-minute'], 10)
              : undefined,
            minuteRemaining: combinedHeaders['x-minute-requests-left']
              ? parseInt(combinedHeaders['x-minute-requests-left'], 10)
              : undefined,
          },
        };
      }

      // Check if usageData is an object map of endpoints with { day: { limit, consumed, left_over } }
      if (usageData && typeof usageData === 'object' && !Array.isArray(usageData)) {
        const entries = Object.values(usageData) as any[];
        const dayStats = entries.find((e) => e && e.day && typeof e.day.limit === 'number')?.day;
        if (dayStats) {
          const totalConsumed = entries.reduce(
            (sum, e) => sum + (typeof e?.day?.consumed === 'number' ? e.day.consumed : 0),
            0
          );
          const limit = dayStats.limit;
          const remaining = Math.max(0, limit - totalConsumed);
          const percentageUsed = limit > 0 ? Number(((totalConsumed / limit) * 100).toFixed(2)) : null;

          return {
            ...this.createBaseResult('healthy', 'credits', responseTimeMs),
            remaining,
            limit,
            used: totalConsumed,
            percentageUsed,
            metadata: {
              type: 'daily_api_quota',
              userEmail: user?.email,
              trackedEndpoints: entries.length,
            },
          };
        }
      }

      // If API key is valid and service is healthy, but credit balance is not exposed via API
      return {
        ...this.createBaseResult('manual', 'manual', responseTimeMs),
        metadata: {
          note: 'Manual monitoring required - Apollo plan does not expose credit balance via REST API',
          userEmail: user?.email,
        },
      };
    } catch (err: any) {
      const formattedError = this.formatError(err);
      return {
        ...this.createBaseResult('down', 'credits', Date.now() - start, formattedError),
        used: null,
        limit: null,
        remaining: null,
      };
    }
  }
}

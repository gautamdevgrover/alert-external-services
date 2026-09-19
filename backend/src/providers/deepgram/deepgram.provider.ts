import axios from 'axios';
import { BaseProvider } from '../base.provider';
import { HealthCheckResult, NormalizedMonitoringResult } from '../../types/monitoring';
import { config } from '../../config';

export class DeepgramProvider extends BaseProvider {
  readonly serviceKey = 'deepgram';
  readonly serviceName = 'Deepgram';

  private apiKey = config.providers.deepgram.apiKey;
  private projectId = config.providers.deepgram.projectId;

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  getRequiredEnvVars(): string[] {
    return ['DEEPGRAM_API_KEY', 'DEEPGRAM_PROJECT_ID'];
  }

  async checkHealth(): Promise<HealthCheckResult> {
    if (!this.isConfigured()) {
      return {
        isHealthy: false,
        responseTimeMs: 0,
        error: {
          code: 'CREDENTIALS_MISSING',
          message: 'Deepgram API key not configured',
        },
      };
    }

    const start = Date.now();
    try {
      const response = await axios.get('https://api.deepgram.com/v1/projects', {
        headers: {
          Authorization: `Token ${this.apiKey}`,
        },
        timeout: config.requestTimeoutMs,
      });

      return {
        isHealthy: response.status >= 200 && response.status < 300,
        responseTimeMs: Date.now() - start,
        statusCode: response.status,
      };
    } catch (err: any) {
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
        ...this.createBaseResult('down', 'balance', 0, {
          code: 'CREDENTIALS_MISSING',
          message: 'DEEPGRAM_API_KEY is missing in environment',
        }),
        remaining: null,
      };
    }

    const start = Date.now();
    try {
      let targetProjectId = this.projectId;

      // If project ID is not explicitly set, fetch the first available project from list
      if (!targetProjectId) {
        const projectsRes = await axios.get('https://api.deepgram.com/v1/projects', {
          headers: {
            Authorization: `Token ${this.apiKey}`,
          },
          timeout: config.requestTimeoutMs,
        });

        const projects = projectsRes.data?.projects || [];
        if (projects.length > 0) {
          targetProjectId = projects[0].project_id;
        }
      }

      if (!targetProjectId) {
        return {
          ...this.createBaseResult('healthy', 'manual', Date.now() - start),
          metadata: {
            note: 'Deepgram API is reachable, but no Project ID found to query balance',
          },
        };
      }

      const balanceRes = await axios.get(
        `https://api.deepgram.com/v1/projects/${targetProjectId}/balances`,
        {
          headers: {
            Authorization: `Token ${this.apiKey}`,
          },
          timeout: config.requestTimeoutMs,
        }
      );

      const responseTimeMs = Date.now() - start;
      const balances = balanceRes.data?.balances || [];
      let totalBalance = 0;
      let currency = 'USD';

      if (balances.length > 0) {
        for (const b of balances) {
          totalBalance += typeof b.amount === 'number' ? b.amount : parseFloat(b.amount || 0);
          if (b.units) currency = b.units;
        }
      }

      return {
        ...this.createBaseResult('healthy', 'balance', responseTimeMs),
        remaining: totalBalance,
        currency,
        metadata: {
          projectId: targetProjectId,
          balanceCount: balances.length,
          balances,
        },
      };
    } catch (err: any) {
      const formattedError = this.formatError(err);
      return {
        ...this.createBaseResult('down', 'balance', Date.now() - start, formattedError),
        remaining: null,
        currency: 'USD',
      };
    }
  }
}

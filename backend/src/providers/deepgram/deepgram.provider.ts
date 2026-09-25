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
    return !!(
      this.apiKey &&
      !this.apiKey.startsWith('your_') &&
      !this.apiKey.includes('example')
    );
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
      // 1. Verify health and list projects
      const projectsRes = await axios.get('https://api.deepgram.com/v1/projects', {
        headers: {
          Authorization: `Token ${this.apiKey}`,
        },
        timeout: config.requestTimeoutMs,
      });

      const responseTimeMs = Date.now() - start;
      const projects = projectsRes.data?.projects || [];
      const targetProjectId = this.projectId || (projects.length > 0 ? projects[0].project_id : null);

      if (!targetProjectId) {
        return {
          ...this.createBaseResult('manual', 'manual', responseTimeMs),
          metadata: {
            note: 'Deepgram API reachable, but no projects found for key',
          },
        };
      }

      // 2. Attempt to fetch balances (prepaid accounts)
      try {
        const balanceRes = await axios.get(
          `https://api.deepgram.com/v1/projects/${targetProjectId}/balances`,
          {
            headers: {
              Authorization: `Token ${this.apiKey}`,
            },
            timeout: config.requestTimeoutMs,
          }
        );

        const balances = balanceRes.data?.balances || [];
        let totalBalance = 0;
        let currency = 'USD';

        if (balances.length > 0) {
          for (const b of balances) {
            totalBalance += typeof b.amount === 'number' ? b.amount : parseFloat(b.amount || 0);
            if (b.units) currency = b.units;
          }

          return {
            ...this.createBaseResult('healthy', 'balance', Date.now() - start),
            remaining: totalBalance,
            currency,
            metadata: {
              projectId: targetProjectId,
              balanceCount: balances.length,
            },
          };
        }
      } catch (balErr) {
        // Balances endpoint can fail if account is pay-as-you-go credit card or invoicing
      }

      // If project exists and API is healthy, but no prepaid balance
      return {
        ...this.createBaseResult('healthy', 'manual', Date.now() - start),
        metadata: {
          projectId: targetProjectId,
          note: 'Deepgram API operational (Pay-as-you-go / Invoiced account)',
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

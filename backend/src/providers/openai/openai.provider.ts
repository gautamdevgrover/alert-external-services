import axios from 'axios';
import { BaseProvider } from '../base.provider';
import { HealthCheckResult, NormalizedMonitoringResult } from '../../types/monitoring';
import { config } from '../../config';

export class OpenAIProvider extends BaseProvider {
  readonly serviceKey = 'openai';
  readonly serviceName = 'OpenAI';

  private apiKey = config.providers.openai.apiKey;
  private organization = config.providers.openai.organization;

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  getRequiredEnvVars(): string[] {
    return ['OPENAI_API_KEY'];
  }

  private getHeaders() {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (this.organization) {
      headers['OpenAI-Organization'] = this.organization;
    }
    return headers;
  }

  async checkHealth(): Promise<HealthCheckResult> {
    if (!this.isConfigured()) {
      return {
        isHealthy: false,
        responseTimeMs: 0,
        error: {
          code: 'CREDENTIALS_MISSING',
          message: 'OpenAI API key not configured',
        },
      };
    }

    const start = Date.now();
    try {
      // /v1/models is free, read-only, and verifies key validity
      const response = await axios.get('https://api.openai.com/v1/models', {
        headers: this.getHeaders(),
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
        ...this.createBaseResult('down', 'spend', 0, {
          code: 'CREDENTIALS_MISSING',
          message: 'OPENAI_API_KEY is missing in environment',
        }),
        currentSpend: null,
      };
    }

    const start = Date.now();
    try {
      // 1. Verify health first with /v1/models
      const healthRes = await axios.get('https://api.openai.com/v1/models', {
        headers: this.getHeaders(),
        timeout: config.requestTimeoutMs,
      });

      const responseTimeMs = Date.now() - start;

      // 2. Attempt to fetch current month costs (OpenAI Admin API)
      const now = new Date();
      const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const startTimeUnix = Math.floor(startOfMonth.getTime() / 1000);
      const endTimeUnix = Math.floor(now.getTime() / 1000);

      try {
        const costRes = await axios.get(
          `https://api.openai.com/v1/organization/costs?start_time=${startTimeUnix}&end_time=${endTimeUnix}&bucket_width=1d`,
          {
            headers: this.getHeaders(),
            timeout: config.requestTimeoutMs,
          }
        );

        let totalSpend = 0;
        const results = costRes.data?.data || [];
        for (const bucket of results) {
          if (Array.isArray(bucket.results)) {
            for (const item of bucket.results) {
              totalSpend += item.amount?.value || 0;
            }
          }
        }

        return {
          ...this.createBaseResult('healthy', 'spend', responseTimeMs),
          currentSpend: Number(totalSpend.toFixed(2)),
          currency: 'USD',
          metadata: {
            organization: this.organization || 'default',
            costBuckets: results.length,
          },
        };
      } catch (costErr: any) {
        // If organization/costs fails (e.g. standard project key instead of admin key)
        return {
          ...this.createBaseResult('healthy', 'usage', responseTimeMs),
          metadata: {
            note: 'OpenAI API operational. Detailed spend tracking requires an Admin API key.',
            modelCount: healthRes.data?.data?.length || 0,
          },
        };
      }
    } catch (err: any) {
      const formattedError = this.formatError(err);
      return {
        ...this.createBaseResult('down', 'spend', Date.now() - start, formattedError),
        currentSpend: null,
      };
    }
  }
}

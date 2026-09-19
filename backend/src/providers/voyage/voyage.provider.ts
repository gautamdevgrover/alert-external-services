import axios from 'axios';
import { BaseProvider } from '../base.provider';
import { HealthCheckResult, NormalizedMonitoringResult } from '../../types/monitoring';
import { config } from '../../config';

export class VoyageAiProvider extends BaseProvider {
  readonly serviceKey = 'voyage';
  readonly serviceName = 'Voyage AI';

  private apiKey = config.providers.voyage.apiKey;

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  getRequiredEnvVars(): string[] {
    return ['VOYAGEAI_API_KEY'];
  }

  async checkHealth(): Promise<HealthCheckResult> {
    if (!this.isConfigured()) {
      return {
        isHealthy: false,
        responseTimeMs: 0,
        error: {
          code: 'CREDENTIALS_MISSING',
          message: 'Voyage AI API key not configured',
        },
      };
    }

    const start = Date.now();
    try {
      const response = await axios.post(
        'https://api.voyageai.com/v1/embeddings',
        {
          input: ['ping'],
          model: 'voyage-3-lite',
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: config.requestTimeoutMs,
        }
      );

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
        ...this.createBaseResult('down', 'manual', 0, {
          code: 'CREDENTIALS_MISSING',
          message: 'VOYAGEAI_API_KEY is missing in environment',
        }),
      };
    }

    const start = Date.now();
    try {
      const response = await axios.post(
        'https://api.voyageai.com/v1/embeddings',
        {
          input: ['ping'],
          model: 'voyage-3-lite',
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: config.requestTimeoutMs,
        }
      );

      const responseTimeMs = Date.now() - start;

      // Voyage AI does not expose credits or remaining balance via public API
      return {
        ...this.createBaseResult('manual', 'manual', responseTimeMs),
        metadata: {
          note: 'Manual monitoring required',
          model: 'voyage-3-lite',
          apiStatus: 'Operational',
          tokensUsedInCheck: response.data?.usage?.total_tokens ?? 1,
        },
      };
    } catch (err: any) {
      const formattedError = this.formatError(err);
      return {
        ...this.createBaseResult('down', 'manual', Date.now() - start, formattedError),
      };
    }
  }
}

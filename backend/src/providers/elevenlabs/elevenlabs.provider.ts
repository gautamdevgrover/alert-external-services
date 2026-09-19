import axios from 'axios';
import { BaseProvider } from '../base.provider';
import { HealthCheckResult, NormalizedMonitoringResult } from '../../types/monitoring';
import { config } from '../../config';

export class ElevenLabsProvider extends BaseProvider {
  readonly serviceKey = 'elevenlabs';
  readonly serviceName = 'ElevenLabs';

  private apiKey = config.providers.elevenlabs.apiKey;
  private apiUrl = config.providers.elevenlabs.apiUrl || 'https://api.elevenlabs.io';

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  getRequiredEnvVars(): string[] {
    return ['ELEVENLABS_API_KEY'];
  }

  async checkHealth(): Promise<HealthCheckResult> {
    if (!this.isConfigured()) {
      return {
        isHealthy: false,
        responseTimeMs: 0,
        error: {
          code: 'CREDENTIALS_MISSING',
          message: 'ElevenLabs API key not configured',
        },
      };
    }

    const start = Date.now();
    try {
      const response = await axios.get(`${this.apiUrl}/v1/user/subscription`, {
        headers: {
          'xi-api-key': this.apiKey,
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
        ...this.createBaseResult('down', 'credits', 0, {
          code: 'CREDENTIALS_MISSING',
          message: 'ELEVENLABS_API_KEY is missing in environment',
        }),
        used: null,
        limit: null,
        remaining: null,
      };
    }

    const start = Date.now();
    try {
      const response = await axios.get(`${this.apiUrl}/v1/user/subscription`, {
        headers: {
          'xi-api-key': this.apiKey,
        },
        timeout: config.requestTimeoutMs,
      });

      const responseTimeMs = Date.now() - start;
      const data = response.data;
      const used = data.character_count ?? 0;
      const limit = data.character_limit ?? 0;
      const remaining = Math.max(0, limit - used);
      const percentageUsed = limit > 0 ? Number(((used / limit) * 100).toFixed(2)) : 0;

      return {
        ...this.createBaseResult('healthy', 'credits', responseTimeMs),
        used,
        limit,
        remaining,
        percentageUsed,
        metadata: {
          tier: data.tier,
          status: data.status,
          resetAt: data.next_character_count_reset_unix
            ? new Date(data.next_character_count_reset_unix * 1000).toISOString()
            : undefined,
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

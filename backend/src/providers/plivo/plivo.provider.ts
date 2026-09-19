import axios from 'axios';
import { BaseProvider } from '../base.provider';
import { HealthCheckResult, NormalizedMonitoringResult } from '../../types/monitoring';
import { config } from '../../config';

export class PlivoProvider extends BaseProvider {
  readonly serviceKey = 'plivo';
  readonly serviceName = 'Plivo';

  private authId = config.providers.plivo.authId;
  private authToken = config.providers.plivo.authToken;

  isConfigured(): boolean {
    return !!(this.authId && this.authToken);
  }

  getRequiredEnvVars(): string[] {
    return ['PLIVO_AUTH_ID', 'PLIVO_AUTH_TOKEN'];
  }

  async checkHealth(): Promise<HealthCheckResult> {
    if (!this.isConfigured()) {
      return {
        isHealthy: false,
        responseTimeMs: 0,
        error: {
          code: 'CREDENTIALS_MISSING',
          message: 'Plivo credentials are not configured in environment',
        },
      };
    }

    const start = Date.now();
    try {
      const response = await axios.get(`https://api.plivo.com/v1/Account/${this.authId}/`, {
        auth: {
          username: this.authId,
          password: this.authToken,
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
          message: 'PLIVO_AUTH_ID and/or PLIVO_AUTH_TOKEN are missing',
        }),
        remaining: null,
      };
    }

    const start = Date.now();
    try {
      const response = await axios.get(`https://api.plivo.com/v1/Account/${this.authId}/`, {
        auth: {
          username: this.authId,
          password: this.authToken,
        },
        timeout: config.requestTimeoutMs,
      });

      const responseTimeMs = Date.now() - start;
      const data = response.data;
      const cashCredits = data.cash_credits !== undefined ? parseFloat(data.cash_credits) : null;

      return {
        ...this.createBaseResult('healthy', 'balance', responseTimeMs),
        remaining: cashCredits,
        currency: 'USD',
        metadata: {
          accountType: data.account_type,
          billingMode: data.billing_mode,
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

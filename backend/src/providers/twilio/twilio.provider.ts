import axios from 'axios';
import { BaseProvider } from '../base.provider';
import { HealthCheckResult, NormalizedMonitoringResult } from '../../types/monitoring';
import { config } from '../../config';

export class TwilioProvider extends BaseProvider {
  readonly serviceKey = 'twilio';
  readonly serviceName = 'Twilio';

  private accountSid = config.providers.twilio.accountSid;
  private authToken = config.providers.twilio.authToken;
  private apiKey = config.providers.twilio.apiKey;
  private apiSecret = config.providers.twilio.apiSecret;

  isConfigured(): boolean {
    return !!(this.accountSid && (this.authToken || (this.apiKey && this.apiSecret)));
  }

  getRequiredEnvVars(): string[] {
    return ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'];
  }

  private getAuthHeader() {
    if (this.apiKey && this.apiSecret) {
      return {
        username: this.apiKey,
        password: this.apiSecret,
      };
    }
    return {
      username: this.accountSid,
      password: this.authToken,
    };
  }

  async checkHealth(): Promise<HealthCheckResult> {
    if (!this.isConfigured()) {
      return {
        isHealthy: false,
        responseTimeMs: 0,
        error: {
          code: 'CREDENTIALS_MISSING',
          message: 'Twilio credentials not configured',
        },
      };
    }

    const start = Date.now();
    try {
      const response = await axios.get(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Balance.json`,
        {
          auth: this.getAuthHeader(),
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
        ...this.createBaseResult('down', 'balance', 0, {
          code: 'CREDENTIALS_MISSING',
          message: 'TWILIO_ACCOUNT_SID and auth credentials are missing',
        }),
        remaining: null,
      };
    }

    const start = Date.now();
    try {
      const response = await axios.get(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Balance.json`,
        {
          auth: this.getAuthHeader(),
          timeout: config.requestTimeoutMs,
        }
      );

      const responseTimeMs = Date.now() - start;
      const data = response.data;
      const balance = data.balance !== undefined ? parseFloat(data.balance) : null;
      const currency = data.currency || 'USD';

      return {
        ...this.createBaseResult('healthy', 'balance', responseTimeMs),
        remaining: balance,
        currency,
        metadata: {
          accountSid: data.account_sid ? `${data.account_sid.substring(0, 4)}...` : undefined,
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

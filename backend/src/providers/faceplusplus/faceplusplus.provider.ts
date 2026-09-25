import axios from 'axios';
import { BaseProvider } from '../base.provider';
import { HealthCheckResult, NormalizedMonitoringResult } from '../../types/monitoring';
import { config } from '../../config';

export class FacePlusPlusProvider extends BaseProvider {
  readonly serviceKey = 'faceplusplus';
  readonly serviceName = 'Face++';

  private apiKey = config.providers.faceplusplus.apiKey;
  private apiSecret = config.providers.faceplusplus.apiSecret;

  isConfigured(): boolean {
    return !!(this.apiKey && this.apiSecret);
  }

  getRequiredEnvVars(): string[] {
    return ['FACEPLUSPLUS_API_KEY', 'FACEPLUSPLUS_API_SECRET'];
  }

  async checkHealth(): Promise<HealthCheckResult> {
    if (!this.isConfigured()) {
      return {
        isHealthy: false,
        responseTimeMs: 0,
        error: {
          code: 'CREDENTIALS_MISSING',
          message: 'Face++ API key and/or secret not configured',
        },
      };
    }

    const start = Date.now();
    try {
      // Faceset getfacesets is a free read-only metadata endpoint to verify API health and credentials
      const params = new URLSearchParams();
      params.append('api_key', this.apiKey);
      params.append('api_secret', this.apiSecret);

      const response = await axios.post(
        'https://api-us.faceplusplus.com/facepp/v3/faceset/getfacesets',
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
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
          message: 'FACEPLUSPLUS_API_KEY and/or FACEPLUSPLUS_API_SECRET are missing',
        }),
      };
    }

    const start = Date.now();
    const endpoints = [
      'https://api-us.faceplusplus.com/facepp/v3/faceset/getfacesets',
      'https://api-cn.faceplusplus.com/facepp/v3/faceset/getfacesets',
    ];

    let lastError: any = null;

    for (const url of endpoints) {
      try {
        const params = new URLSearchParams();
        params.append('api_key', this.apiKey);
        params.append('api_secret', this.apiSecret);

        const response = await axios.post(url, params.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: config.requestTimeoutMs,
        });

        const responseTimeMs = Date.now() - start;

        return {
          ...this.createBaseResult('manual', 'manual', responseTimeMs),
          metadata: {
            note: 'Manual monitoring required',
            region: url.includes('api-cn') ? 'China/International' : 'US',
            apiStatus: 'Operational',
            facesetCount: response.data?.facesets?.length ?? 0,
          },
        };
      } catch (err: any) {
        const errMsg = String(
          err.response?.data?.error_message || err.message || ''
        );
        // If this region recognized the key and reported Insufficient Account Balance, do not overwrite with another region's AUTHENTICATION_ERROR
        if (errMsg.toLowerCase().includes('insufficient') || errMsg.includes('INSUFFICIENT_BALANCE')) {
          return {
            ...this.createBaseResult('critical', 'balance', Date.now() - start, {
              code: 'INSUFFICIENT_BALANCE',
              message: errMsg,
            }),
            remaining: 0,
            currency: 'USD',
            thresholdStatus: 'critical',
            metadata: {
              region: url.includes('api-cn') ? 'China/International' : 'US',
              accountStatus: 'Insufficient Account Balance',
              note: 'Credentials verified, but Face++ account balance is $0.00 (top-up required)',
            },
          };
        }
        if (!lastError) {
          lastError = err;
        }
      }
    }

    const formattedError = this.formatError(lastError);
    return {
      ...this.createBaseResult('down', 'manual', Date.now() - start, formattedError),
    };
  }
}

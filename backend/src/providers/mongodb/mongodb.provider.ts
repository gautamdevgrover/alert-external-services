import axios from 'axios';
import crypto from 'crypto';
import { BaseProvider } from '../base.provider';
import { HealthCheckResult, NormalizedMonitoringResult } from '../../types/monitoring';
import { config } from '../../config';

export class MongoDbAtlasProvider extends BaseProvider {
  readonly serviceKey = 'mongodb';
  readonly serviceName = 'MongoDB Atlas';

  private orgId = config.providers.mongodb.orgId;
  private publicKey = config.providers.mongodb.publicKey;
  private privateKey = config.providers.mongodb.privateKey;

  isConfigured(): boolean {
    return !!(this.orgId && this.publicKey && this.privateKey);
  }

  getRequiredEnvVars(): string[] {
    return ['MONGODB_ATLAS_ORG_ID', 'MONGODB_ATLAS_PUBLIC_KEY', 'MONGODB_ATLAS_PRIVATE_KEY'];
  }

  /**
   * Helper to perform HTTP Digest authenticated request to MongoDB Atlas Admin API
   */
  private async digestRequest(url: string, method: 'GET' | 'POST' = 'GET', data?: any): Promise<any> {
    const parsedUrl = new URL(url);
    const pathAndQuery = parsedUrl.pathname + parsedUrl.search;

    // 1. Initial unauthenticated request to obtain 401 and WWW-Authenticate header
    let initialRes: any;
    try {
      initialRes = await axios({
        method,
        url,
        data,
        timeout: config.requestTimeoutMs,
        validateStatus: () => true, // Don't throw on 401
      });
    } catch (err: any) {
      throw err;
    }

    if (initialRes.status !== 401) {
      return initialRes;
    }

    const authHeader = initialRes.headers['www-authenticate'];
    if (!authHeader || !authHeader.startsWith('Digest ')) {
      throw new Error('Server did not provide Digest authentication challenge');
    }

    // 2. Parse Digest challenge parameters
    const params: Record<string, string> = {};
    const matches = authHeader.replace(/^Digest\s+/, '').match(/([a-zA-Z0-9_-]+)="?([^",]+)"?/g);
    if (matches) {
      for (const m of matches) {
        const parts = m.split('=');
        const k = parts[0].trim();
        const v = parts.slice(1).join('=').replace(/^"|"$/g, '').trim();
        params[k] = v;
      }
    }

    const realm = params.realm || '';
    const nonce = params.nonce || '';
    const qop = params.qop || '';
    const algorithm = (params.algorithm || 'MD5').toUpperCase();
    const nc = '00000001';
    const cnonce = crypto.randomBytes(8).toString('hex');

    // 3. Compute HA1, HA2, and Response digest
    const md5 = (str: string) => crypto.createHash('md5').update(str).digest('hex');

    const ha1 = md5(`${this.publicKey}:${realm}:${this.privateKey}`);
    const ha2 = md5(`${method}:${pathAndQuery}`);

    let responseDigest: string;
    if (qop.includes('auth')) {
      responseDigest = md5(`${ha1}:${nonce}:${nc}:${cnonce}:auth:${ha2}`);
    } else {
      responseDigest = md5(`${ha1}:${nonce}:${ha2}`);
    }

    // 4. Construct Digest Authorization header
    let digestHeader = `Digest username="${this.publicKey}", realm="${realm}", nonce="${nonce}", uri="${pathAndQuery}", response="${responseDigest}", algorithm=${algorithm}`;
    if (qop.includes('auth')) {
      digestHeader += `, qop=auth, nc=${nc}, cnonce="${cnonce}"`;
    }

    // 5. Send authenticated request
    return axios({
      method,
      url,
      headers: {
        Authorization: digestHeader,
        Accept: 'application/vnd.atlas.2023-01-01+json',
      },
      data,
      timeout: config.requestTimeoutMs,
    });
  }

  async checkHealth(): Promise<HealthCheckResult> {
    if (!this.isConfigured()) {
      return {
        isHealthy: false,
        responseTimeMs: 0,
        error: {
          code: 'CREDENTIALS_MISSING',
          message: 'MongoDB Atlas credentials not configured',
        },
      };
    }

    const start = Date.now();
    try {
      const response = await this.digestRequest(
        `https://cloud.mongodb.com/api/atlas/v2/orgs/${this.orgId}`
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
        ...this.createBaseResult('down', 'spend', 0, {
          code: 'CREDENTIALS_MISSING',
          message: 'MONGODB_ATLAS_ORG_ID, PUBLIC_KEY, or PRIVATE_KEY are missing',
        }),
        currentSpend: null,
      };
    }

    const start = Date.now();
    try {
      // 1. Check org health
      const orgRes = await this.digestRequest(
        `https://cloud.mongodb.com/api/atlas/v2/orgs/${this.orgId}`
      );

      let currentSpend = 0;
      let invoiceFound = false;

      // 2. Fetch pending invoice for current month
      try {
        const pendingRes = await this.digestRequest(
          `https://cloud.mongodb.com/api/atlas/v2/orgs/${this.orgId}/invoices/pending`
        );
        if (pendingRes.data && pendingRes.data.amountBilledCents !== undefined) {
          currentSpend = pendingRes.data.amountBilledCents / 100;
          invoiceFound = true;
        }
      } catch (pendingErr) {
        // Some orgs do not support /pending endpoint; fall back to invoices list
        try {
          const invoicesRes = await this.digestRequest(
            `https://cloud.mongodb.com/api/atlas/v2/orgs/${this.orgId}/invoices`
          );
          const invoices = invoicesRes.data?.results || [];
          if (invoices.length > 0) {
            currentSpend = (invoices[0].amountBilledCents || 0) / 100;
            invoiceFound = true;
          }
        } catch (invErr) {
          // Invoices might require billing viewer role
        }
      }

      const responseTimeMs = Date.now() - start;

      return {
        ...this.createBaseResult('healthy', 'spend', responseTimeMs),
        currentSpend: Number(currentSpend.toFixed(2)),
        currency: 'USD',
        metadata: {
          orgName: orgRes.data?.name,
          invoiceTracked: invoiceFound,
        },
      };
    } catch (err: any) {
      const formattedError = this.formatError(err);
      return {
        ...this.createBaseResult('down', 'spend', Date.now() - start, formattedError),
        currentSpend: null,
      };
    }
  }
}

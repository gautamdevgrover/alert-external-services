import { RoomServiceClient } from 'livekit-server-sdk';
import { BaseProvider } from '../base.provider';
import { HealthCheckResult, NormalizedMonitoringResult } from '../../types/monitoring';
import { config } from '../../config';

export class LiveKitProvider extends BaseProvider {
  readonly serviceKey = 'livekit';
  readonly serviceName = 'LiveKit';

  private apiKey = config.providers.livekit.apiKey;
  private apiSecret = config.providers.livekit.apiSecret;
  private url = config.providers.livekit.url;

  isConfigured(): boolean {
    return !!(this.apiKey && this.apiSecret && this.url);
  }

  getRequiredEnvVars(): string[] {
    return ['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'LIVEKIT_URL'];
  }

  private getClient(): RoomServiceClient {
    return new RoomServiceClient(this.url, this.apiKey, this.apiSecret);
  }

  async checkHealth(): Promise<HealthCheckResult> {
    if (!this.isConfigured()) {
      return {
        isHealthy: false,
        responseTimeMs: 0,
        error: {
          code: 'CREDENTIALS_MISSING',
          message: 'LiveKit API key, secret, or URL not configured',
        },
      };
    }

    const start = Date.now();
    try {
      const client = this.getClient();
      const rooms = await client.listRooms();

      return {
        isHealthy: true,
        responseTimeMs: Date.now() - start,
        statusCode: 200,
        details: {
          activeRooms: rooms.length,
        },
      };
    } catch (err: any) {
      return {
        isHealthy: false,
        responseTimeMs: Date.now() - start,
        error: this.formatError(err),
      };
    }
  }

  async getMetrics(): Promise<NormalizedMonitoringResult> {
    if (!this.isConfigured()) {
      return {
        ...this.createBaseResult('down', 'usage', 0, {
          code: 'CREDENTIALS_MISSING',
          message: 'LIVEKIT_API_KEY, LIVEKIT_API_SECRET, or LIVEKIT_URL are missing',
        }),
      };
    }

    const start = Date.now();
    try {
      const client = this.getClient();
      const rooms = await client.listRooms();
      const responseTimeMs = Date.now() - start;

      let totalParticipants = 0;
      for (const room of rooms) {
        totalParticipants += room.numParticipants || 0;
      }

      return {
        ...this.createBaseResult('healthy', 'usage', responseTimeMs),
        used: rooms.length,
        metadata: {
          activeRooms: rooms.length,
          activeParticipants: totalParticipants,
          serverUrl: this.url,
          note: 'LiveKit server operational. Project credit quota monitored in LiveKit Cloud console.',
        },
      };
    } catch (err: any) {
      const formattedError = this.formatError(err);
      return {
        ...this.createBaseResult('down', 'usage', Date.now() - start, formattedError),
      };
    }
  }
}

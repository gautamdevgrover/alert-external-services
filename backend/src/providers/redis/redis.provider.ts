import Redis from 'ioredis';
import { BaseProvider } from '../base.provider';
import { HealthCheckResult, NormalizedMonitoringResult } from '../../types/monitoring';
import { config } from '../../config';

export class RedisProvider extends BaseProvider {
  readonly serviceKey = 'redis';
  readonly serviceName = 'Redis';

  private host = config.providers.redis.host;
  private port = config.providers.redis.port;
  private password = config.providers.redis.password;

  isConfigured(): boolean {
    return !!this.host;
  }

  getRequiredEnvVars(): string[] {
    return ['REDIS_HOST'];
  }

  private createClient(): Redis {
    return new Redis({
      host: this.host,
      port: this.port,
      password: this.password || undefined,
      connectTimeout: config.requestTimeoutMs,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
  }

  private parseInfo(infoStr: string): Record<string, string> {
    const lines = infoStr.split(/\r?\n/);
    const result: Record<string, string> = {};
    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [k, v] = line.split(':');
        if (k && v) {
          result[k.trim()] = v.trim();
        }
      }
    }
    return result;
  }

  async checkHealth(): Promise<HealthCheckResult> {
    if (!this.isConfigured()) {
      return {
        isHealthy: false,
        responseTimeMs: 0,
        error: {
          code: 'CREDENTIALS_MISSING',
          message: 'Redis host not configured',
        },
      };
    }

    const start = Date.now();
    const client = this.createClient();

    try {
      await client.connect();
      const pong = await client.ping();
      await client.quit();

      return {
        isHealthy: pong === 'PONG',
        responseTimeMs: Date.now() - start,
        statusCode: 200,
      };
    } catch (err: any) {
      try {
        client.disconnect();
      } catch (_) {}
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
          message: 'REDIS_HOST is missing in environment',
        }),
      };
    }

    const start = Date.now();
    const client = this.createClient();

    try {
      await client.connect();
      const pong = await client.ping();
      const memoryInfoRaw = await client.info('memory');
      const serverInfoRaw = await client.info('server');
      await client.quit();

      const responseTimeMs = Date.now() - start;
      const mem = this.parseInfo(memoryInfoRaw);
      const srv = this.parseInfo(serverInfoRaw);

      const usedBytes = parseInt(mem.used_memory || '0', 10);
      const maxBytes = parseInt(mem.maxmemory || '0', 10);
      const usedMb = Number((usedBytes / (1024 * 1024)).toFixed(2));
      const maxMb = maxBytes > 0 ? Number((maxBytes / (1024 * 1024)).toFixed(2)) : null;

      let percentageUsed: number | null = null;
      if (maxBytes > 0) {
        percentageUsed = Number(((usedBytes / maxBytes) * 100).toFixed(2));
      }

      return {
        ...this.createBaseResult('healthy', 'usage', responseTimeMs),
        used: usedMb,
        limit: maxMb,
        remaining: maxMb && maxMb > usedMb ? Number((maxMb - usedMb).toFixed(2)) : null,
        percentageUsed,
        metadata: {
          usedMemoryHuman: mem.used_memory_human,
          redisVersion: srv.redis_version,
          connectedClients: mem.connected_clients,
          host: this.host,
          port: this.port,
        },
      };
    } catch (err: any) {
      try {
        client.disconnect();
      } catch (_) {}
      const formattedError = this.formatError(err);
      return {
        ...this.createBaseResult('down', 'usage', Date.now() - start, formattedError),
      };
    }
  }
}

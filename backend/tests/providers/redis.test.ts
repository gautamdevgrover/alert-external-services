import { RedisProvider } from '../../src/providers/redis/redis.provider';

describe('RedisProvider', () => {
  let provider: RedisProvider;

  beforeEach(() => {
    provider = new RedisProvider();
    (provider as any).host = '127.0.0.1';
    (provider as any).port = 6379;
  });

  it('should parse memory usage and limits correctly', async () => {
    const mockMemory = `
# Memory
used_memory:104857600
used_memory_human:100.00M
maxmemory:524288000
connected_clients:5
    `.trim();

    const mockServer = `
# Server
redis_version:7.2.4
    `.trim();

    // Mock client methods
    const mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      ping: jest.fn().mockResolvedValue('PONG'),
      info: jest.fn().mockImplementation((section: string) => {
        if (section === 'memory') return Promise.resolve(mockMemory);
        return Promise.resolve(mockServer);
      }),
      quit: jest.fn().mockResolvedValue('OK'),
      disconnect: jest.fn(),
    };

    jest.spyOn(provider as any, 'createClient').mockReturnValue(mockClient as any);

    const result = await provider.getMetrics();

    expect(result.service).toBe('redis');
    expect(result.status).toBe('healthy');
    expect(result.metricType).toBe('usage');
    expect(result.used).toBe(100); // 100MB
    expect(result.limit).toBe(500); // 500MB
    expect(result.percentageUsed).toBe(20);
    expect(result.remaining).toBe(400);
  });

  it('should return down on connection failure', async () => {
    const mockClient = {
      connect: jest.fn().mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:6379')),
      disconnect: jest.fn(),
    };

    jest.spyOn(provider as any, 'createClient').mockReturnValue(mockClient as any);

    const result = await provider.getMetrics();

    expect(result.status).toBe('down');
    expect(result.error?.message).toContain('ECONNREFUSED');
  });
});

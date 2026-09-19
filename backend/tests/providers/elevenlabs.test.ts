import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { ElevenLabsProvider } from '../../src/providers/elevenlabs/elevenlabs.provider';

describe('ElevenLabsProvider', () => {
  let mockAxios: MockAdapter;
  let provider: ElevenLabsProvider;

  beforeEach(() => {
    mockAxios = new MockAdapter(axios as any);
    provider = new ElevenLabsProvider();
    (provider as any).apiKey = 'xi-mock-api-key';
  });

  afterEach(() => {
    mockAxios.restore();
  });

  it('should parse character count, limit, remaining, and percentage correctly', async () => {
    mockAxios
      .onGet('https://api.elevenlabs.io/v1/user/subscription')
      .reply(200, {
        tier: 'starter',
        character_count: 75000,
        character_limit: 100000,
        status: 'active',
        next_character_count_reset_unix: 1774000000,
      });

    const result = await provider.getMetrics();

    expect(result.service).toBe('elevenlabs');
    expect(result.status).toBe('healthy');
    expect(result.metricType).toBe('credits');
    expect(result.used).toBe(75000);
    expect(result.limit).toBe(100000);
    expect(result.remaining).toBe(25000);
    expect(result.percentageUsed).toBe(75);
    expect(result.metadata?.tier).toBe('starter');
  });

  it('should handle auth failure (401)', async () => {
    mockAxios
      .onGet('https://api.elevenlabs.io/v1/user/subscription')
      .reply(401, { detail: { message: 'Invalid API Key' } });

    const result = await provider.getMetrics();

    expect(result.status).toBe('down');
    expect(result.error?.code).toBe('HTTP_401');
  });
});

import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { OpenAIProvider } from '../../src/providers/openai/openai.provider';

describe('OpenAIProvider', () => {
  let mockAxios: MockAdapter;
  let provider: OpenAIProvider;

  beforeEach(() => {
    mockAxios = new MockAdapter(axios as any);
    provider = new OpenAIProvider();
    (provider as any).apiKey = 'sk-mockkey12345678901234567890';
  });

  afterEach(() => {
    mockAxios.restore();
  });

  it('should parse spend correctly if organization/costs is available', async () => {
    mockAxios.onGet('https://api.openai.com/v1/models').reply(200, { data: [{ id: 'gpt-4o' }] });

    mockAxios
      .onGet(new RegExp('https://api.openai.com/v1/organization/costs.*'))
      .reply(200, {
        data: [
          {
            results: [{ amount: { value: 125.4 } }],
          },
        ],
      });

    const result = await provider.getMetrics();

    expect(result.service).toBe('openai');
    expect(result.status).toBe('healthy');
    expect(result.metricType).toBe('spend');
    expect(result.currentSpend).toBe(125.4);
    expect(result.currency).toBe('USD');
  });

  it('should fallback gracefully to usage/models health check if costs endpoint is not permitted for standard key', async () => {
    mockAxios.onGet('https://api.openai.com/v1/models').reply(200, { data: [{ id: 'gpt-4o' }] });

    mockAxios
      .onGet(new RegExp('https://api.openai.com/v1/organization/costs.*'))
      .reply(403, { error: { message: 'Must be an admin' } });

    const result = await provider.getMetrics();

    expect(result.service).toBe('openai');
    expect(result.status).toBe('healthy');
    expect(result.metricType).toBe('usage');
    expect(result.metadata?.note).toContain('Admin API key');
  });

  it('should return down on auth error', async () => {
    mockAxios.onGet('https://api.openai.com/v1/models').reply(401, { error: { message: 'Incorrect API key' } });

    const result = await provider.getMetrics();

    expect(result.status).toBe('down');
    expect(result.error?.code).toBe('HTTP_401');
  });
});

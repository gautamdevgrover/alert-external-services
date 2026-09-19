import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { ApolloProvider } from '../../src/providers/apollo/apollo.provider';

describe('ApolloProvider', () => {
  let mockAxios: MockAdapter;
  let provider: ApolloProvider;

  beforeEach(() => {
    mockAxios = new MockAdapter(axios as any);
    provider = new ApolloProvider();
    (provider as any).apiKey = 'mock_apollo_api_key';
  });

  afterEach(() => {
    mockAxios.restore();
  });

  it('should parse user profile credits when available', async () => {
    mockAxios
      .onPost('https://api.apollo.io/api/v1/usage_stats/api_usage_stats')
      .reply(200, { api_usage: [] });

    mockAxios
      .onGet('https://api.apollo.io/api/v1/users/api_profile')
      .reply(200, {
        user: {
          email: 'dev@cyberforce.internal',
          credits: 1500,
        },
      });

    const result = await provider.getMetrics();

    expect(result.service).toBe('apollo');
    expect(result.status).toBe('healthy');
    expect(result.metricType).toBe('credits');
    expect(result.remaining).toBe(1500);
  });

  it('should fallback to manual monitoring required when credits are not exposed via API', async () => {
    mockAxios
      .onPost('https://api.apollo.io/api/v1/usage_stats/api_usage_stats')
      .reply(403, { message: 'Master API key required' });

    mockAxios
      .onGet('https://api.apollo.io/api/v1/users/api_profile')
      .reply(200, {
        user: {
          email: 'dev@cyberforce.internal',
        },
      });

    const result = await provider.getMetrics();

    expect(result.status).toBe('manual');
    expect(result.metricType).toBe('manual');
    expect(result.metadata?.note).toContain('Manual monitoring required');
  });

  it('should handle authentication failure', async () => {
    mockAxios
      .onPost('https://api.apollo.io/api/v1/usage_stats/api_usage_stats')
      .reply(401, { error: 'Invalid API key' });

    mockAxios
      .onGet('https://api.apollo.io/api/v1/users/api_profile')
      .reply(401, { error: 'Invalid API key' });

    const result = await provider.getMetrics();

    expect(result.status).toBe('down');
    expect(result.error?.code).toBe('HTTP_401');
  });
});

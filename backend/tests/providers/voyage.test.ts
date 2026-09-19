import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { VoyageAiProvider } from '../../src/providers/voyage/voyage.provider';

describe('VoyageAiProvider', () => {
  let mockAxios: MockAdapter;
  let provider: VoyageAiProvider;

  beforeEach(() => {
    mockAxios = new MockAdapter(axios as any);
    provider = new VoyageAiProvider();
    (provider as any).apiKey = 'mock_voyage_key_123';
  });

  afterEach(() => {
    mockAxios.restore();
  });

  it('should return manual status without inventing balance when API check succeeds', async () => {
    mockAxios
      .onPost('https://api.voyageai.com/v1/embeddings')
      .reply(200, {
        usage: { total_tokens: 1 },
      });

    const result = await provider.getMetrics();

    expect(result.service).toBe('voyage');
    expect(result.status).toBe('manual');
    expect(result.metricType).toBe('manual');
    expect(result.metadata?.note).toBe('Manual monitoring required');
  });

  it('should return down when embeddings endpoint returns 401', async () => {
    mockAxios
      .onPost('https://api.voyageai.com/v1/embeddings')
      .reply(401, { detail: 'Invalid API key' });

    const result = await provider.getMetrics();

    expect(result.status).toBe('down');
    expect(result.error?.code).toBe('HTTP_401');
  });
});

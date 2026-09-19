import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { DeepgramProvider } from '../../src/providers/deepgram/deepgram.provider';

describe('DeepgramProvider', () => {
  let mockAxios: MockAdapter;
  let provider: DeepgramProvider;

  beforeEach(() => {
    mockAxios = new MockAdapter(axios as any);
    provider = new DeepgramProvider();
    (provider as any).apiKey = 'mock_dg_token_123';
    (provider as any).projectId = 'project-abc-123';
  });

  afterEach(() => {
    mockAxios.restore();
  });

  it('should parse balances successfully', async () => {
    mockAxios
      .onGet('https://api.deepgram.com/v1/projects')
      .reply(200, { projects: [{ project_id: 'project-abc-123' }] });

    mockAxios
      .onGet('https://api.deepgram.com/v1/projects/project-abc-123/balances')
      .reply(200, {
        balances: [
          { balance_id: 'bal_1', amount: 150.75, units: 'USD' },
          { balance_id: 'bal_2', amount: 50.0, units: 'USD' },
        ],
      });

    const result = await provider.getMetrics();

    expect(result.service).toBe('deepgram');
    expect(result.status).toBe('healthy');
    expect(result.metricType).toBe('balance');
    expect(result.remaining).toBe(200.75);
    expect(result.currency).toBe('USD');
  });

  it('should handle API auth error', async () => {
    mockAxios
      .onGet('https://api.deepgram.com/v1/projects')
      .reply(401, { err_code: 'INVALID_CREDENTIALS', err_msg: 'Invalid credentials' });

    const result = await provider.getMetrics();

    expect(result.status).toBe('down');
    expect(result.error?.code).toBe('HTTP_401');
  });
});

import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { PlivoProvider } from '../../src/providers/plivo/plivo.provider';

describe('PlivoProvider', () => {
  let mockAxios: MockAdapter;
  let provider: PlivoProvider;

  beforeEach(() => {
    mockAxios = new MockAdapter(axios as any);
    provider = new PlivoProvider();
    // Inject mock credentials
    (provider as any).authId = 'MAMOCKAUTHID12345';
    (provider as any).authToken = 'mock_auth_token_secret';
  });

  afterEach(() => {
    mockAxios.restore();
  });

  it('should return healthy status and parsed cash_credits on successful response', async () => {
    mockAxios
      .onGet('https://api.plivo.com/v1/Account/MAMOCKAUTHID12345/')
      .reply(200, {
        account_type: 'standard',
        auth_id: 'MAMOCKAUTHID12345',
        billing_mode: 'prepaid',
        cash_credits: '25.50',
      });

    const result = await provider.getMetrics();

    expect(result.service).toBe('plivo');
    expect(result.status).toBe('healthy');
    expect(result.metricType).toBe('balance');
    expect(result.remaining).toBe(25.5);
    expect(result.currency).toBe('USD');
    expect(result.error).toBeNull();
  });

  it('should handle authentication failure (401)', async () => {
    mockAxios
      .onGet('https://api.plivo.com/v1/Account/MAMOCKAUTHID12345/')
      .reply(401, { error: 'Invalid auth credentials' });

    const result = await provider.getMetrics();

    expect(result.status).toBe('down');
    expect(result.remaining).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('HTTP_401');
  });

  it('should handle request timeout', async () => {
    mockAxios
      .onGet('https://api.plivo.com/v1/Account/MAMOCKAUTHID12345/')
      .timeout();

    const result = await provider.getMetrics();

    expect(result.status).toBe('down');
    expect(result.error).toBeDefined();
    expect(result.error?.code).toMatch(/ECONNABORTED|TIMEOUT/i);
  });

  it('should return down status if credentials are missing', async () => {
    (provider as any).authId = '';
    (provider as any).authToken = '';

    const result = await provider.getMetrics();

    expect(result.status).toBe('down');
    expect(result.error?.code).toBe('CREDENTIALS_MISSING');
  });
});

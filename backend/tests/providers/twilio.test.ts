import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { TwilioProvider } from '../../src/providers/twilio/twilio.provider';

describe('TwilioProvider', () => {
  let mockAxios: MockAdapter;
  let provider: TwilioProvider;

  beforeEach(() => {
    mockAxios = new MockAdapter(axios as any);
    provider = new TwilioProvider();
    (provider as any).accountSid = 'ACmockaccountsid123';
    (provider as any).authToken = 'mockauthtoken123';
  });

  afterEach(() => {
    mockAxios.restore();
  });

  it('should return balance and currency on successful response', async () => {
    mockAxios
      .onGet('https://api.twilio.com/2010-04-01/Accounts/ACmockaccountsid123/Balance.json')
      .reply(200, {
        account_sid: 'ACmockaccountsid123',
        balance: '45.75',
        currency: 'USD',
      });

    const result = await provider.getMetrics();

    expect(result.service).toBe('twilio');
    expect(result.status).toBe('healthy');
    expect(result.metricType).toBe('balance');
    expect(result.remaining).toBe(45.75);
    expect(result.currency).toBe('USD');
  });

  it('should handle authentication failure (401)', async () => {
    mockAxios
      .onGet('https://api.twilio.com/2010-04-01/Accounts/ACmockaccountsid123/Balance.json')
      .reply(401, { message: 'Authenticate' });

    const result = await provider.getMetrics();

    expect(result.status).toBe('down');
    expect(result.error?.code).toBe('HTTP_401');
  });

  it('should handle rate limit response (429)', async () => {
    mockAxios
      .onGet('https://api.twilio.com/2010-04-01/Accounts/ACmockaccountsid123/Balance.json')
      .reply(429, { message: 'Too Many Requests' });

    const result = await provider.getMetrics();

    expect(result.status).toBe('down');
    expect(result.error?.code).toBe('HTTP_429');
  });
});

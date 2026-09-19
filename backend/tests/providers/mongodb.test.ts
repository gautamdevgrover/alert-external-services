import { MongoDbAtlasProvider } from '../../src/providers/mongodb/mongodb.provider';

describe('MongoDbAtlasProvider', () => {
  let provider: MongoDbAtlasProvider;

  beforeEach(() => {
    provider = new MongoDbAtlasProvider();
    (provider as any).orgId = 'org-mock-123';
    (provider as any).publicKey = 'mock_pub_key';
    (provider as any).privateKey = 'mock_priv_key';
  });

  it('should parse pending invoice spend and org name', async () => {
    // Mock internal digestRequest
    jest.spyOn(provider as any, 'digestRequest').mockImplementation(async (...args: any[]) => {
      const url = args[0] as string;
      if (url.includes('/invoices/pending')) {
        return {
          status: 200,
          data: {
            amountBilledCents: 4500, // $45.00
          },
        };
      }
      return {
        status: 200,
        data: {
          name: 'CyberForce Production Org',
        },
      };
    });

    const result = await provider.getMetrics();

    expect(result.service).toBe('mongodb');
    expect(result.status).toBe('healthy');
    expect(result.metricType).toBe('spend');
    expect(result.currentSpend).toBe(45);
    expect(result.currency).toBe('USD');
  });

  it('should handle missing credentials', async () => {
    (provider as any).orgId = '';
    const result = await provider.getMetrics();

    expect(result.status).toBe('down');
    expect(result.error?.code).toBe('CREDENTIALS_MISSING');
  });
});

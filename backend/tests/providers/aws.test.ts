import { AwsProvider } from '../../src/providers/aws/aws.provider';

jest.mock('@aws-sdk/client-sts', () => {
  return {
    STSClient: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockResolvedValue({
        Arn: 'arn:aws:iam::123456789012:user/cyberforce',
        UserId: 'AIDAMOCK123',
        Account: '123456789012',
      }),
    })),
    GetCallerIdentityCommand: jest.fn(),
  };
});

jest.mock('@aws-sdk/client-cost-explorer', () => {
  return {
    CostExplorerClient: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockImplementation((command) => {
        return Promise.resolve({
          ResultsByTime: [
            {
              Total: {
                UnblendedCost: {
                  Amount: '780.50',
                  Unit: 'USD',
                },
              },
            },
          ],
        });
      }),
    })),
    GetCostAndUsageCommand: jest.fn(),
    GetCostForecastCommand: jest.fn(),
  };
});

jest.mock('@aws-sdk/client-budgets', () => {
  return {
    BudgetsClient: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockResolvedValue({
        Budgets: [
          {
            BudgetLimit: { Amount: '1000' },
          },
        ],
      }),
    })),
    DescribeBudgetsCommand: jest.fn(),
  };
});

describe('AwsProvider', () => {
  let provider: AwsProvider;

  beforeEach(() => {
    provider = new AwsProvider();
    (provider as any).accessKeyId = 'AKIAMOCKACCESSKEYID';
    (provider as any).secretAccessKey = 'mocksecretaccesskey1234567890';
    (provider as any).accountId = '123456789012';
  });

  it('should parse spend, budget, and percentage used correctly', async () => {
    const result = await provider.getMetrics();

    expect(result.service).toBe('aws');
    expect(result.status).toBe('healthy');
    expect(result.metricType).toBe('spend');
    expect(result.currentSpend).toBe(780.5);
    expect(result.budget).toBe(1000);
    expect(result.percentageUsed).toBe(78.05);
  });
});

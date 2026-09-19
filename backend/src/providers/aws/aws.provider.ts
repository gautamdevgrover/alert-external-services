import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  GetCostForecastCommand,
} from '@aws-sdk/client-cost-explorer';
import { BudgetsClient, DescribeBudgetsCommand } from '@aws-sdk/client-budgets';
import { BaseProvider } from '../base.provider';
import { HealthCheckResult, NormalizedMonitoringResult } from '../../types/monitoring';
import { config } from '../../config';

export class AwsProvider extends BaseProvider {
  readonly serviceKey = 'aws';
  readonly serviceName = 'Amazon Web Services';

  private accessKeyId = config.providers.aws.accessKeyId;
  private secretAccessKey = config.providers.aws.secretAccessKey;
  private accountId = config.providers.aws.accountId;
  private region = config.providers.aws.region || 'us-east-1';

  isConfigured(): boolean {
    return !!(this.accessKeyId && this.secretAccessKey);
  }

  getRequiredEnvVars(): string[] {
    return ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];
  }

  private getCredentials() {
    return {
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
    };
  }

  async checkHealth(): Promise<HealthCheckResult> {
    if (!this.isConfigured()) {
      return {
        isHealthy: false,
        responseTimeMs: 0,
        error: {
          code: 'CREDENTIALS_MISSING',
          message: 'AWS access key or secret key not configured',
        },
      };
    }

    const start = Date.now();
    try {
      const sts = new STSClient({
        region: this.region,
        credentials: this.getCredentials(),
      });

      const res = await sts.send(new GetCallerIdentityCommand({}));

      return {
        isHealthy: true,
        responseTimeMs: Date.now() - start,
        statusCode: 200,
        details: {
          arn: res.Arn,
          userId: res.UserId,
          account: res.Account,
        },
      };
    } catch (err: any) {
      return {
        isHealthy: false,
        responseTimeMs: Date.now() - start,
        error: this.formatError(err),
      };
    }
  }

  async getMetrics(): Promise<NormalizedMonitoringResult> {
    if (!this.isConfigured()) {
      return {
        ...this.createBaseResult('down', 'spend', 0, {
          code: 'CREDENTIALS_MISSING',
          message: 'AWS credentials missing in environment',
        }),
        currentSpend: null,
      };
    }

    const start = Date.now();
    try {
      const creds = this.getCredentials();

      // 1. Verify health via STS
      const sts = new STSClient({ region: this.region, credentials: creds });
      const callerIdentity = await sts.send(new GetCallerIdentityCommand({}));
      const effectiveAccountId = this.accountId || callerIdentity.Account;

      // 2. Fetch Cost and Usage for current month
      const now = new Date();
      const firstDayOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
        .toISOString()
        .slice(0, 10);
      
      // End date must be at least tomorrow for AWS CE
      const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
        .toISOString()
        .slice(0, 10);

      const ce = new CostExplorerClient({ region: 'us-east-1', credentials: creds });

      let currentSpend = 0;
      try {
        const costRes = await ce.send(
          new GetCostAndUsageCommand({
            TimePeriod: { Start: firstDayOfMonth, End: tomorrow },
            Granularity: 'MONTHLY',
            Metrics: ['UnblendedCost'],
          })
        );

        if (costRes.ResultsByTime && costRes.ResultsByTime.length > 0) {
          const amountStr = costRes.ResultsByTime[0].Total?.UnblendedCost?.Amount;
          if (amountStr) {
            currentSpend = parseFloat(amountStr);
          }
        }
      } catch (ceErr) {
        // Cost Explorer might require opt-in or specific permissions
      }

      // 3. Attempt to fetch forecast for end of month
      let forecastedSpend: number | null = null;
      try {
        const lastDayOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
          .toISOString()
          .slice(0, 10);

        if (tomorrow < lastDayOfMonth) {
          const forecastRes = await ce.send(
            new GetCostForecastCommand({
              TimePeriod: { Start: tomorrow, End: lastDayOfMonth },
              Metric: 'UNBLENDED_COST',
              Granularity: 'MONTHLY',
            })
          );
          if (forecastRes.Total?.Amount) {
            forecastedSpend = parseFloat(forecastRes.Total.Amount);
          }
        }
      } catch (fErr) {
        // Forecast can be empty if not enough history
      }

      // 4. Attempt to query AWS Budgets
      let budgetAmount: number | null = null;
      if (effectiveAccountId) {
        try {
          const budgets = new BudgetsClient({ region: 'us-east-1', credentials: creds });
          const budgetRes = await budgets.send(
            new DescribeBudgetsCommand({ AccountId: effectiveAccountId })
          );
          if (budgetRes.Budgets && budgetRes.Budgets.length > 0) {
            const firstBudget = budgetRes.Budgets[0];
            if (firstBudget.BudgetLimit?.Amount) {
              budgetAmount = parseFloat(firstBudget.BudgetLimit.Amount);
            }
          }
        } catch (bErr) {
          // Budgets permission not available
        }
      }

      const responseTimeMs = Date.now() - start;
      const percentageUsed =
        budgetAmount && budgetAmount > 0
          ? Number(((currentSpend / budgetAmount) * 100).toFixed(2))
          : null;

      return {
        ...this.createBaseResult('healthy', 'spend', responseTimeMs),
        currentSpend: Number(currentSpend.toFixed(2)),
        forecastedSpend: forecastedSpend ? Number(forecastedSpend.toFixed(2)) : null,
        budget: budgetAmount ? Number(budgetAmount.toFixed(2)) : null,
        percentageUsed,
        currency: 'USD',
        metadata: {
          accountId: effectiveAccountId ? `${effectiveAccountId.substring(0, 4)}...` : undefined,
          region: this.region,
        },
      };
    } catch (err: any) {
      const formattedError = this.formatError(err);
      return {
        ...this.createBaseResult('down', 'spend', Date.now() - start, formattedError),
        currentSpend: null,
      };
    }
  }
}

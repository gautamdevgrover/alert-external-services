import cron from 'node-cron';
import { MonitoringService } from '../services/monitoring.service';
import { config } from '../config';
import { logger } from '../utils/logger';
import { checkDbHealth } from '../db';

export class MonitoringWorker {
  private monitoringService: MonitoringService;
  private isRunning: boolean = false;
  private healthCronTask: cron.ScheduledTask | null = null;
  private snapshotCronTask: cron.ScheduledTask | null = null;

  constructor() {
    this.monitoringService = new MonitoringService();
  }

  async start(): Promise<void> {
    logger.info('Starting CyberForce Monitoring Worker...');

    // Wait for database connection
    let dbConnected = false;
    for (let i = 0; i < 10; i++) {
      dbConnected = await checkDbHealth();
      if (dbConnected) break;
      logger.warn('Waiting for PostgreSQL to be ready...');
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (!dbConnected) {
      logger.error('Could not connect to PostgreSQL. Worker will continue and retry in schedule.');
    }

    // 1. Run an immediate initial monitoring cycle
    logger.info('Executing startup monitoring cycle...');
    try {
      await this.runCycle();
    } catch (err: any) {
      logger.error('Error during startup monitoring cycle', { error: err.message });
    }

    // 2. Schedule regular health checks
    // Default: Every 15 minutes (configurable)
    const minutes = config.monitoringIntervalMinutes;
    const cronSchedule = minutes === 15 ? '*/15 * * * *' : `*/${minutes} * * * *`;

    logger.info(`Scheduling health checks with cron: "${cronSchedule}" (every ${minutes} mins)`);
    this.healthCronTask = cron.schedule(cronSchedule, async () => {
      await this.runCycle();
    });

    // 3. Schedule daily snapshot
    const snapshotCron = config.dailySnapshotCron;
    logger.info(`Scheduling daily snapshots with cron: "${snapshotCron}"`);
    this.snapshotCronTask = cron.schedule(snapshotCron, async () => {
      logger.info('Running scheduled daily snapshots...');
      try {
        await this.monitoringService.createDailySnapshots();
      } catch (err: any) {
        logger.error('Error running daily snapshots', { error: err.message });
      }
    });

    logger.info('CyberForce Monitoring Worker is running and listening for scheduled tasks.');
  }

  private async runCycle(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Monitoring cycle already in progress. Skipping duplicate run.');
      return;
    }

    this.isRunning = true;
    try {
      await this.monitoringService.runFullMonitoringCycle('scheduled');
    } catch (err: any) {
      logger.error('Error executing monitoring cycle', { error: err.message });
    } finally {
      this.isRunning = false;
    }
  }

  stop(): void {
    logger.info('Stopping CyberForce Monitoring Worker...');
    if (this.healthCronTask) this.healthCronTask.stop();
    if (this.snapshotCronTask) this.snapshotCronTask.stop();
  }
}

if (require.main === module) {
  const worker = new MonitoringWorker();
  worker.start().catch((err) => {
    logger.error('Fatal worker startup error', { error: err.message });
    process.exit(1);
  });

  const shutdown = () => {
    logger.info('Gracefully shutting down worker...');
    worker.stop();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

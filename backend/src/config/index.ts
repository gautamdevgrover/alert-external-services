import dotenv from 'dotenv';
import path from 'path';

// Load .env from root or backend
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // Database configuration
  databaseUrl: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'cyberforce_monitoring'}`,
  
  // Monitoring intervals
  monitoringIntervalMinutes: parseInt(process.env.MONITORING_INTERVAL_MINUTES || '15', 10),
  dailySnapshotCron: process.env.DAILY_SNAPSHOT_CRON || '5 0 * * *',
  defaultCooldownMinutes: parseInt(process.env.ALERT_DEFAULT_COOLDOWN_MINUTES || '360', 10),
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '10000', 10),

  // Notification - Email
  email: {
    alertEmail: process.env.ALERT_EMAIL || '',
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
    smtpSecure: process.env.SMTP_SECURE === 'true',
    smtpUser: process.env.SMTP_USER || '',
    smtpPassword: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || 'CyberForce Monitor <alerts@cyberforce.internal>',
  },

  // Notification - Webhook
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL || '',

  // Provider credentials
  providers: {
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      accountId: process.env.AWS_ACCOUNT_ID || '',
      region: process.env.AWS_REGION || 'us-east-1',
    },
    mongodb: {
      orgId: process.env.MONGODB_ATLAS_ORG_ID || '',
      publicKey: process.env.MONGODB_ATLAS_PUBLIC_KEY || '',
      privateKey: process.env.MONGODB_ATLAS_PRIVATE_KEY || '',
    },
    redis: {
      host: process.env.REDIS_HOST || '',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || '',
    },
    livekit: {
      apiKey: process.env.LIVEKIT_API_KEY || '',
      apiSecret: process.env.LIVEKIT_API_SECRET || '',
      url: process.env.LIVEKIT_URL || 'https://livekit.example.com',
    },
    elevenlabs: {
      apiKey: process.env.ELEVENLABS_API_KEY || '',
      apiUrl: process.env.ELEVENLABS_API_URL || 'https://api.elevenlabs.io',
      webhookSecret: process.env.ELEVENLABS_WEBHOOK_SECRET || '',
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      organization: process.env.OPENAI_ORGANIZATION || '',
    },
    voyage: {
      apiKey: process.env.VOYAGEAI_API_KEY || '',
    },
    faceplusplus: {
      apiKey: process.env.FACEPLUSPLUS_API_KEY || '',
      apiSecret: process.env.FACEPLUSPLUS_API_SECRET || '',
    },
    deepgram: {
      apiKey: process.env.DEEPGRAM_API_KEY || '',
      secretKey: process.env.DEEPGRAM_SECRET_KEY || '',
      projectId: process.env.DEEPGRAM_PROJECT_ID || '',
    },
    apollo: {
      apiKey: process.env.APOLLO_API_KEY || '',
    },
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      apiKey: process.env.TWILIO_API_KEY || '',
      apiSecret: process.env.TWILIO_API_SECRET || '',
    },
    plivo: {
      authId: process.env.PLIVO_AUTH_ID || '',
      authToken: process.env.PLIVO_AUTH_TOKEN || '',
    },
  },
};

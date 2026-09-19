import dotenv from 'dotenv';
import path from 'path';

// Load .env from root or backend
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Helper to trim and remove surrounding quotes
export function cleanEnv(val?: string): string {
  if (!val) return '';
  return val.trim().replace(/^["']|["']$/g, '');
}

export function cleanUrl(val?: string): string {
  if (!val) return '';
  return cleanEnv(val).replace(/\/+$/, '');
}

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
      accessKeyId: cleanEnv(process.env.AWS_ACCESS_KEY_ID),
      secretAccessKey: cleanEnv(process.env.AWS_SECRET_ACCESS_KEY),
      accountId: cleanEnv(process.env.AWS_ACCOUNT_ID),
      region: cleanEnv(process.env.AWS_REGION) || 'us-east-1',
    },
    mongodb: {
      orgId: cleanEnv(process.env.MONGODB_ATLAS_ORG_ID),
      publicKey: cleanEnv(process.env.MONGODB_ATLAS_PUBLIC_KEY),
      privateKey: cleanEnv(process.env.MONGODB_ATLAS_PRIVATE_KEY),
    },
    redis: {
      host: cleanEnv(process.env.REDIS_HOST),
      port: parseInt(cleanEnv(process.env.REDIS_PORT) || '6379', 10),
      password: cleanEnv(process.env.REDIS_PASSWORD),
    },
    livekit: {
      apiKey: cleanEnv(process.env.LIVEKIT_API_KEY),
      apiSecret: cleanEnv(process.env.LIVEKIT_API_SECRET),
      url: cleanUrl(process.env.LIVEKIT_URL),
    },
    elevenlabs: {
      apiKey: cleanEnv(process.env.ELEVENLABS_API_KEY),
      apiUrl: cleanUrl(process.env.ELEVENLABS_API_URL) || 'https://api.elevenlabs.io',
      webhookSecret: cleanEnv(process.env.ELEVENLABS_WEBHOOK_SECRET),
    },
    openai: {
      apiKey: cleanEnv(process.env.OPENAI_API_KEY),
      organization: cleanEnv(process.env.OPENAI_ORGANIZATION),
    },
    voyage: {
      apiKey: cleanEnv(process.env.VOYAGEAI_API_KEY),
    },
    faceplusplus: {
      apiKey: cleanEnv(process.env.FACEPLUSPLUS_API_KEY),
      apiSecret: cleanEnv(process.env.FACEPLUSPLUS_API_SECRET),
    },
    deepgram: {
      apiKey: cleanEnv(process.env.DEEPGRAM_API_KEY),
      secretKey: cleanEnv(process.env.DEEPGRAM_SECRET_KEY),
      projectId: cleanEnv(process.env.DEEPGRAM_PROJECT_ID),
    },
    apollo: {
      apiKey: cleanEnv(process.env.APOLLO_API_KEY),
    },
    twilio: {
      accountSid: cleanEnv(process.env.TWILIO_ACCOUNT_SID),
      authToken: cleanEnv(process.env.TWILIO_AUTH_TOKEN),
      apiKey: cleanEnv(process.env.TWILIO_API_KEY),
      apiSecret: cleanEnv(process.env.TWILIO_API_SECRET),
    },
    plivo: {
      authId: cleanEnv(process.env.PLIVO_AUTH_ID),
      authToken: cleanEnv(process.env.PLIVO_AUTH_TOKEN),
    },
  },
};

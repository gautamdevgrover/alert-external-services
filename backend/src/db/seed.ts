import { pool, query } from './index';
import { logger } from '../utils/logger';

export const INITIAL_SERVICES = [
  {
    key: 'plivo',
    name: 'Plivo',
    category: 'Communication',
    description: 'Cloud communication platform for SMS and Voice API',
    website: 'https://plivo.com',
    envVars: ['PLIVO_AUTH_ID', 'PLIVO_AUTH_TOKEN'],
    warningThreshold: 10,
    criticalThreshold: 5,
    unit: 'USD',
    comparison: 'less_than',
  },
  {
    key: 'twilio',
    name: 'Twilio',
    category: 'Communication',
    description: 'Customer engagement and communications APIs (SMS, Voice, Verify)',
    website: 'https://twilio.com',
    envVars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
    warningThreshold: 10,
    criticalThreshold: 5,
    unit: 'USD',
    comparison: 'less_than',
  },
  {
    key: 'elevenlabs',
    name: 'ElevenLabs',
    category: 'AI Voice',
    description: 'Generative AI voice synthesis and text-to-speech API',
    website: 'https://elevenlabs.io',
    envVars: ['ELEVENLABS_API_KEY'],
    warningThreshold: 20, // 20% remaining
    criticalThreshold: 10, // 10% remaining
    unit: '%',
    comparison: 'less_than',
  },
  {
    key: 'apollo',
    name: 'Apollo.io',
    category: 'Data & Enrichment',
    description: 'B2B database, lead intelligence, and sales engagement platform',
    website: 'https://apollo.io',
    envVars: ['APOLLO_API_KEY'],
    warningThreshold: 20, // 20% remaining
    criticalThreshold: 10, // 10% remaining
    unit: '%',
    comparison: 'less_than',
  },
  {
    key: 'deepgram',
    name: 'Deepgram',
    category: 'AI Speech',
    description: 'Automated speech recognition and text-to-speech AI platform',
    website: 'https://deepgram.com',
    envVars: ['DEEPGRAM_API_KEY', 'DEEPGRAM_PROJECT_ID'],
    warningThreshold: 50,
    criticalThreshold: 20,
    unit: 'USD',
    comparison: 'less_than',
  },
  {
    key: 'faceplusplus',
    name: 'Face++',
    category: 'Computer Vision',
    description: 'Face detection, recognition, and computer vision API',
    website: 'https://faceplusplus.com',
    envVars: ['FACEPLUSPLUS_API_KEY', 'FACEPLUSPLUS_API_SECRET'],
    warningThreshold: 80,
    criticalThreshold: 90,
    unit: '%',
    comparison: 'greater_than',
  },
  {
    key: 'openai',
    name: 'OpenAI',
    category: 'LLM & AI',
    description: 'GPT foundation models, embeddings, and reasoning API',
    website: 'https://openai.com',
    envVars: ['OPENAI_API_KEY'],
    warningThreshold: 80,
    criticalThreshold: 90,
    unit: '%',
    comparison: 'greater_than',
  },
  {
    key: 'aws',
    name: 'Amazon Web Services',
    category: 'Cloud Infrastructure',
    description: 'Core cloud hosting, compute, storage, and serverless infrastructure',
    website: 'https://aws.amazon.com',
    envVars: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_ACCOUNT_ID'],
    warningThreshold: 80,
    criticalThreshold: 90,
    unit: '%',
    comparison: 'greater_than',
  },
  {
    key: 'mongodb',
    name: 'MongoDB Atlas',
    category: 'Database',
    description: 'Fully-managed cloud document database',
    website: 'https://mongodb.com/atlas',
    envVars: ['MONGODB_ATLAS_ORG_ID', 'MONGODB_ATLAS_PUBLIC_KEY', 'MONGODB_ATLAS_PRIVATE_KEY'],
    warningThreshold: 80,
    criticalThreshold: 90,
    unit: '%',
    comparison: 'greater_than',
  },
  {
    key: 'livekit',
    name: 'LiveKit',
    category: 'Real-time Audio/Video',
    description: 'WebRTC real-time audio, video, and AI agent streaming stack',
    website: 'https://livekit.io',
    envVars: ['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'LIVEKIT_URL'],
    warningThreshold: 80,
    criticalThreshold: 90,
    unit: '%',
    comparison: 'greater_than',
  },
  {
    key: 'voyage',
    name: 'Voyage AI',
    category: 'Embeddings & Reranking',
    description: 'Specialized domain embedding models and rerankers',
    website: 'https://voyageai.com',
    envVars: ['VOYAGEAI_API_KEY'],
    warningThreshold: 80,
    criticalThreshold: 90,
    unit: '%',
    comparison: 'greater_than',
  },
  {
    key: 'redis',
    name: 'Redis',
    category: 'In-Memory Cache',
    description: 'In-memory data store, cache, and message broker',
    website: 'https://redis.io',
    envVars: ['REDIS_HOST', 'REDIS_PASSWORD'],
    warningThreshold: 80,
    criticalThreshold: 90,
    unit: '%',
    comparison: 'greater_than',
  },
];

export async function seedDatabase() {
  logger.info('Seeding database with initial services and threshold configurations...');

  for (const s of INITIAL_SERVICES) {
    // 1. Upsert service
    await query(
      `INSERT INTO services (key, name, category, description, website, is_enabled)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       ON CONFLICT (key) DO UPDATE
       SET name = EXCLUDED.name,
           category = EXCLUDED.category,
           description = EXCLUDED.description,
           website = EXCLUDED.website,
           updated_at = NOW()`,
      [s.key, s.name, s.category, s.description, s.website]
    );

    // 2. Check configuration status from environment variables
    const isConfigured = s.envVars.every((v) => !!process.env[v]);

    await query(
      `INSERT INTO service_credentials_reference (service_key, env_var_names, is_configured)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [s.key, s.envVars, isConfigured]
    );

    // 3. Upsert threshold config
    await query(
      `INSERT INTO threshold_config (service_key, warning_threshold, critical_threshold, unit, comparison, alert_cooldown_minutes, is_enabled)
       VALUES ($1, $2, $3, $4, $5, 360, TRUE)
       ON CONFLICT (service_key) DO UPDATE
       SET warning_threshold = EXCLUDED.warning_threshold,
           critical_threshold = EXCLUDED.critical_threshold,
           unit = EXCLUDED.unit,
           comparison = EXCLUDED.comparison,
           updated_at = NOW()`,
      [s.key, s.warningThreshold, s.criticalThreshold, s.unit, s.comparison]
    );

    // 4. Initialize alert state if not present
    await query(
      `INSERT INTO alert_state (service_key, current_state, last_state_change_at)
       VALUES ($1, 'HEALTHY', NOW())
       ON CONFLICT (service_key) DO NOTHING`,
      [s.key]
    );
  }

  logger.info('Database seeding completed successfully for all 12 services.');
}

if (require.main === module) {
  seedDatabase()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

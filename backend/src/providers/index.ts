import { BaseProvider } from './base.provider';
import { PlivoProvider } from './plivo/plivo.provider';
import { TwilioProvider } from './twilio/twilio.provider';
import { ElevenLabsProvider } from './elevenlabs/elevenlabs.provider';
import { ApolloProvider } from './apollo/apollo.provider';
import { DeepgramProvider } from './deepgram/deepgram.provider';
import { FacePlusPlusProvider } from './faceplusplus/faceplusplus.provider';
import { OpenAIProvider } from './openai/openai.provider';
import { AwsProvider } from './aws/aws.provider';
import { MongoDbAtlasProvider } from './mongodb/mongodb.provider';
import { LiveKitProvider } from './livekit/livekit.provider';
import { VoyageAiProvider } from './voyage/voyage.provider';
import { RedisProvider } from './redis/redis.provider';

export const providers: Record<string, BaseProvider> = {
  plivo: new PlivoProvider(),
  twilio: new TwilioProvider(),
  elevenlabs: new ElevenLabsProvider(),
  apollo: new ApolloProvider(),
  deepgram: new DeepgramProvider(),
  faceplusplus: new FacePlusPlusProvider(),
  openai: new OpenAIProvider(),
  aws: new AwsProvider(),
  mongodb: new MongoDbAtlasProvider(),
  livekit: new LiveKitProvider(),
  voyage: new VoyageAiProvider(),
  redis: new RedisProvider(),
};

export function getProvider(serviceKey: string): BaseProvider | undefined {
  return providers[serviceKey.toLowerCase()];
}

export function getAllProviders(): BaseProvider[] {
  return Object.values(providers);
}

export {
  BaseProvider,
  PlivoProvider,
  TwilioProvider,
  ElevenLabsProvider,
  ApolloProvider,
  DeepgramProvider,
  FacePlusPlusProvider,
  OpenAIProvider,
  AwsProvider,
  MongoDbAtlasProvider,
  LiveKitProvider,
  VoyageAiProvider,
  RedisProvider,
};

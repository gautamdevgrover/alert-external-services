import { LiveKitProvider } from '../../src/providers/livekit/livekit.provider';

jest.mock('livekit-server-sdk', () => {
  return {
    RoomServiceClient: jest.fn().mockImplementation(() => ({
      listRooms: jest.fn().mockResolvedValue([
        { name: 'room-1', numParticipants: 4 },
        { name: 'room-2', numParticipants: 2 },
      ]),
    })),
  };
});

describe('LiveKitProvider', () => {
  let provider: LiveKitProvider;

  beforeEach(() => {
    provider = new LiveKitProvider();
    (provider as any).apiKey = 'mock_livekit_key';
    (provider as any).apiSecret = 'mock_livekit_secret';
    (provider as any).url = 'https://livekit.cyberforce.internal';
  });

  it('should list rooms and return healthy usage metrics', async () => {
    const result = await provider.getMetrics();

    expect(result.service).toBe('livekit');
    expect(result.status).toBe('healthy');
    expect(result.metricType).toBe('usage');
    expect(result.used).toBe(2);
    expect(result.metadata?.activeRooms).toBe(2);
    expect(result.metadata?.activeParticipants).toBe(6);
  });
});

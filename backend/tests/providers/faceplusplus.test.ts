import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { FacePlusPlusProvider } from '../../src/providers/faceplusplus/faceplusplus.provider';

describe('FacePlusPlusProvider', () => {
  let mockAxios: MockAdapter;
  let provider: FacePlusPlusProvider;

  beforeEach(() => {
    mockAxios = new MockAdapter(axios as any);
    provider = new FacePlusPlusProvider();
    (provider as any).apiKey = 'mock_face_key';
    (provider as any).apiSecret = 'mock_face_secret';
  });

  afterEach(() => {
    mockAxios.restore();
  });

  it('should return manual monitoring status without inventing credits when API is reachable', async () => {
    mockAxios
      .onPost('https://api-us.faceplusplus.com/facepp/v3/faceset/getfacesets')
      .reply(200, {
        facesets: [{ faceset_token: 'fs_1' }],
        time_used: 42,
      });

    const result = await provider.getMetrics();

    expect(result.service).toBe('faceplusplus');
    expect(result.status).toBe('manual');
    expect(result.metricType).toBe('manual');
    expect(result.metadata?.note).toBe('Manual monitoring required');
  });

  it('should return down status when API returns error', async () => {
    mockAxios
      .onPost('https://api-us.faceplusplus.com/facepp/v3/faceset/getfacesets')
      .reply(403, { error_message: 'AUTHENTICATION_ERROR' });

    const result = await provider.getMetrics();

    expect(result.status).toBe('down');
    expect(result.error?.code).toBe('HTTP_403');
  });
});

/* eslint-env jest */
const api = { get: jest.fn(), post: jest.fn() };

jest.mock('../admin-frontend/src/services/api', () => ({ __esModule: true, default: api }));

const services = require('../admin-frontend/src/services/channelAnalytics.ts');

describe('channel analytics frontend service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fetchChannelAnalytics forwards range parameter', async () => {
    const mockResponse = {
      data: {
        data: { totals: { videos: 1, views: 2, subscribers: 3 }, bars: [], range: { key: 'day' }, updatedAt: new Date().toISOString() },
      },
    };
    api.get.mockResolvedValue(mockResponse);

    const payload = await services.fetchChannelAnalytics('day');

    expect(api.get).toHaveBeenCalledWith('/api/channel-analytics/overview', { params: { range: 'day' } });
    expect(payload).toEqual(mockResponse.data.data);
  });

  test('saveChannelAnalyticsConfig trims payload and handles clear flag', async () => {
    const mockConfig = { channelHandle: '@test', hasAuthToken: true };
    api.post.mockResolvedValue({ data: { config: mockConfig } });

    const result = await services.saveChannelAnalyticsConfig({
      channelHandle: '  @test  ',
      claimId: ' 123 ',
      authToken: ' token ',
      clearAuthToken: true,
    });

    expect(api.post).toHaveBeenCalledWith('/config/channel-analytics-config.json', {
      channelHandle: '@test',
      claimId: '123',
      authToken: 'token',
      clearAuthToken: '1',
    });
    expect(result).toBe(mockConfig);
  });
});

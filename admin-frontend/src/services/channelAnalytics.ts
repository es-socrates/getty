import api from './api';

export type ChannelAnalyticsRange = 'day' | 'week' | 'month' | 'halfyear' | 'year';

export interface ChannelAnalyticsTotals {
  videos: number;
  views: number;
  subscribers: number;
}

export interface ChannelAnalyticsBar {
  key: string;
  label: string;
  start: string | null;
  end: string | null;
  videos: number;
  views: number;
}

export interface ChannelAnalyticsOverview {
  totals: ChannelAnalyticsTotals;
  bars: ChannelAnalyticsBar[];
  range: { key: ChannelAnalyticsRange; start: string | null; end: string | null };
  updatedAt: string;
  highlights: ChannelAnalyticsHighlights | null;
}

export interface ChannelAnalyticsHighlightVideo {
  uri: string | null;
  title: string | null;
  views: number | null;
  change: number | null;
  url: string | null;
}

export interface ChannelAnalyticsHighlights {
  channelUri: string | null;
  subs: number | null;
  subsChange: number | null;
  views: number | null;
  viewsChange: number | null;
  topAllTime: ChannelAnalyticsHighlightVideo | null;
  topNew: ChannelAnalyticsHighlightVideo | null;
  topCommented: ChannelAnalyticsHighlightVideo | null;
}

export interface ChannelIdentityPreview {
  claimId: string | null;
  name: string | null;
  title: string | null;
  thumbnailUrl: string | null;
}

export interface ChannelAnalyticsConfigResponse {
  channelHandle: string;
  claimId: string;
  hasAuthToken: boolean;
  authFormEnabled?: boolean;
  envOverrides?: {
    claimId?: boolean;
    authToken?: boolean;
  };
  updatedAt: string | null;
  lastResolvedHandle: string;
  lastResolvedAt: string | null;
  channelIdentity: ChannelIdentityPreview | null;
}

export interface ChannelAnalyticsConfigPayload {
  channelHandle?: string;
  claimId?: string;
  authToken?: string;
  clearAuthToken?: boolean;
}

export async function fetchChannelAnalytics(range: ChannelAnalyticsRange) {
  const response = await api.get('/api/channel-analytics/overview', { params: { range } });
  return response?.data?.data as ChannelAnalyticsOverview;
}

export async function fetchChannelAnalyticsConfig() {
  const response = await api.get('/config/channel-analytics-config.json');
  return response.data as ChannelAnalyticsConfigResponse;
}

export async function saveChannelAnalyticsConfig(payload: ChannelAnalyticsConfigPayload) {
  const response = await api.post('/config/channel-analytics-config.json', {
    channelHandle: payload.channelHandle?.trim() || undefined,
    claimId: payload.claimId?.trim() || undefined,
    authToken: payload.authToken?.trim() || undefined,
    clearAuthToken: payload.clearAuthToken ? '1' : undefined,
  });
  return response?.data?.config as ChannelAnalyticsConfigResponse;
}

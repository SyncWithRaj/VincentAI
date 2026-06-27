const toQuery = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.append(key, String(value));
    }
  });
  return search.toString();
};

const handleResponse = async (response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Request failed');
  }
  return payload;
};

export const fetchInstagramAnalytics = async (params = {}) => {
  const query = toQuery(params);
  const response = await fetch(`/api/analytics/instagram${query ? `?${query}` : ''}`);
  return handleResponse(response);
};

export const fetchYouTubeAnalytics = async (params = {}) => {
  const query = toQuery(params);
  const response = await fetch(`/api/analytics/youtube${query ? `?${query}` : ''}`);
  return handleResponse(response);
};

export const fetchTwitterAnalytics = async (params = {}) => {
  const query = toQuery(params);
  const response = await fetch(`/api/analytics/twitter${query ? `?${query}` : ''}`);
  return handleResponse(response);
};

export const fetchLinkedinAnalytics = async (params = {}) => {
  const query = toQuery(params);
  const response = await fetch(`/api/analytics/linkedin${query ? `?${query}` : ''}`);
  return handleResponse(response);
};

export const fetchAnalyticsDetail = async (params = {}) => {
  const query = toQuery(params);
  const response = await fetch(`/api/analytics/detail${query ? `?${query}` : ''}`);
  return handleResponse(response);
};

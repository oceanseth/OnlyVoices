import { auth } from './firebase';

async function getAuthHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function request(method, path, body = null, options = {}) {
  const headers = options.skipAuth ? {} : await getAuthHeaders();

  if (options.formData) {
    delete headers['Content-Type'];
  }

  const fetchOptions = { method, headers };
  if (body) {
    fetchOptions.body = options.formData ? body : JSON.stringify(body);
  }

  const res = await fetch(`/api${path}`, fetchOptions);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
  upload: (path, formData) => request('POST', path, formData, { formData: true }),

  // Voice endpoints
  trainVoice: (formData) => request('POST', '/voices/train', formData, { formData: true }),
  getVoices: () => request('GET', '/voices'),
  deleteVoice: (voiceId) => request('DELETE', `/voices/${voiceId}`),

  // Content endpoints
  renderContent: (data) => request('POST', '/content/render', data),
  uploadContent: (formData) => request('POST', '/content/upload', formData, { formData: true }),

  // Marketplace endpoints
  getCreators: (params) => request('GET', `/marketplace/creators?${new URLSearchParams(params)}`),
  getCreatorProfile: (creatorId) => request('GET', `/marketplace/creators/${creatorId}`),
  getListings: (params) => request('GET', `/marketplace/listings?${new URLSearchParams(params)}`),
  createListing: (data) => request('POST', '/marketplace/listings', data),
  purchaseListing: (listingId) => request('POST', `/marketplace/listings/${listingId}/purchase`),

  // Payment endpoints
  createConnectAccount: () => request('POST', '/payments/connect-account'),
  getConnectDashboardLink: () => request('GET', '/payments/connect-dashboard'),
  createCheckoutSession: (data) => request('POST', '/payments/checkout', data),
  getEarnings: () => request('GET', '/payments/earnings'),

  // User endpoints
  getProfile: () => request('GET', '/user/profile'),
  updateProfile: (data) => request('PUT', '/user/profile', data),

  // Health check
  test: () => request('GET', '/test', null, { skipAuth: true }),

  // ===== Vapi / Public Call Flow =====
  // Public endpoint (no auth required)
  getCreatorCallConfig: (username) =>
    request(
      'GET',
      `/vapi/public/creator?${new URLSearchParams({ username })}`,
      null,
      { skipAuth: true }
    ),

  startCallSession: (username) =>
    request('POST', '/vapi/call/sessions/start', { username }),

  debitCallSessionMinute: (sessionId) =>
    request('POST', `/vapi/call/sessions/${sessionId}/debitMinute`, {}),

  endCallSession: (sessionId) =>
    request('POST', `/vapi/call/sessions/${sessionId}/end`, {}),
};

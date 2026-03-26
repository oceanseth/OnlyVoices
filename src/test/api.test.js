import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase before importing api
vi.mock('../services/firebase', () => ({
  auth: {
    currentUser: {
      uid: 'test-user',
      getIdToken: vi.fn().mockResolvedValue('mock-token'),
    },
  },
}));

import { api } from '../services/api';

describe('API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('adds auth headers to requests', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    });

    await api.get('/test');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token',
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('throws on non-ok responses', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    });

    await expect(api.get('/protected')).rejects.toThrow('Unauthorized');
  });

  it('sends JSON body on POST', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    await api.post('/content/render', { voiceId: 'v1', text: 'Hello' });

    const [, options] = global.fetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ voiceId: 'v1', text: 'Hello' });
  });

  it('sends FormData without Content-Type header on upload', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ voiceId: 'new-id' }),
    });

    const formData = new FormData();
    formData.append('name', 'Test Voice');

    await api.trainVoice(formData);

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers['Content-Type']).toBeUndefined();
    expect(options.body).toBe(formData);
  });

  it('test endpoint skips auth', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: 'OK' }),
    });

    await api.test();

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('constructs correct URLs for marketplace endpoints', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await api.getCreators({ category: 'audiobook' });
    expect(global.fetch.mock.calls[0][0]).toBe('/api/marketplace/creators?category=audiobook');

    await api.getCreatorProfile('creator123');
    expect(global.fetch.mock.calls[1][0]).toBe('/api/marketplace/creators/creator123');
  });
});

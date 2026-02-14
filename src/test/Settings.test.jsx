import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Settings from '../pages/Settings';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/api', () => ({
  api: {
    createConnectAccount: vi.fn().mockResolvedValue({ url: 'https://stripe.com/onboard' }),
    getConnectDashboardLink: vi.fn().mockResolvedValue({ url: 'https://dashboard.stripe.com' }),
  },
}));

import { useAuth } from '../contexts/AuthContext';

describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderSettings(userData = {}) {
    useAuth.mockReturnValue({
      user: { uid: 'test-uid', email: 'test@test.com' },
      userData,
      loading: false,
      refreshUserData: vi.fn(),
    });
    return render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );
  }

  it('renders settings title', () => {
    renderSettings();
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('shows Profile section', () => {
    renderSettings();
    expect(screen.getByText('Profile')).toBeTruthy();
  });

  it('shows ElevenLabs API section', () => {
    renderSettings();
    expect(screen.getByText('ElevenLabs API')).toBeTruthy();
  });

  it('shows Creator Settings section', () => {
    renderSettings();
    expect(screen.getByText('Creator Settings')).toBeTruthy();
  });

  it('shows Become a Creator button for non-creators', () => {
    renderSettings({ isCreator: false });
    expect(screen.getByText('Become a Creator')).toBeTruthy();
  });

  it('shows Creator Account Active badge for creators', () => {
    renderSettings({ isCreator: true });
    expect(screen.getByText('Creator Account Active')).toBeTruthy();
  });

  it('shows Price per Reading field for creators', () => {
    renderSettings({ isCreator: true });
    expect(screen.getByText('Price per Reading ($)')).toBeTruthy();
  });

  it('shows Stripe section for creators', () => {
    renderSettings({ isCreator: true });
    expect(screen.getByText('Payments (Stripe)')).toBeTruthy();
  });

  it('shows Connect Stripe button when not connected', () => {
    renderSettings({ isCreator: true, stripeConnected: false });
    expect(screen.getByText('Connect Stripe Account')).toBeTruthy();
  });

  it('shows Stripe Connected badge when connected', () => {
    renderSettings({ isCreator: true, stripeConnected: true });
    expect(screen.getByText('Stripe Connected')).toBeTruthy();
  });

  it('shows Save Settings button', () => {
    renderSettings();
    expect(screen.getByText('Save Settings')).toBeTruthy();
  });

  it('shows user email', () => {
    renderSettings();
    expect(screen.getByText('test@test.com')).toBeTruthy();
  });

  it('shows platform fee info', () => {
    renderSettings({ isCreator: true });
    expect(screen.getByText(/You keep 80%, platform fee is 20%/)).toBeTruthy();
  });

  it('pre-fills existing ElevenLabs key', () => {
    renderSettings({ elevenlabsApiKey: 'xi-test-key' });
    const input = document.querySelector('input[type="password"]');
    expect(input.value).toBe('xi-test-key');
  });
});

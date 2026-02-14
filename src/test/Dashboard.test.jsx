import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

import { useAuth } from '../contexts/AuthContext';

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: { uid: 'test-uid', email: 'test@test.com', displayName: 'Test User' },
      userData: { isCreator: false },
      loading: false,
      refreshUserData: vi.fn(),
    });
  });

  function renderDashboard() {
    return render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
  }

  it('shows welcome message with user name', async () => {
    renderDashboard();
    expect(await screen.findByText('Welcome back, Test User')).toBeTruthy();
  });

  it('shows Become a Creator button for non-creators', async () => {
    renderDashboard();
    expect(await screen.findByText('Become a Creator')).toBeTruthy();
  });

  it('does not show Become a Creator for creators', async () => {
    useAuth.mockReturnValue({
      user: { uid: 'test-uid', email: 'test@test.com', displayName: 'Creator User' },
      userData: { isCreator: true },
      loading: false,
      refreshUserData: vi.fn(),
    });
    renderDashboard();
    await screen.findByText('Welcome back, Creator User');
    expect(screen.queryByText('Become a Creator')).toBeFalsy();
  });

  it('shows quick action cards', async () => {
    renderDashboard();
    expect(await screen.findByText('My Voices')).toBeTruthy();
    expect(screen.getByText('Explore')).toBeTruthy();
    expect(screen.getByText('Content Library')).toBeTruthy();
  });

  it('shows getting started section for new users', async () => {
    renderDashboard();
    expect(await screen.findByText('Get Started')).toBeTruthy();
    expect(screen.getByText('Train a Voice')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Upload Content' })).toBeTruthy();
    expect(screen.getByText('Start Earning')).toBeTruthy();
  });

  it('uses email prefix when no display name', async () => {
    useAuth.mockReturnValue({
      user: { uid: 'test-uid', email: 'john@example.com', displayName: null },
      userData: {},
      loading: false,
      refreshUserData: vi.fn(),
    });
    renderDashboard();
    expect(await screen.findByText('Welcome back, john')).toBeTruthy();
  });
});

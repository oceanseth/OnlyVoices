import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

// Mock auth context
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }) => children,
}));

import { useAuth } from '../contexts/AuthContext';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner while auth is loading', () => {
    useAuth.mockReturnValue({ user: null, userData: null, loading: true });
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    expect(document.querySelector('.spinner')).toBeTruthy();
  });

  it('renders landing page when not authenticated', () => {
    useAuth.mockReturnValue({ user: null, userData: null, loading: false });
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toContain('Clone Your Voice.');
  });

  it('redirects to dashboard when authenticated', async () => {
    useAuth.mockReturnValue({
      user: { uid: '123', email: 'test@test.com', displayName: 'Test' },
      userData: {},
      loading: false,
      refreshUserData: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    // Should redirect to dashboard - we see dashboard content
    expect(await screen.findByText(/Welcome back/)).toBeTruthy();
  });
});

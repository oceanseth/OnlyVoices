import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Layout from '../components/layout/Layout';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/firebase', () => ({
  logout: vi.fn().mockResolvedValue(undefined),
}));

import { useAuth } from '../contexts/AuthContext';
import { logout } from '../services/firebase';

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: { uid: 'test-uid', email: 'test@test.com', displayName: 'Test User', photoURL: '' },
      userData: { isCreator: false },
    });
  });

  function renderLayout() {
    return render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<div>Dashboard Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
  }

  it('renders OnlyVoices logo', () => {
    renderLayout();
    expect(screen.getByText('OnlyVoices')).toBeTruthy();
  });

  it('renders navigation links', () => {
    renderLayout();
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Explore')).toBeTruthy();
    expect(screen.getByText('My Voices')).toBeTruthy();
    expect(screen.getByText('Library')).toBeTruthy();
  });

  it('does not show Earnings link for non-creators', () => {
    renderLayout();
    expect(screen.queryByText('Earnings')).toBeFalsy();
  });

  it('shows Earnings link for creators', () => {
    useAuth.mockReturnValue({
      user: { uid: 'test-uid', email: 'test@test.com', displayName: 'Test User', photoURL: '' },
      userData: { isCreator: true },
    });
    renderLayout();
    expect(screen.getByText('Earnings')).toBeTruthy();
  });

  it('shows logout button', () => {
    renderLayout();
    expect(screen.getByText('Logout')).toBeTruthy();
  });

  it('calls logout when button is clicked', async () => {
    renderLayout();
    fireEvent.click(screen.getByText('Logout'));
    expect(logout).toHaveBeenCalledOnce();
  });

  it('renders child routes (Outlet)', () => {
    renderLayout();
    expect(screen.getByText('Dashboard Content')).toBeTruthy();
  });

  it('shows user initial in avatar when no photo', () => {
    renderLayout();
    const avatar = document.querySelector('.avatar');
    expect(avatar.textContent).toBe('T');
  });
});

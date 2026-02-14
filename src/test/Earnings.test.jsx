import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Earnings from '../pages/Earnings';

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
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

import { useAuth } from '../contexts/AuthContext';

describe('Earnings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows become a creator CTA for non-creators', () => {
    useAuth.mockReturnValue({
      user: { uid: 'test-uid' },
      userData: { isCreator: false },
    });
    render(
      <MemoryRouter>
        <Earnings />
      </MemoryRouter>
    );
    expect(screen.getByText('Become a Creator to Start Earning')).toBeTruthy();
  });

  it('shows earnings page for creators', async () => {
    useAuth.mockReturnValue({
      user: { uid: 'test-uid' },
      userData: { isCreator: true },
    });
    render(
      <MemoryRouter>
        <Earnings />
      </MemoryRouter>
    );
    expect(await screen.findByText('Earnings')).toBeTruthy();
  });

  it('shows stat cards for creators', async () => {
    useAuth.mockReturnValue({
      user: { uid: 'test-uid' },
      userData: { isCreator: true },
    });
    render(
      <MemoryRouter>
        <Earnings />
      </MemoryRouter>
    );
    expect(await screen.findByText('Total Earnings')).toBeTruthy();
    expect(screen.getByText('This Month')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.getByText('Total Readings')).toBeTruthy();
  });

  it('shows $0.00 for new creators', async () => {
    useAuth.mockReturnValue({
      user: { uid: 'test-uid' },
      userData: { isCreator: true },
    });
    render(
      <MemoryRouter>
        <Earnings />
      </MemoryRouter>
    );
    const amounts = await screen.findAllByText('$0.00');
    expect(amounts.length).toBeGreaterThan(0);
  });

  it('shows Connect Stripe CTA when not connected', async () => {
    useAuth.mockReturnValue({
      user: { uid: 'test-uid' },
      userData: { isCreator: true, stripeConnected: false },
    });
    render(
      <MemoryRouter>
        <Earnings />
      </MemoryRouter>
    );
    expect(await screen.findByText('Connect Stripe to get paid')).toBeTruthy();
  });

  it('shows Transaction History section', async () => {
    useAuth.mockReturnValue({
      user: { uid: 'test-uid' },
      userData: { isCreator: true },
    });
    render(
      <MemoryRouter>
        <Earnings />
      </MemoryRouter>
    );
    expect(await screen.findByText('Transaction History')).toBeTruthy();
  });

  it('shows empty state for no transactions', async () => {
    useAuth.mockReturnValue({
      user: { uid: 'test-uid' },
      userData: { isCreator: true },
    });
    render(
      <MemoryRouter>
        <Earnings />
      </MemoryRouter>
    );
    expect(await screen.findByText(/No transactions yet/)).toBeTruthy();
  });
});

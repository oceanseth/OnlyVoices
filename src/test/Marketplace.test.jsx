import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Marketplace from '../pages/Marketplace';

vi.mock('../services/firebase', () => ({
  db: {},
}));

const { mockCreators, mockListings } = vi.hoisted(() => {
  const mockCreators = [
    { id: 'c1', displayName: 'John Voice', bio: 'Professional narrator', isCreator: true, pricePerReading: 500, photoURL: '' },
  ];
  const mockListings = [
    { id: 'l1', name: 'Audiobook Narration', description: 'Professional reading', price: 1000, category: 'audiobook', creatorId: 'c1', creatorName: 'John Voice' },
    { id: 'l2', name: 'Custom Message', description: 'Personalized message', price: 500, category: 'message', creatorId: 'c1', creatorName: 'John Voice' },
  ];
  return { mockCreators, mockListings };
});

vi.mock('firebase/firestore', () => {
  const getDocs = vi.fn();
  return {
    collection: vi.fn(),
    getDocs,
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
  };
});

import { getDocs } from 'firebase/firestore';

describe('Marketplace', () => {
  beforeEach(() => {
    getDocs.mockReset();
    // Set up getDocs to return creators first, then listings
    getDocs
      .mockResolvedValueOnce({
        docs: mockCreators.map(c => ({ id: c.id, data: () => c })),
      })
      .mockResolvedValueOnce({
        docs: mockListings.map(l => ({ id: l.id, data: () => l })),
      });
  });

  function renderMarketplace() {
    return render(
      <MemoryRouter>
        <Marketplace />
      </MemoryRouter>
    );
  }

  it('renders the page title', async () => {
    renderMarketplace();
    expect(await screen.findByText('Explore Voices')).toBeTruthy();
  });

  it('shows search bar', async () => {
    renderMarketplace();
    expect(await screen.findByPlaceholderText('Search voices, creators...')).toBeTruthy();
  });

  it('renders category chips', async () => {
    renderMarketplace();
    expect(await screen.findByText('All Voices')).toBeTruthy();
    expect(screen.getByText('Custom Messages')).toBeTruthy();
  });

  it('shows Featured Creators section', async () => {
    renderMarketplace();
    expect(await screen.findByText('Featured Creators')).toBeTruthy();
    const creatorNames = screen.getAllByText('John Voice');
    expect(creatorNames.length).toBeGreaterThan(0);
  });

  it('shows Voice Listings section', async () => {
    renderMarketplace();
    expect(await screen.findByText('Voice Listings')).toBeTruthy();
  });

  it('shows price on listing cards', async () => {
    renderMarketplace();
    expect(await screen.findByText('$10.00')).toBeTruthy();
    expect(screen.getByText('$5.00')).toBeTruthy();
  });

  it('shows Request Reading buttons', async () => {
    renderMarketplace();
    const buttons = await screen.findAllByText('Request Reading');
    expect(buttons.length).toBeGreaterThan(0);
  });
});

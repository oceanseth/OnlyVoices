import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Voices from '../pages/Voices';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/firebase', () => ({
  db: {},
}));

const { mockVoices } = vi.hoisted(() => {
  const mockVoices = [
    { id: 'v1', name: 'My Voice', status: 'ready', method: 'upload', elevenlabsVoiceId: 'el-123456789abc' },
    { id: 'v2', name: 'Training Voice', status: 'training', method: 'record' },
  ];
  return { mockVoices };
});

vi.mock('firebase/firestore', () => {
  const getDocs = vi.fn();
  const getDoc = vi.fn();
  return {
    collection: vi.fn(),
    getDocs,
    getDoc,
    addDoc: vi.fn().mockResolvedValue({ id: 'new-voice-id' }),
    updateDoc: vi.fn().mockResolvedValue(undefined),
    deleteDoc: vi.fn().mockResolvedValue(undefined),
    setDoc: vi.fn().mockResolvedValue(undefined),
    doc: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
  };
});

vi.mock('../services/api', () => ({
  api: {
    trainVoice: vi.fn().mockResolvedValue({ voiceId: 'new-el-id' }),
  },
}));

import { useAuth } from '../contexts/AuthContext';
import { getDocs, getDoc } from 'firebase/firestore';

describe('Voices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: { uid: 'test-uid', email: 'test@test.com', getIdToken: vi.fn().mockResolvedValue('token') },
      userData: {},
    });
    getDocs.mockResolvedValue({
      docs: mockVoices.map(v => ({ id: v.id, data: () => v })),
    });
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ voices: ['v1'] }) });
  });

  function renderVoices() {
    return render(
      <MemoryRouter>
        <Voices />
      </MemoryRouter>
    );
  }

  it('renders page title', async () => {
    renderVoices();
    expect(await screen.findByText('My Voices')).toBeTruthy();
  });

  it('shows Train New Voice button', async () => {
    renderVoices();
    expect(await screen.findByText('+ Train New Voice')).toBeTruthy();
  });

  it('renders voice cards', async () => {
    renderVoices();
    expect(await screen.findByText('My Voice')).toBeTruthy();
    expect(screen.getByText('Training Voice')).toBeTruthy();
  });

  it('shows correct status badges', async () => {
    renderVoices();
    expect(await screen.findByText('Ready')).toBeTruthy();
    expect(screen.getByText('Training...')).toBeTruthy();
  });

  it('shows tabs for All, Ready, and Favorites', async () => {
    renderVoices();
    expect(await screen.findByText(/All Voices \(2\)/)).toBeTruthy();
    expect(screen.getByText(/Ready \(1\)/)).toBeTruthy();
    expect(screen.getByText(/Favorites \(1\)/)).toBeTruthy();
  });

  it('switches tabs when clicked', async () => {
    renderVoices();
    await screen.findByText('My Voice');

    fireEvent.click(screen.getByText(/Ready \(1\)/));
    expect(screen.getByText('My Voice')).toBeTruthy();
  });

  it('opens train modal when button is clicked', async () => {
    renderVoices();
    await screen.findByText('My Voice');
    fireEvent.click(screen.getByText('+ Train New Voice'));
    expect(screen.getByText('Train New Voice')).toBeTruthy();
  });

  it('train modal has Upload, Record, YouTube tabs', async () => {
    renderVoices();
    await screen.findByText('My Voice');
    fireEvent.click(screen.getByText('+ Train New Voice'));
    expect(screen.getByText('Upload')).toBeTruthy();
    expect(screen.getByText('Record')).toBeTruthy();
    expect(screen.getByText('YouTube')).toBeTruthy();
  });

  it('shows voice method info', async () => {
    renderVoices();
    expect(await screen.findByText('Uploaded')).toBeTruthy();
    expect(screen.getByText('Recorded')).toBeTruthy();
  });

  it('shows truncated ElevenLabs ID for ready voices', async () => {
    renderVoices();
    const idEl = await screen.findByText(/el-123456789/);
    expect(idEl.textContent).toContain('el-123456789');
  });
});

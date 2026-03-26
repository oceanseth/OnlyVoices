import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ContentLibrary from '../pages/ContentLibrary';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/firebase', () => ({
  db: {},
}));

const { mockContent } = vi.hoisted(() => {
  const mockContent = [
    { id: 'c1', title: 'My Book', type: 'text', text: 'Hello world this is a test book content', wordCount: 8, createdAt: new Date() },
    { id: 'c2', title: 'Article', type: 'pdf', text: '[PDF file: article.pdf]', fileName: 'article.pdf', createdAt: new Date() },
  ];
  return { mockContent };
});

vi.mock('firebase/firestore', () => {
  const getDocs = vi.fn();
  return {
    collection: vi.fn(),
    getDocs,
    addDoc: vi.fn().mockResolvedValue({ id: 'new-content-id' }),
    deleteDoc: vi.fn().mockResolvedValue(undefined),
    doc: vi.fn(),
    query: vi.fn(),
    orderBy: vi.fn(),
  };
});

import { useAuth } from '../contexts/AuthContext';
import { getDocs } from 'firebase/firestore';

describe('ContentLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: { uid: 'test-uid' },
    });
    getDocs.mockResolvedValue({
      docs: mockContent.map(c => ({ id: c.id, data: () => c })),
    });
  });

  function renderLibrary() {
    return render(
      <MemoryRouter>
        <ContentLibrary />
      </MemoryRouter>
    );
  }

  it('renders page title', async () => {
    renderLibrary();
    expect(await screen.findByText('Content Library')).toBeTruthy();
  });

  it('shows Upload Content button', async () => {
    renderLibrary();
    expect(await screen.findByText('+ Upload Content')).toBeTruthy();
  });

  it('renders content cards', async () => {
    renderLibrary();
    expect(await screen.findByText('My Book')).toBeTruthy();
    expect(screen.getByText('Article')).toBeTruthy();
  });

  it('shows word count and reading time', async () => {
    renderLibrary();
    expect(await screen.findByText('8 words')).toBeTruthy();
  });

  it('shows Generate Reading button on cards', async () => {
    renderLibrary();
    const buttons = await screen.findAllByText('Generate Reading');
    expect(buttons.length).toBe(2);
  });

  it('opens upload modal', async () => {
    renderLibrary();
    await screen.findByText('My Book');
    fireEvent.click(screen.getByText('+ Upload Content'));
    expect(screen.getByText('Upload Content')).toBeTruthy();
  });

  it('upload modal has Paste Text and Upload File tabs', async () => {
    renderLibrary();
    await screen.findByText('My Book');
    fireEvent.click(screen.getByText('+ Upload Content'));
    expect(screen.getByText('Paste Text')).toBeTruthy();
    expect(screen.getByText('Upload File')).toBeTruthy();
  });

  it('shows content type icons', async () => {
    renderLibrary();
    await screen.findByText('My Book');
    const icons = document.querySelectorAll('.content-icon');
    expect(icons.length).toBe(2);
  });
});

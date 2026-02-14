import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Landing from '../pages/Landing';

describe('Landing', () => {
  function renderLanding() {
    return render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    );
  }

  it('renders the hero section with brand name', () => {
    renderLanding();
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toContain('Clone Your Voice.');
    expect(heading.textContent).toContain('Share Your Sound.');
  });

  it('renders the tagline about creator platform', () => {
    renderLanding();
    expect(screen.getByText('The creator platform for voices')).toBeTruthy();
  });

  it('shows Get Started button in header', () => {
    renderLanding();
    expect(screen.getByText('Get Started')).toBeTruthy();
  });

  it('shows Start Creating and Learn More action buttons', () => {
    renderLanding();
    expect(screen.getByText('Start Creating')).toBeTruthy();
    expect(screen.getByText('Learn More')).toBeTruthy();
  });

  it('renders all three How It Works feature cards', () => {
    renderLanding();
    expect(screen.getByText('Clone Your Voice')).toBeTruthy();
    expect(screen.getByText('Set Your Price')).toBeTruthy();
    expect(screen.getByText('Get Paid')).toBeTruthy();
  });

  it('renders For Creators and For Fans sections', () => {
    renderLanding();
    expect(screen.getByText('For Creators')).toBeTruthy();
    expect(screen.getByText('For Fans')).toBeTruthy();
  });

  it('shows login modal when Get Started is clicked', () => {
    renderLanding();
    fireEvent.click(screen.getByText('Get Started'));
    expect(screen.getByText('Welcome to OnlyVoices')).toBeTruthy();
  });

  it('shows login modal when Start Creating is clicked', () => {
    renderLanding();
    fireEvent.click(screen.getByText('Start Creating'));
    expect(screen.getByText('Welcome to OnlyVoices')).toBeTruthy();
  });

  it('renders footer with brand name', () => {
    renderLanding();
    expect(screen.getByText('Clone your voice. Share your sound.')).toBeTruthy();
  });

  it('renders feature numbers 01, 02, 03', () => {
    renderLanding();
    expect(screen.getByText('01')).toBeTruthy();
    expect(screen.getByText('02')).toBeTruthy();
    expect(screen.getByText('03')).toBeTruthy();
  });
});

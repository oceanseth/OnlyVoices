import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginModal from '../components/auth/LoginModal';

vi.mock('../../services/firebase', () => ({
  signInWithGoogle: vi.fn(),
  signInWithGithub: vi.fn(),
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
}));

import { signInWithGoogle, signInWithGithub, signInWithEmail, signUpWithEmail } from '../services/firebase';

describe('LoginModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with welcome text', () => {
    render(<LoginModal onClose={onClose} />);
    expect(screen.getByText('Welcome to OnlyVoices')).toBeTruthy();
    expect(screen.getByText('Sign in to start creating')).toBeTruthy();
  });

  it('shows Google, GitHub, and Email login options', () => {
    render(<LoginModal onClose={onClose} />);
    expect(screen.getByText('Continue with Google')).toBeTruthy();
    expect(screen.getByText('Continue with GitHub')).toBeTruthy();
    expect(screen.getByText('Continue with Email')).toBeTruthy();
  });

  it('calls signInWithGoogle when Google button is clicked', async () => {
    signInWithGoogle.mockResolvedValueOnce({});
    render(<LoginModal onClose={onClose} />);
    fireEvent.click(screen.getByText('Continue with Google'));
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledOnce());
  });

  it('calls signInWithGithub when GitHub button is clicked', async () => {
    signInWithGithub.mockResolvedValueOnce({});
    render(<LoginModal onClose={onClose} />);
    fireEvent.click(screen.getByText('Continue with GitHub'));
    await waitFor(() => expect(signInWithGithub).toHaveBeenCalledOnce());
  });

  it('switches to email form when Email is clicked', () => {
    render(<LoginModal onClose={onClose} />);
    fireEvent.click(screen.getByText('Continue with Email'));
    expect(screen.getByPlaceholderText('you@example.com')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter your password')).toBeTruthy();
  });

  it('switches between sign in and sign up', () => {
    render(<LoginModal onClose={onClose} />);
    fireEvent.click(screen.getByText('Continue with Email'));
    expect(screen.getByText('Sign In')).toBeTruthy();

    fireEvent.click(screen.getByText('Sign up'));
    expect(screen.getByText('Create Account')).toBeTruthy();

    fireEvent.click(screen.getByText('Sign in'));
    expect(screen.getByText('Sign In')).toBeTruthy();
  });

  it('calls onClose when overlay is clicked', () => {
    render(<LoginModal onClose={onClose} />);
    const overlay = document.querySelector('.modal-overlay');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when close button is clicked', () => {
    render(<LoginModal onClose={onClose} />);
    const closeBtn = document.querySelector('.modal-close');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows error message when Google sign-in fails', async () => {
    signInWithGoogle.mockRejectedValueOnce(new Error('Google auth failed'));
    render(<LoginModal onClose={onClose} />);
    fireEvent.click(screen.getByText('Continue with Google'));
    await waitFor(() => expect(screen.getByText('Google auth failed')).toBeTruthy());
  });

  it('has back button to return to social login options', () => {
    render(<LoginModal onClose={onClose} />);
    fireEvent.click(screen.getByText('Continue with Email'));
    fireEvent.click(screen.getByText('Back to all options'));
    expect(screen.getByText('Continue with Google')).toBeTruthy();
  });
});

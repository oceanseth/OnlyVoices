import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginModal from '../components/auth/LoginModal';
import './Landing.css';

export default function Landing() {
  const [showLogin, setShowLogin] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="landing">
      {/* Background effects */}
      <div className="landing-bg">
        <div className="wave" />
        <div className="wave" />
        <div className="wave" />
      </div>

      {/* Header */}
      <header className="landing-header">
        <div className="logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19v3" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <rect x="9" y="2" width="6" height="13" rx="3" />
          </svg>
          <span>OnlyVoices</span>
        </div>
        <button className="btn btn-primary" onClick={() => setShowLogin(true)}>
          Get Started
        </button>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">The creator platform for voices</div>
          <h1>Clone Your Voice.<br />Share Your Sound.</h1>
          <p className="hero-subtitle">
            Create AI-powered voice clones. Sell custom readings, audiobooks,
            and personalized messages. The creator economy, powered by your voice.
          </p>
          <div className="hero-actions">
            <button className="btn btn-gradient btn-lg" onClick={() => setShowLogin(true)}>
              Start Creating
            </button>
            <button className="btn btn-secondary btn-lg" onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}>
              Learn More
            </button>
          </div>
          <div className="hero-stats">
            <div className="stat">
              <span className="stat-value">AI-Powered</span>
              <span className="stat-label">Voice Cloning</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-value">Instant</span>
              <span className="stat-label">Payouts</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-value">Your Voice</span>
              <span className="stat-label">Your Rules</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="features">
        <h2 className="section-title">How It Works</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-number">01</div>
            <h3>Clone Your Voice</h3>
            <p>
              Upload a few minutes of audio or record directly in the browser.
              Our AI creates a high-fidelity clone of your unique voice.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-number">02</div>
            <h3>Set Your Price</h3>
            <p>
              List your voice on the marketplace. Set per-reading prices,
              offer subscriptions, or take custom requests from fans.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-number">03</div>
            <h3>Get Paid</h3>
            <p>
              Fans purchase voice readings of their content. You earn money
              every time someone uses your voice. Powered by Stripe.
            </p>
          </div>
        </div>
      </section>

      {/* For Creators */}
      <section className="creator-section">
        <div className="creator-content">
          <h2>For Creators</h2>
          <ul className="creator-features">
            <li>Train unlimited voice clones</li>
            <li>Set your own prices per reading</li>
            <li>Offer subscriptions for superfans</li>
            <li>Accept custom message requests</li>
            <li>Real-time earnings dashboard</li>
            <li>Instant payouts via Stripe</li>
          </ul>
          <button className="btn btn-gradient" onClick={() => setShowLogin(true)}>
            Become a Creator
          </button>
        </div>
        <div className="creator-content">
          <h2>For Fans</h2>
          <ul className="creator-features">
            <li>Browse voices from real creators</li>
            <li>Get any text read in your favorite voice</li>
            <li>Request custom personalized messages</li>
            <li>Subscribe to creators you love</li>
            <li>Upload books, articles, or custom text</li>
            <li>Download audio in high quality</li>
          </ul>
          <button className="btn btn-primary" onClick={() => setShowLogin(true)}>
            Explore Voices
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19v3" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <rect x="9" y="2" width="6" height="13" rx="3" />
          </svg>
          <span>OnlyVoices</span>
        </div>
        <p className="footer-text">Clone your voice. Share your sound.</p>
      </footer>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}

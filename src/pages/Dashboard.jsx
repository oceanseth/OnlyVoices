import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import './Dashboard.css';

export default function Dashboard() {
  const { user, userData } = useAuth();
  const [voices, setVoices] = useState([]);
  const [recentContent, setRecentContent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const voicesSnap = await getDocs(
          query(collection(db, 'users', user.uid, 'voices'), orderBy('createdAt', 'desc'), limit(4))
        );
        setVoices(voicesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        const contentSnap = await getDocs(
          query(collection(db, 'users', user.uid, 'content'), orderBy('createdAt', 'desc'), limit(4))
        );
        setRecentContent(contentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        // Collections may not exist yet - that's fine
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, [user.uid]);

  const displayName = user.displayName || user.email?.split('@')[0] || 'Creator';

  if (loading) {
    return <div className="loader"><div className="spinner" /></div>;
  }

  return (
    <div className="dashboard">
      {/* Welcome section */}
      <section className="welcome-section">
        <div>
          <h1>Welcome back, {displayName}</h1>
          <p className="welcome-sub">
            {userData?.isCreator
              ? 'Manage your voices and check your earnings.'
              : 'Explore creator voices or start creating your own.'}
          </p>
        </div>
        {!userData?.isCreator && (
          <Link to="/settings" className="btn btn-gradient">
            Become a Creator
          </Link>
        )}
      </section>

      {/* Quick actions */}
      <section className="quick-actions">
        <Link to="/voices" className="action-card">
          <div className="action-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19v3" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <rect x="9" y="2" width="6" height="13" rx="3" />
            </svg>
          </div>
          <h3>My Voices</h3>
          <p>{voices.length} voice{voices.length !== 1 ? 's' : ''} trained</p>
        </Link>

        <Link to="/marketplace" className="action-card">
          <div className="action-icon explore">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <h3>Explore</h3>
          <p>Browse creator voices</p>
        </Link>

        <Link to="/library" className="action-card">
          <div className="action-icon library">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <h3>Content Library</h3>
          <p>{recentContent.length} item{recentContent.length !== 1 ? 's' : ''}</p>
        </Link>

        {userData?.isCreator && (
          <Link to="/earnings" className="action-card">
            <div className="action-icon earnings">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <h3>Earnings</h3>
            <p>View your revenue</p>
          </Link>
        )}
      </section>

      {/* My voices preview */}
      {voices.length > 0 && (
        <section className="dashboard-section">
          <div className="section-header">
            <h2>My Voices</h2>
            <Link to="/voices" className="btn btn-secondary btn-sm">View All</Link>
          </div>
          <div className="voice-preview-grid">
            {voices.map((voice) => (
              <div key={voice.id} className="voice-preview-card">
                <div className="voice-preview-avatar">
                  {voice.status === 'ready' ? '🎤' : '⏳'}
                </div>
                <div className="voice-preview-info">
                  <h4>{voice.name || 'Untitled Voice'}</h4>
                  <span className={`badge badge-${voice.status === 'ready' ? 'success' : 'warning'}`}>
                    {voice.status === 'ready' ? 'Ready' : voice.status === 'training' ? 'Training' : 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state for new users */}
      {voices.length === 0 && (
        <section className="getting-started">
          <h2>Get Started</h2>
          <p>Create your first voice clone to start using OnlyVoices.</p>
          <div className="start-steps">
            <div className="start-step">
              <div className="step-num">1</div>
              <h4>Train a Voice</h4>
              <p>Upload audio or record yourself to create an AI voice clone.</p>
              <Link to="/voices" className="btn btn-primary btn-sm">Create Voice</Link>
            </div>
            <div className="start-step">
              <div className="step-num">2</div>
              <h4>Upload Content</h4>
              <p>Add text, books, or articles to your content library.</p>
              <Link to="/library" className="btn btn-secondary btn-sm">Upload Content</Link>
            </div>
            <div className="start-step">
              <div className="step-num">3</div>
              <h4>Start Earning</h4>
              <p>List your voice on the marketplace and earn from every reading.</p>
              <Link to="/settings" className="btn btn-secondary btn-sm">Set Up Payments</Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

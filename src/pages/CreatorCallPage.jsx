import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import LoginModal from '../components/auth/LoginModal';
import { api } from '../services/api';
import { config } from '../config';

export default function CreatorCallPage() {
  const { username } = useParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [creatorConfig, setCreatorConfig] = useState(null);
  const [error, setError] = useState('');

  const [showLogin, setShowLogin] = useState(false);
  const [pendingStart, setPendingStart] = useState(false);

  const [callError, setCallError] = useState('');
  const [sessionId, setSessionId] = useState(null);

  const vapiRef = useRef(null);
  const timerRef = useRef(null);
  const billingInProgressRef = useRef(false);

  useEffect(() => {
    async function loadCreator() {
      setLoading(true);
      setError('');
      setCreatorConfig(null);

      try {
        const result = await api.getCreatorCallConfig(username);
        setCreatorConfig(result);
      } catch (err) {
        setError(err.message || 'Failed to load creator');
      } finally {
        setLoading(false);
      }
    }

    loadCreator();
  }, [username]);

  useEffect(() => {
    if (pendingStart && user) {
      setPendingStart(false);
      void startCall();
    }
  }, [pendingStart, user]);

  async function ensureVapi() {
    if (vapiRef.current) return;
    if (!config.vapi.publicKey) {
      throw new Error('Vapi is not configured (missing VITE_VAPI_PUBLIC_KEY)');
    }

    const { default: Vapi } = await import('@vapi-ai/web');
    const vapi = new Vapi(config.vapi.publicKey);
    vapiRef.current = vapi;

    vapi.on('call-end', () => {
      void endCall();
    });

    vapi.on('error', (err) => {
      setCallError(err?.message || 'Vapi error');
    });
  }

  async function endCall() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (vapiRef.current) {
      try {
        vapiRef.current.stop();
      } catch (e) {
        // Ignore stop errors.
      }
    }

    const currentSessionId = sessionId;
    setSessionId(null);

    if (!currentSessionId) return;
    try {
      await api.endCallSession(currentSessionId);
    } catch (err) {
      // If ending the session fails, we still clear the UI.
      console.error('Failed to end call session:', err);
    }
  }

  async function debitMinute(sid) {
    const currentSessionId = sid || sessionId;
    if (!currentSessionId) return false;
    if (billingInProgressRef.current) return;

    billingInProgressRef.current = true;
    setCallError('');

    try {
      const result = await api.debitCallSessionMinute(currentSessionId);
      if (!result?.ok) {
        const reason =
          result?.reason === 'insufficient_tokens'
            ? 'Out of credits'
            : (result?.reason || 'Insufficient credits');
        setCallError(reason);
        await endCall();
        return false;
      }
      return true;
    } finally {
      billingInProgressRef.current = false;
    }
  }

  async function startCall() {
    if (!creatorConfig?.defaultVoiceReady) {
      setCallError('Voice not ready yet.');
      return;
    }

    setCallError('');

    try {
      const result = await api.startCallSession(username);
      if (!result?.vapiAssistantId || !result?.sessionId) {
        throw new Error('Failed to start voice session');
      }

      const newSessionId = result.sessionId;
      setSessionId(newSessionId);
      await ensureVapi();

      // Bill the first minute immediately; subsequent debits happen each full minute.
      const ok = await debitMinute(newSessionId);
      if (!ok) return;

      // Start timer for future minute debits.
      timerRef.current = setInterval(() => {
        void debitMinute();
      }, 60_000);

      vapiRef.current.start(result.vapiAssistantId);
    } catch (err) {
      setCallError(err.message || 'Failed to start call');
    }
  }

  async function handleCallClick() {
    setCallError('');
    if (!creatorConfig?.defaultVoiceReady) return;

    if (!user) {
      setPendingStart(true);
      setShowLogin(true);
      return;
    }

    await startCall();
  }

  useEffect(() => {
    return () => {
      // Cleanup on unmount.
      void endCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="creator-call-page">
        <div className="loader">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="creator-call-page">
        <div className="empty-state">
          <h3>Unable to load this profile</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const displayName = creatorConfig?.displayName || username;
  const tokensPerMinute = creatorConfig?.tokensPerMinute ?? 10;

  return (
    <div className="creator-call-page" style={{ maxWidth: 680, margin: '3rem auto', padding: '0 1.5rem' }}>
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>Talk to {displayName}</h1>
        <p className="page-subtitle" style={{ marginTop: 0 }}>
          Cost: <strong>{tokensPerMinute}</strong> tokens per minute
        </p>

        <div style={{ marginTop: '1.25rem' }}>
          <button
            className="btn btn-gradient"
            onClick={handleCallClick}
            disabled={!creatorConfig?.defaultVoiceReady}
          >
            {user ? 'Call' : 'Sign in to Call'}
          </button>

          {!creatorConfig?.defaultVoiceReady && (
            <p style={{ marginTop: '0.75rem', color: 'var(--ov-text-secondary)' }}>
              Default voice is not ready yet.
            </p>
          )}
        </div>

        {callError && (
          <div style={{ marginTop: '1rem', color: 'var(--ov-error)' }}>
            {callError}
          </div>
        )}
      </div>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}


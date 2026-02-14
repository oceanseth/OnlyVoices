import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { api } from '../services/api';
import './Settings.css';

export default function Settings() {
  const { user, userData, refreshUserData } = useAuth();
  const [elevenlabsKey, setElevenlabsKey] = useState(userData?.elevenlabsApiKey || '');
  const [bio, setBio] = useState(userData?.bio || '');
  const [username, setUsername] = useState(userData?.username || '');
  const [pricePerReading, setPricePerReading] = useState(
    userData?.pricePerReading ? (userData.pricePerReading / 100).toFixed(2) : ''
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [connectingStripe, setConnectingStripe] = useState(false);

  async function saveSettings(e) {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage('');

      const updates = {
        elevenlabsApiKey: elevenlabsKey,
        bio,
        username,
        updatedAt: new Date(),
      };

      if (pricePerReading) {
        updates.pricePerReading = Math.round(parseFloat(pricePerReading) * 100);
      }

      await setDoc(doc(db, 'users', user.uid), updates, { merge: true });
      await refreshUserData();
      setMessage('Settings saved successfully.');
    } catch (err) {
      setMessage('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function becomeCreator() {
    try {
      setSaving(true);
      await setDoc(doc(db, 'users', user.uid), {
        isCreator: true,
        displayName: user.displayName || username || user.email?.split('@')[0],
        photoURL: user.photoURL || '',
        updatedAt: new Date(),
      }, { merge: true });
      await refreshUserData();
      setMessage('You are now a creator! Set up Stripe to start earning.');
    } catch (err) {
      setMessage('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function connectStripe() {
    try {
      setConnectingStripe(true);
      const result = await api.createConnectAccount();
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      setMessage('Stripe setup error: ' + err.message);
    } finally {
      setConnectingStripe(false);
    }
  }

  async function openStripeDashboard() {
    try {
      const result = await api.getConnectDashboardLink();
      if (result.url) {
        window.open(result.url, '_blank');
      }
    } catch (err) {
      setMessage('Error: ' + err.message);
    }
  }

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      {message && (
        <div className={`settings-message ${message.startsWith('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      <form onSubmit={saveSettings}>
        {/* Profile */}
        <section className="settings-section">
          <h2>Profile</h2>
          <div className="settings-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="label">Display Name</label>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your display name"
              />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Bio</label>
            <textarea
              className="textarea"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell people about yourself and your voice..."
              rows={3}
            />
          </div>
          <div className="settings-info">
            <span className="label">Email</span>
            <span>{user.email}</span>
          </div>
          <div className="settings-info">
            <span className="label">User ID</span>
            <code>{user.uid}</code>
          </div>
        </section>

        {/* ElevenLabs */}
        <section className="settings-section">
          <h2>ElevenLabs API</h2>
          <p className="section-desc">Your ElevenLabs API key is used for voice cloning and text-to-speech.</p>
          <div className="form-group">
            <label className="label">API Key</label>
            <input
              className="input"
              type="password"
              value={elevenlabsKey}
              onChange={(e) => setElevenlabsKey(e.target.value)}
              placeholder="xi-..."
            />
          </div>
        </section>

        {/* Creator settings */}
        <section className="settings-section">
          <h2>Creator Settings</h2>
          {userData?.isCreator ? (
            <>
              <div className="creator-status">
                <span className="badge badge-success">Creator Account Active</span>
              </div>
              <div className="form-group">
                <label className="label">Price per Reading ($)</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0.50"
                  value={pricePerReading}
                  onChange={(e) => setPricePerReading(e.target.value)}
                  placeholder="5.00"
                />
                <p className="help-text">Minimum reading price. You keep 80%, platform fee is 20%.</p>
              </div>
            </>
          ) : (
            <div className="become-creator">
              <h3>Start Earning with Your Voice</h3>
              <p>Become a creator to list your voices on the marketplace and receive payments from fans.</p>
              <button type="button" className="btn btn-gradient" onClick={becomeCreator} disabled={saving}>
                Become a Creator
              </button>
            </div>
          )}
        </section>

        {/* Stripe */}
        {userData?.isCreator && (
          <section className="settings-section">
            <h2>Payments (Stripe)</h2>
            <p className="section-desc">
              Connect your Stripe account to receive payments from voice readings.
            </p>
            {userData?.stripeConnected ? (
              <div>
                <span className="badge badge-success">Stripe Connected</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={openStripeDashboard} style={{ marginLeft: '1rem' }}>
                  Open Stripe Dashboard
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={connectStripe}
                disabled={connectingStripe}
              >
                {connectingStripe ? 'Connecting...' : 'Connect Stripe Account'}
              </button>
            )}
          </section>
        )}

        <div className="settings-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}

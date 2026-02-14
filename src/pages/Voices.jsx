import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import {
  collection, getDocs, addDoc, doc, getDoc, setDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { api } from '../services/api';
import './Voices.css';

export default function Voices() {
  const { user } = useAuth();
  const [voices, setVoices] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [activeTab, setActiveTab] = useState('custom');
  const [showTrainModal, setShowTrainModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVoices();
  }, [user.uid]);

  async function loadVoices() {
    try {
      const voicesSnap = await getDocs(collection(db, 'users', user.uid, 'voices'));
      setVoices(voicesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      const favDoc = await getDoc(doc(db, 'users', user.uid, 'data', 'favorites'));
      if (favDoc.exists()) {
        setFavorites(favDoc.data().voices || []);
      }
    } catch (err) {
      console.error('Error loading voices:', err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleFavorite(voiceId) {
    const isFav = favorites.includes(voiceId);
    const updated = isFav ? favorites.filter((id) => id !== voiceId) : [...favorites, voiceId];
    setFavorites(updated);
    try {
      await setDoc(doc(db, 'users', user.uid, 'data', 'favorites'), { voices: updated }, { merge: true });
    } catch (err) {
      console.error('Error updating favorites:', err);
      setFavorites(favorites); // revert
    }
  }

  async function deleteVoice(voiceId, voiceName) {
    if (!confirm(`Delete "${voiceName}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'voices', voiceId));
      setVoices((prev) => prev.filter((v) => v.id !== voiceId));
    } catch (err) {
      console.error('Error deleting voice:', err);
      alert('Failed to delete voice: ' + err.message);
    }
  }

  if (loading) {
    return <div className="loader"><div className="spinner" /></div>;
  }

  const readyVoices = voices.filter((v) => v.status === 'ready');
  const favVoices = voices.filter((v) => favorites.includes(v.id));

  return (
    <div className="voices-page">
      <div className="page-header">
        <div>
          <h1>My Voices</h1>
          <p className="page-subtitle">Train and manage your AI voice clones</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowTrainModal(true)}>
          + Train New Voice
        </button>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'custom' ? 'active' : ''}`} onClick={() => setActiveTab('custom')}>
          All Voices ({voices.length})
        </button>
        <button className={`tab ${activeTab === 'ready' ? 'active' : ''}`} onClick={() => setActiveTab('ready')}>
          Ready ({readyVoices.length})
        </button>
        <button className={`tab ${activeTab === 'favorites' ? 'active' : ''}`} onClick={() => setActiveTab('favorites')}>
          Favorites ({favVoices.length})
        </button>
      </div>

      {(() => {
        const displayVoices =
          activeTab === 'ready' ? readyVoices :
          activeTab === 'favorites' ? favVoices :
          voices;

        if (displayVoices.length === 0) {
          return (
            <div className="empty-state">
              <h3>{activeTab === 'favorites' ? 'No favorites yet' : 'No voices yet'}</h3>
              <p>
                {activeTab === 'favorites'
                  ? 'Star any voice to add it to your favorites.'
                  : 'Create your first AI voice clone to get started.'}
              </p>
              {activeTab !== 'favorites' && (
                <button className="btn btn-primary" onClick={() => setShowTrainModal(true)}>
                  Train Your First Voice
                </button>
              )}
            </div>
          );
        }

        return (
          <div className="grid grid-2">
            {displayVoices.map((voice) => (
              <VoiceCard
                key={voice.id}
                voice={voice}
                isFavorite={favorites.includes(voice.id)}
                onToggleFavorite={() => toggleFavorite(voice.id)}
                onDelete={() => deleteVoice(voice.id, voice.name)}
              />
            ))}
          </div>
        );
      })()}

      {showTrainModal && (
        <TrainVoiceModal
          user={user}
          onClose={() => setShowTrainModal(false)}
          onSuccess={() => { setShowTrainModal(false); loadVoices(); }}
        />
      )}
    </div>
  );
}

function VoiceCard({ voice, isFavorite, onToggleFavorite, onDelete }) {
  const statusConfig = {
    ready: { label: 'Ready', badge: 'badge-success' },
    training: { label: 'Training...', badge: 'badge-warning' },
    pending: { label: 'Pending', badge: 'badge-warning' },
    failed: { label: 'Failed', badge: 'badge-error' },
  };
  const status = statusConfig[voice.status] || statusConfig.pending;

  return (
    <div className="card voice-card">
      <div className="voice-card-top">
        <div className="voice-card-icon">
          {voice.status === 'ready' ? '🎤' : '⏳'}
        </div>
        <div className="voice-card-actions">
          <button
            className={`btn-icon fav-btn ${isFavorite ? 'active' : ''}`}
            onClick={onToggleFavorite}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFavorite ? '★' : '☆'}
          </button>
          <button className="btn-icon delete-btn" onClick={onDelete} title="Delete voice">
            ✕
          </button>
        </div>
      </div>
      <h3 className="voice-card-name">{voice.name || 'Untitled Voice'}</h3>
      <span className={`badge ${status.badge}`}>{status.label}</span>
      {voice.elevenlabsVoiceId && (
        <p className="voice-card-id">ID: {voice.elevenlabsVoiceId.slice(0, 12)}...</p>
      )}
      <p className="voice-card-method">
        {voice.method === 'record' ? 'Recorded' : voice.method === 'youtube' ? 'From YouTube' : 'Uploaded'}
      </p>
    </div>
  );
}

function TrainVoiceModal({ user, onClose, onSuccess }) {
  const [trainMethod, setTrainMethod] = useState('upload');
  const [name, setName] = useState('');
  const [files, setFiles] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      setError('Failed to access microphone. Please grant permissions.');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }

  async function handleSubmit() {
    if (!name.trim()) { setError('Please enter a voice name.'); return; }

    const formData = new FormData();
    formData.append('name', name.trim());
    formData.append('method', trainMethod);

    if (trainMethod === 'record') {
      if (!recordedBlob) { setError('Please record audio first.'); return; }
      formData.append('audio', recordedBlob, 'recording.webm');
    } else if (trainMethod === 'upload') {
      if (!files?.length) { setError('Please select audio files.'); return; }
      for (const file of files) {
        formData.append('audio', file);
      }
    } else if (trainMethod === 'youtube') {
      if (!youtubeUrl) { setError('Please enter a YouTube URL.'); return; }
      formData.append('youtubeUrl', youtubeUrl);
    }

    try {
      setSubmitting(true);
      setError('');

      // Create voice doc in Firestore first
      const voiceDoc = await addDoc(collection(db, 'users', user.uid, 'voices'), {
        name: name.trim(),
        status: 'pending',
        createdAt: new Date(),
        method: trainMethod,
      });

      // Call API to train
      const result = await api.trainVoice(formData);

      // Update with ElevenLabs voice ID
      if (result.voiceId) {
        await updateDoc(doc(db, 'users', user.uid, 'voices', voiceDoc.id), {
          elevenlabsVoiceId: result.voiceId,
          status: 'training',
          updatedAt: new Date(),
        });
      }

      onSuccess();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content train-modal">
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h2>Train New Voice</h2>

        {error && <div className="login-error">{error}</div>}

        <div className="tabs" style={{ marginBottom: '1.5rem' }}>
          <button className={`tab ${trainMethod === 'upload' ? 'active' : ''}`} onClick={() => setTrainMethod('upload')}>Upload</button>
          <button className={`tab ${trainMethod === 'record' ? 'active' : ''}`} onClick={() => setTrainMethod('record')}>Record</button>
          <button className={`tab ${trainMethod === 'youtube' ? 'active' : ''}`} onClick={() => setTrainMethod('youtube')}>YouTube</button>
        </div>

        <div className="form-group">
          <label className="label">Voice Name</label>
          <input className="input" placeholder="My Voice Clone" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        {trainMethod === 'upload' && (
          <div className="form-group">
            <label className="label">Audio Files</label>
            <input
              type="file"
              className="input"
              multiple
              accept="audio/*"
              onChange={(e) => setFiles(e.target.files)}
            />
            <p className="help-text">Upload MP3, WAV, or other audio files. Multiple files improve quality.</p>
          </div>
        )}

        {trainMethod === 'record' && (
          <div className="form-group">
            <label className="label">Record Your Voice</label>
            <p className="help-text" style={{ marginBottom: '1rem' }}>
              Read the following sample text clearly at a natural pace:
            </p>
            <div className="sample-text">
              The quick brown fox jumps over the lazy dog. This sample captures the full
              range of your voice. Please read clearly while maintaining your natural rhythm.
              This helps create a more accurate voice model.
            </div>
            <div className="record-controls">
              {!recording ? (
                <button className="btn btn-primary" onClick={startRecording} disabled={submitting}>
                  {recordedBlob ? '🎤 Re-record' : '🎤 Start Recording'}
                </button>
              ) : (
                <button className="btn btn-danger" onClick={stopRecording}>
                  ⏹ Stop Recording
                </button>
              )}
              {recordedBlob && !recording && (
                <span className="badge badge-success">Recording captured</span>
              )}
            </div>
          </div>
        )}

        {trainMethod === 'youtube' && (
          <div className="form-group">
            <label className="label">YouTube URL</label>
            <input
              className="input"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
            />
            <p className="help-text">We'll extract the audio to train your voice.</p>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Training...' : 'Start Training'}
          </button>
        </div>
      </div>
    </div>
  );
}

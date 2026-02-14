import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import './ContentLibrary.css';

const SUPPORTED_FORMATS = ['text/plain', 'application/pdf', 'application/epub+zip'];

export default function ContentLibrary() {
  const { user } = useAuth();
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    loadContent();
  }, [user.uid]);

  async function loadContent() {
    try {
      const snap = await getDocs(
        query(collection(db, 'users', user.uid, 'content'), orderBy('createdAt', 'desc'))
      );
      setContent(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      // Collection may not exist yet
    } finally {
      setLoading(false);
    }
  }

  async function deleteContent(id, name) {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'content', id));
      setContent((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  }

  if (loading) return <div className="loader"><div className="spinner" /></div>;

  return (
    <div className="content-library">
      <div className="page-header">
        <div>
          <h1>Content Library</h1>
          <p className="page-subtitle">Upload text, books, and articles to be read by AI voices</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
          + Upload Content
        </button>
      </div>

      {content.length === 0 ? (
        <div className="empty-state">
          <h3>No content yet</h3>
          <p>Upload text files, paste content, or add PDF/EPUB files to your library.</p>
          <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
            Upload Your First Content
          </button>
        </div>
      ) : (
        <div className="grid grid-3">
          {content.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              onDelete={() => deleteContent(item.id, item.title)}
            />
          ))}
        </div>
      )}

      {showUpload && (
        <UploadModal
          user={user}
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); loadContent(); }}
        />
      )}
    </div>
  );
}

function ContentCard({ item, onDelete }) {
  const typeIcons = {
    text: '📝',
    pdf: '📕',
    epub: '📗',
    article: '📰',
  };

  const wordCount = item.wordCount || (item.text?.split(/\s+/).length) || 0;
  const readingTime = Math.ceil(wordCount / 150); // avg TTS ~150 wpm

  return (
    <div className="card content-card">
      <div className="content-card-top">
        <span className="content-icon">{typeIcons[item.type] || '📄'}</span>
        <button className="btn-icon" onClick={onDelete} title="Delete">✕</button>
      </div>
      <h3 className="content-title">{item.title || 'Untitled'}</h3>
      {item.author && <p className="content-author">by {item.author}</p>}
      <p className="content-preview">
        {item.text?.slice(0, 120)}
        {item.text?.length > 120 ? '...' : ''}
      </p>
      <div className="content-meta">
        <span>{wordCount.toLocaleString()} words</span>
        <span>~{readingTime} min reading</span>
      </div>
      <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.75rem' }}>
        Generate Reading
      </button>
    </div>
  );
}

function UploadModal({ user, onClose, onSuccess }) {
  const [method, setMethod] = useState('paste');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!title.trim()) { setError('Please enter a title.'); return; }

    try {
      setSubmitting(true);
      setError('');

      let contentData = {
        title: title.trim(),
        createdAt: new Date(),
        userId: user.uid,
      };

      if (method === 'paste') {
        if (!text.trim()) { setError('Please enter some text.'); return; }
        contentData.text = text.trim();
        contentData.type = 'text';
        contentData.wordCount = text.trim().split(/\s+/).length;
      } else if (method === 'file') {
        if (!file) { setError('Please select a file.'); return; }
        // For now, read text files client-side
        if (file.type === 'text/plain') {
          const fileText = await file.text();
          contentData.text = fileText;
          contentData.type = 'text';
          contentData.wordCount = fileText.split(/\s+/).length;
        } else {
          contentData.type = file.type.includes('pdf') ? 'pdf' : 'epub';
          contentData.fileName = file.name;
          contentData.fileSize = file.size;
          // File upload to storage would happen via API
          // For now, store metadata only
          contentData.text = `[${contentData.type.toUpperCase()} file: ${file.name}]`;
        }
      }

      await addDoc(collection(db, 'users', user.uid, 'content'), contentData);
      onSuccess();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content upload-modal">
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h2>Upload Content</h2>

        {error && <div className="login-error">{error}</div>}

        <div className="tabs" style={{ marginBottom: '1.5rem' }}>
          <button className={`tab ${method === 'paste' ? 'active' : ''}`} onClick={() => setMethod('paste')}>
            Paste Text
          </button>
          <button className={`tab ${method === 'file' ? 'active' : ''}`} onClick={() => setMethod('file')}>
            Upload File
          </button>
        </div>

        <div className="form-group">
          <label className="label">Title</label>
          <input className="input" placeholder="My Book Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        {method === 'paste' ? (
          <div className="form-group">
            <label className="label">Content</label>
            <textarea
              className="textarea"
              placeholder="Paste your text here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
            />
            <p className="help-text">{text.split(/\s+/).filter(Boolean).length} words</p>
          </div>
        ) : (
          <div className="form-group">
            <label className="label">File</label>
            <input
              type="file"
              className="input"
              accept=".txt,.pdf,.epub"
              onChange={(e) => setFile(e.target.files[0])}
            />
            <p className="help-text">Supported: TXT, PDF, EPUB</p>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Uploading...' : 'Add to Library'}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../services/firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import './Marketplace.css';

const CATEGORIES = [
  { id: 'all', label: 'All Voices' },
  { id: 'audiobook', label: 'Audiobook Narration' },
  { id: 'message', label: 'Custom Messages' },
  { id: 'character', label: 'Character Voices' },
  { id: 'podcast', label: 'Podcast Style' },
  { id: 'asmr', label: 'ASMR & Relaxation' },
];

export default function Marketplace() {
  const [creators, setCreators] = useState([]);
  const [listings, setListings] = useState([]);
  const [category, setCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMarketplace();
  }, []);

  async function loadMarketplace() {
    try {
      // Load public creator profiles
      const creatorsSnap = await getDocs(
        query(
          collection(db, 'users'),
          where('isCreator', '==', true),
          limit(50)
        )
      );
      setCreators(
        creatorsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      );

      // Load public voice listings
      const listingsSnap = await getDocs(
        query(collection(db, 'listings'), orderBy('createdAt', 'desc'), limit(50))
      );
      setListings(
        listingsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      );
    } catch (err) {
      // Collections may not exist yet
      console.error('Error loading marketplace:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredListings = listings.filter((listing) => {
    const matchesCategory = category === 'all' || listing.category === category;
    const matchesSearch = !searchQuery ||
      listing.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      listing.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const filteredCreators = creators.filter((creator) => {
    if (!searchQuery) return true;
    return (
      creator.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      creator.bio?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  if (loading) {
    return <div className="loader"><div className="spinner" /></div>;
  }

  return (
    <div className="marketplace">
      <div className="page-header">
        <div>
          <h1>Explore Voices</h1>
          <p className="page-subtitle">Discover creator voices for readings, audiobooks, and custom messages</p>
        </div>
      </div>

      {/* Search */}
      <div className="search-bar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          className="search-input"
          placeholder="Search voices, creators..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Categories */}
      <div className="categories">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`category-chip ${category === cat.id ? 'active' : ''}`}
            onClick={() => setCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Featured Creators */}
      {filteredCreators.length > 0 && (
        <section className="marketplace-section">
          <h2>Featured Creators</h2>
          <div className="creators-scroll">
            {filteredCreators.map((creator) => (
              <Link key={creator.id} to={`/creator/${creator.id}`} className="creator-card card card-interactive">
                <div className="creator-avatar avatar avatar-lg">
                  {creator.photoURL ? (
                    <img src={creator.photoURL} alt={creator.displayName} />
                  ) : (
                    (creator.displayName || 'C').charAt(0).toUpperCase()
                  )}
                </div>
                <h3 className="creator-name">{creator.displayName || 'Creator'}</h3>
                <p className="creator-bio">{creator.bio || 'Voice creator on OnlyVoices'}</p>
                {creator.pricePerReading && (
                  <span className="price">From ${(creator.pricePerReading / 100).toFixed(2)}</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Voice Listings */}
      <section className="marketplace-section">
        <h2>Voice Listings</h2>
        {filteredListings.length === 0 ? (
          <div className="empty-state">
            <h3>No listings yet</h3>
            <p>Be the first to list your voice on the marketplace!</p>
            <Link to="/voices" className="btn btn-primary">Create a Voice</Link>
          </div>
        ) : (
          <div className="grid grid-3">
            {filteredListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>

      {/* CTA for empty marketplace */}
      {creators.length === 0 && listings.length === 0 && (
        <div className="marketplace-cta">
          <h2>The marketplace is just getting started</h2>
          <p>Be among the first creators to list your voice and start earning.</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link to="/voices" className="btn btn-gradient">Train a Voice</Link>
            <Link to="/settings" className="btn btn-secondary">Set Up Payments</Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ListingCard({ listing }) {
  return (
    <div className="card card-interactive listing-card">
      <div className="listing-header">
        <div className="listing-avatar avatar">
          {listing.creatorPhoto ? (
            <img src={listing.creatorPhoto} alt="" />
          ) : '🎤'}
        </div>
        <div>
          <h3 className="listing-name">{listing.name}</h3>
          <Link to={`/creator/${listing.creatorId}`} className="listing-creator">
            {listing.creatorName || 'Creator'}
          </Link>
        </div>
      </div>
      <p className="listing-desc">{listing.description || 'Professional voice reading'}</p>
      {listing.category && (
        <span className="badge badge-primary">{listing.category}</span>
      )}
      <div className="listing-footer">
        <span className="price price-lg">${((listing.price || 0) / 100).toFixed(2)}</span>
        <span className="listing-unit">per reading</span>
      </div>
      <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.75rem' }}>
        Request Reading
      </button>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../services/firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import './CreatorProfilePage.css';

export default function CreatorProfilePage() {
  const { creatorId } = useParams();
  const { user } = useAuth();
  const [creator, setCreator] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCreator() {
      try {
        const creatorDoc = await getDoc(doc(db, 'users', creatorId));
        if (creatorDoc.exists()) {
          setCreator({ id: creatorDoc.id, ...creatorDoc.data() });
        }

        const listingsSnap = await getDocs(
          query(collection(db, 'listings'), where('creatorId', '==', creatorId))
        );
        setListings(listingsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Error loading creator:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCreator();
  }, [creatorId]);

  if (loading) return <div className="loader"><div className="spinner" /></div>;
  if (!creator) return (
    <div className="empty-state">
      <h3>Creator not found</h3>
      <Link to="/marketplace" className="btn btn-primary">Back to Marketplace</Link>
    </div>
  );

  const isOwnProfile = user?.uid === creatorId;
  const displayName = creator.displayName || 'Creator';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="creator-profile">
      {/* Profile header */}
      <div className="profile-banner" />
      <div className="profile-info">
        <div className="profile-avatar avatar avatar-xl">
          {creator.photoURL ? (
            <img src={creator.photoURL} alt={displayName} />
          ) : initial}
        </div>
        <div className="profile-details">
          <h1>{displayName}</h1>
          <p className="profile-handle">@{creator.username || creatorId.slice(0, 8)}</p>
          {creator.bio && <p className="profile-bio">{creator.bio}</p>}
          <div className="profile-stats">
            <div className="profile-stat">
              <span className="stat-value">{listings.length}</span>
              <span className="stat-label">Listings</span>
            </div>
            <div className="profile-stat">
              <span className="stat-value">{creator.totalSales || 0}</span>
              <span className="stat-label">Sales</span>
            </div>
            {creator.rating && (
              <div className="profile-stat">
                <span className="stat-value">{creator.rating.toFixed(1)}</span>
                <span className="stat-label">Rating</span>
              </div>
            )}
          </div>
        </div>
        {isOwnProfile ? (
          <Link to="/settings" className="btn btn-secondary">Edit Profile</Link>
        ) : (
          <button className="btn btn-primary">Follow</button>
        )}
      </div>

      {/* Listings */}
      <section className="profile-section">
        <h2>Voice Listings</h2>
        {listings.length === 0 ? (
          <div className="empty-state">
            <p>No listings yet.</p>
            {isOwnProfile && (
              <Link to="/voices" className="btn btn-primary btn-sm">Create a Listing</Link>
            )}
          </div>
        ) : (
          <div className="grid grid-3">
            {listings.map((listing) => (
              <div key={listing.id} className="card listing-item">
                <h3>{listing.name}</h3>
                <p className="listing-item-desc">{listing.description}</p>
                {listing.category && <span className="badge badge-primary">{listing.category}</span>}
                <div className="listing-item-footer">
                  <span className="price price-lg">${((listing.price || 0) / 100).toFixed(2)}</span>
                  <button className="btn btn-primary btn-sm">Request Reading</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import './Earnings.css';

export default function Earnings() {
  const { user, userData } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({ total: 0, thisMonth: 0, pending: 0, readings: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEarnings();
  }, [user.uid]);

  async function loadEarnings() {
    try {
      const txSnap = await getDocs(
        query(
          collection(db, 'users', user.uid, 'transactions'),
          orderBy('createdAt', 'desc'),
          limit(50)
        )
      );
      const txData = txSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTransactions(txData);

      // Calculate stats
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      let total = 0;
      let thisMonth = 0;
      let pending = 0;
      let readings = 0;

      txData.forEach((tx) => {
        const amount = tx.creatorAmount || 0;
        total += amount;
        readings++;
        if (tx.status === 'pending') pending += amount;
        const txDate = tx.createdAt?.toDate ? tx.createdAt.toDate() : new Date(tx.createdAt);
        if (txDate >= monthStart) thisMonth += amount;
      });

      setStats({ total, thisMonth, pending, readings });
    } catch (err) {
      // Collection may not exist yet
    } finally {
      setLoading(false);
    }
  }

  if (!userData?.isCreator) {
    return (
      <div className="empty-state">
        <h3>Become a Creator to Start Earning</h3>
        <p>Set up your creator profile and list your voices on the marketplace.</p>
        <Link to="/settings" className="btn btn-gradient">Set Up Creator Profile</Link>
      </div>
    );
  }

  if (loading) return <div className="loader"><div className="spinner" /></div>;

  return (
    <div className="earnings-page">
      <div className="page-header">
        <h1>Earnings</h1>
      </div>

      {/* Stats cards */}
      <div className="earnings-stats">
        <div className="stat-card">
          <span className="stat-card-label">Total Earnings</span>
          <span className="stat-card-value price">${(stats.total / 100).toFixed(2)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">This Month</span>
          <span className="stat-card-value">${(stats.thisMonth / 100).toFixed(2)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Pending</span>
          <span className="stat-card-value">${(stats.pending / 100).toFixed(2)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Total Readings</span>
          <span className="stat-card-value">{stats.readings}</span>
        </div>
      </div>

      {/* Stripe status */}
      {!userData?.stripeConnected && (
        <div className="stripe-cta card">
          <div>
            <h3>Connect Stripe to get paid</h3>
            <p>You need to connect a Stripe account to receive payouts.</p>
          </div>
          <Link to="/settings" className="btn btn-primary">Connect Stripe</Link>
        </div>
      )}

      {/* Transaction history */}
      <section className="earnings-section">
        <h2>Transaction History</h2>
        {transactions.length === 0 ? (
          <div className="empty-state">
            <p>No transactions yet. Your earnings will appear here as fans purchase readings.</p>
          </div>
        ) : (
          <div className="transactions-list">
            {transactions.map((tx) => (
              <div key={tx.id} className="transaction-row">
                <div className="tx-info">
                  <span className="tx-type">{tx.type || 'Reading'}</span>
                  <span className="tx-desc">{tx.description || 'Voice reading'}</span>
                </div>
                <div className="tx-right">
                  <span className="price">+${((tx.creatorAmount || 0) / 100).toFixed(2)}</span>
                  <span className={`badge badge-${tx.status === 'completed' ? 'success' : 'warning'}`}>
                    {tx.status || 'pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

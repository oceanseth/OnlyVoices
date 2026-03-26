import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { logout } from '../../services/firebase';
import './Layout.css';

export default function Layout() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="layout">
      <header className="header">
        <div className="header-left">
          <NavLink to="/dashboard" className="logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19v3" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <rect x="9" y="2" width="6" height="13" rx="3" />
            </svg>
            <span>OnlyVoices</span>
          </NavLink>
          <nav className="nav">
            <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Home
            </NavLink>
            <NavLink to="/marketplace" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Explore
            </NavLink>
            <NavLink to="/voices" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              My Voices
            </NavLink>
            <NavLink to="/library" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Library
            </NavLink>
            {userData?.isCreator && (
              <NavLink to="/earnings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                Earnings
              </NavLink>
            )}
          </nav>
        </div>
        <div className="header-right">
          <NavLink to="/settings" className="header-avatar" title={displayName}>
            {user?.photoURL ? (
              <img src={user.photoURL} alt={displayName} className="avatar" />
            ) : (
              <div className="avatar">{initial}</div>
            )}
          </NavLink>
          <button onClick={handleLogout} className="btn btn-secondary btn-sm">
            Logout
          </button>
        </div>
      </header>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

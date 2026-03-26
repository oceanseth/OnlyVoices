import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Voices from './pages/Voices';
import Marketplace from './pages/Marketplace';
import CreatorProfilePage from './pages/CreatorProfilePage';
import ContentLibrary from './pages/ContentLibrary';
import Settings from './pages/Settings';
import Earnings from './pages/Earnings';
import CreatorCallPage from './pages/CreatorCallPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="loader">
        <div className="spinner" />
      </div>
    );
  }
  return user ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/voices" element={<Voices />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/creator/:creatorId" element={<CreatorProfilePage />} />
        <Route path="/library" element={<ContentLibrary />} />
        <Route path="/earnings" element={<Earnings />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="/:username" element={<CreatorCallPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

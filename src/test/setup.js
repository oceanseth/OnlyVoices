import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Firebase
vi.mock('../services/firebase', () => ({
  auth: {
    currentUser: { uid: 'test-user-id', email: 'test@example.com', displayName: 'Test User', getIdToken: vi.fn().mockResolvedValue('mock-token') },
    onAuthStateChanged: vi.fn(),
  },
  db: {},
  signInWithGoogle: vi.fn(),
  signInWithGithub: vi.fn(),
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  logout: vi.fn(),
  onAuthChange: vi.fn((cb) => {
    cb(null);
    return vi.fn();
  }),
}));

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false, data: () => ({}) }),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  addDoc: vi.fn().mockResolvedValue({ id: 'mock-doc-id' }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getFirestore: vi.fn(),
}));

// Mock Firebase Auth
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  GithubAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));

// Mock Firebase App
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
}));

// Mock window.confirm
global.confirm = vi.fn(() => true);

// Mock window.alert
global.alert = vi.fn();

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((q) => ({
    matches: false,
    media: q,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn(),
}));

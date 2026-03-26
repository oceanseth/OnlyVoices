export const config = {
  firebase: {
    apiKey: "AIzaSyDy4JWlarlEazFMTysE8dOBL5sLBqhV07k",
    authDomain: "onlyvoices-ed470.firebaseapp.com",
    databaseURL: "https://onlyvoices-ed470-default-rtdb.firebaseio.com",
    projectId: "onlyvoices-ed470",
    storageBucket: "onlyvoices-ed470.firebasestorage.app",
    messagingSenderId: "887678127572",
    appId: "1:887678127572:web:1e5c29e1e3e1abbe0fda41"
  },
  api: {
    get baseUrl() {
      const { hostname } = window.location;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3001';
      }
      return 'https://onlyvoices.ai';
    }
  },
  vapi: {
    // Public key from Vapi dashboard. Only used client-side to connect Web SDK.
    publicKey: import.meta.env.VITE_VAPI_PUBLIC_KEY || '',
  },
  stripe: {
    publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '',
    platformFeePercent: 20,
  },
};

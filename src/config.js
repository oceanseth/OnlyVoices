// Configuration for OAuth providers, API endpoints, and other services

export const config = {
  // Firebase configuration
  firebase: {
    apiKey: "AIzaSyDy4JWlarlEazFMTysE8dOBL5sLBqhV07k",
    authDomain: "onlyvoices-ed470.firebaseapp.com",
    databaseURL: "https://onlyvoices-ed470-default-rtdb.firebaseio.com",
    projectId: "onlyvoices-ed470",
    storageBucket: "onlyvoices-ed470.firebasestorage.app",
    messagingSenderId: "887678127572",
    appId: "1:887678127572:web:1e5c29e1e3e1abbe0fda41"
  },

  // API Configuration  
  api: {
    // Dynamically determine API URL based on environment
    // In local development (localhost), use serverless-offline
    // In production, use production API
    get baseUrl() {
      const { hostname } = window.location;
      
      // Local development
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3001';
      }
      
      // Production
      return 'https://onlyvoices.ai';
    }
  },
};


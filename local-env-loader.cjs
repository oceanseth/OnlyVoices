/**
 * Local Environment Loader
 * Loads environment variables from .env.local for local development
 * This mimics AWS SSM Parameter Store behavior
 */

const fs = require('fs');
const path = require('path');

function loadLocalEnv() {
  // Try multiple locations for .env.local (handles both bundled and unbundled contexts)
  const possiblePaths = [
    path.join(__dirname, '.env.local'),                           // Same directory
    path.join(__dirname, '..', '.env.local'),                     // Parent directory
    path.join(__dirname, '..', '..', '.env.local'),               // Two levels up
    path.join(process.cwd(), '.env.local'),                       // Current working directory
    path.join(__dirname, '..', '..', '..', '..', '.env.local'),  // From .esbuild/.build/... to project root
  ];
  
  let envPath = null;
  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      envPath = testPath;
      break;
    }
  }
  
  if (!envPath) {
    console.warn('⚠️  No .env.local file found. Create one from .env.local.example for local testing.');
    console.warn('   Searched in:', possiblePaths.join(', '));
    return;
  }

  console.log('📁 Loading .env.local from:', envPath);
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');

  lines.forEach(line => {
    // Skip comments and empty lines
    if (!line || line.trim().startsWith('#') || line.trim() === '') {
      return;
    }

    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim();

    if (key && value) {
      process.env[key.trim()] = value;
    }
  });

  console.log('✅ Loaded local environment variables from .env.local');
}

// Mock SSM for local development
function mockSSMForLocal() {
  if (process.env.IS_OFFLINE === 'true' || process.env.STAGE === 'local') {
    const AWS = require('aws-sdk');
    
    // Override SSM.getParameter to return local env vars
    const originalSSM = AWS.SSM;
    AWS.SSM = class extends originalSSM {
      getParameter(params, callback) {
        const paramName = params.Name;
        const envVarMap = {
          '/onlyvoices/local/firebase_service_account': 'FIREBASE_SERVICE_ACCOUNT',
          '/onlyvoices/prod/firebase_service_account': 'FIREBASE_SERVICE_ACCOUNT',
        };

        const envVar = envVarMap[paramName];
        if (envVar && process.env[envVar]) {
          const result = {
            Parameter: {
              Name: paramName,
              Value: process.env[envVar],
              Type: 'SecureString',
              Version: 1
            }
          };
          
          if (callback) {
            callback(null, result);
          }
          return { promise: () => Promise.resolve(result) };
        } else {
          const error = new Error(`Parameter ${paramName} not found in .env.local`);
          error.code = 'ParameterNotFound';
          
          if (callback) {
            callback(error);
          }
          return { promise: () => Promise.reject(error) };
        }
      }
    };

    console.log('✅ SSM mocked for local development');
  }
}

module.exports = { loadLocalEnv, mockSSMForLocal };


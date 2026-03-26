/**
 * Local Environment Loader
 * Loads environment variables from .env.local for local development
 * This mimics AWS SSM Parameter Store behavior
 */

const fs = require('fs');
const path = require('path');

function loadLocalEnv() {
  const possiblePaths = [
    path.join(__dirname, '.env.local'),
    path.join(__dirname, '..', '.env.local'),
    path.join(__dirname, '..', '..', '.env.local'),
    path.join(process.cwd(), '.env.local'),
    path.join(__dirname, '..', '..', '..', '..', '.env.local'),
  ];

  let envPath = null;
  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      envPath = testPath;
      break;
    }
  }

  if (!envPath) {
    console.warn('No .env.local file found. Create one from .env.local.example for local testing.');
    console.warn('   Searched in:', possiblePaths.join(', '));
    return;
  }

  console.log('Loading .env.local from:', envPath);
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');

  lines.forEach(line => {
    if (!line || line.trim().startsWith('#') || line.trim() === '') {
      return;
    }

    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim();

    if (key && value) {
      process.env[key.trim()] = value;
    }
  });

  console.log('Loaded local environment variables from .env.local');
}

// Mock SSM for local development by overriding the SDK v3 send method
function mockSSMForLocal() {
  if (process.env.IS_OFFLINE === 'true' || process.env.STAGE === 'local') {
    const { SSMClient } = require('@aws-sdk/client-ssm');

    const envVarMap = {
      '/onlyvoices/local/firebase_service_account': 'FIREBASE_SERVICE_ACCOUNT',
      '/onlyvoices/prod/firebase_service_account': 'FIREBASE_SERVICE_ACCOUNT',
    };

    const originalSend = SSMClient.prototype.send;
    SSMClient.prototype.send = async function(command) {
      // Check if this is a GetParameter command
      const paramName = command.input?.Name;
      if (paramName) {
        const envVar = envVarMap[paramName];
        if (envVar && process.env[envVar]) {
          return {
            Parameter: {
              Name: paramName,
              Value: process.env[envVar],
              Type: 'SecureString',
              Version: 1,
            },
          };
        }
        const error = new Error(`Parameter ${paramName} not found in .env.local`);
        error.name = 'ParameterNotFound';
        throw error;
      }
      return originalSend.call(this, command);
    };

    console.log('SSM mocked for local development');
  }
}

module.exports = { loadLocalEnv, mockSSMForLocal };

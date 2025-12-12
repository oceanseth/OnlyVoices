# Local Development Setup

This guide explains how to run OnlyVoices locally for development.

## Prerequisites

1. **Node.js** >= 20
2. **Firebase Service Account** JSON file
3. **npm** or **yarn**

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

**Option 1: Generate from AWS SSM (Recommended)**

```bash
./scripts/generate-env-local.sh
```

This script will automatically fetch the Firebase Service Account from AWS SSM Parameter Store and create `.env.local` for you.

**Option 2: Manual Setup**

Create a `.env.local` file in the project root (copy from `.env.local.example`):

```bash
cp .env.local.example .env.local
```

Then fill in the values:

```bash
# Firebase Service Account (base64 encoded JSON)
# Get this from Firebase Console -> Project Settings -> Service Accounts
# Encode the JSON file: cat service-account.json | base64
FIREBASE_SERVICE_ACCOUNT=your_base64_encoded_service_account_json_here

# Optional: AWS Region (defaults to us-east-1)
AWS_REGION=us-east-1

# Optional: API Port (defaults to 3001)
API_PORT=3001
```

### 3. Get Firebase Service Account

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (onlyvoices-ed470)
3. Go to Project Settings → Service Accounts
4. Click "Generate new private key"
5. Save the JSON file
6. Encode it to base64:
   ```bash
   cat path/to/service-account.json | base64
   ```
7. Copy the base64 string to `.env.local` as `FIREBASE_SERVICE_ACCOUNT`

## Running Locally

### Start Both Frontend and API

```bash
npm run dev
```

This will:
- Start Vite dev server on `http://localhost:3000`
- Start local API server on `http://localhost:3001`
- Watch for file changes and auto-reload

### Start Only Frontend

```bash
npm run dev:vite
```

### Start Only API

```bash
npm run dev:api
```

## Development URLs

- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001/api
- **Health Check**: http://localhost:3001/health
- **Test Endpoint**: http://localhost:3001/api/test

## How It Works

### Local API Server

The local API server (`server/local-api-server.js`) wraps the Lambda handler in an Express server. It:

1. Loads environment variables from `.env.local`
2. Mocks AWS SSM Parameter Store to use local env vars
3. Converts Express requests to Lambda event format
4. Invokes the Lambda handler
5. Converts Lambda responses back to Express responses

### Vite Proxy

Vite is configured to proxy `/api/*` requests to the local API server (`http://localhost:3001`). This means:

- Frontend requests to `/api/test` → `http://localhost:3001/api/test`
- No CORS issues
- Same API structure as production

## Testing

### Test API Endpoint

```bash
curl http://localhost:3001/api/test
```

Expected response:
```json
{
  "message": "OnlyVoices API is working!",
  "timestamp": "2024-...",
  "stage": "local"
}
```

### Test with Authentication

1. Open http://localhost:3000 in your browser
2. Sign in with Firebase (Google, GitHub, or Email)
3. The frontend will automatically use the local API

## Troubleshooting

### "FIREBASE_SERVICE_ACCOUNT not found"

- Make sure `.env.local` exists in the project root
- Verify the `FIREBASE_SERVICE_ACCOUNT` variable is set
- Check that the base64 encoding is correct

### "Port 3000 already in use"

- Change the Vite port in `vite.config.js`
- Or kill the process using port 3000:
  ```bash
  lsof -ti:3000 | xargs kill
  ```

### "Port 3001 already in use"

- Change the API port by setting `API_PORT` in `.env.local`
- Or kill the process using port 3001:
  ```bash
  lsof -ti:3001 | xargs kill
  ```

### API not responding

- Check that the API server is running (look for "🚀 Local API server running")
- Verify `.env.local` is configured correctly
- Check the console for error messages

### Firebase authentication not working

- Verify `FIREBASE_SERVICE_ACCOUNT` is correctly base64 encoded
- Check Firebase project settings
- Ensure the service account has proper permissions

## File Watching

The API server uses `nodemon` to watch for changes in:
- `server/` directory
- `api/` directory
- `utils/` directory

Changes to these files will automatically restart the API server.

## Production vs Local

| Feature | Local | Production |
|---------|-------|------------|
| API Server | Express on port 3001 | Lambda + API Gateway |
| Environment | `.env.local` | AWS SSM / Secrets Manager |
| Firebase | Local env var | SSM Parameter Store |
| CORS | Allowed from any origin | Configured in API Gateway |


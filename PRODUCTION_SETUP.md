# Production Setup Guide

This document outlines the production improvements and setup requirements.

## 1. AWS Secrets Manager Integration

### Setup
API keys and sensitive credentials are now stored in AWS Secrets Manager instead of Firestore.

### Secrets Structure
- `onlyvoices/prod/elevenlabs-key-{userId}` - User's ElevenLabs API key
- `onlyvoices/prod/audible-tokens-{userId}` - User's Audible OAuth tokens

### Migration
To migrate existing API keys from Firestore to Secrets Manager:
1. Run a migration script to read from Firestore
2. Store in Secrets Manager using the `SecretsManager` utility
3. Update code to read from Secrets Manager first, fallback to Firestore

## 2. Audible OAuth Integration

### Prerequisites
1. Register application with Audible Developer Program
2. Get OAuth client ID and secret
3. Configure redirect URI

### Environment Variables
- `AUDIBLE_CLIENT_ID` - Audible OAuth client ID
- `AUDIBLE_CLIENT_SECRET` - Audible OAuth client secret (store in Secrets Manager)

### OAuth Flow
1. User clicks "Connect Audible" in Settings
2. Redirect to Audible OAuth authorization URL
3. User authorizes application
4. Receive authorization code via callback
5. Exchange code for access/refresh tokens
6. Store tokens securely in Secrets Manager

### Implementation Status
- ✅ OAuth client structure created
- ✅ Token storage in Secrets Manager
- ⚠️ Requires Audible API credentials and OAuth endpoint configuration

## 3. YouTube Audio Extraction

### Lambda Layer Setup
To enable YouTube audio extraction, you need to add yt-dlp and ffmpeg to a Lambda layer:

#### Option 1: Create Lambda Layer with yt-dlp
```bash
# Create layer directory
mkdir -p layer/python/bin

# Download yt-dlp
wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O layer/python/bin/yt-dlp
chmod +x layer/python/bin/yt-dlp

# Download ffmpeg static binary
wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
tar -xf ffmpeg-release-amd64-static.tar.xz
cp ffmpeg-*-amd64-static/ffmpeg layer/python/bin/
chmod +x layer/python/bin/ffmpeg

# Create zip
cd layer
zip -r ../yt-dlp-layer.zip .
cd ..

# Upload to Lambda layer
aws lambda publish-layer-version \
  --layer-name yt-dlp-ffmpeg \
  --zip-file fileb://yt-dlp-layer.zip \
  --compatible-runtimes python3.9 python3.10 python3.11
```

#### Option 2: Use Container Image
Create a Docker image with yt-dlp and ffmpeg pre-installed, then use Lambda container images.

### Environment Variables
- `YTDLP_PATH` - Path to yt-dlp binary (default: `/opt/bin/yt-dlp`)
- `FFMPEG_PATH` - Path to ffmpeg binary (default: `/opt/bin/ffmpeg`)

### Implementation Status
- ✅ YouTube URL parsing
- ✅ Audio extraction structure
- ✅ Audio segmentation
- ⚠️ Requires yt-dlp Lambda layer

## 4. Render Job Processing with SQS

### Architecture
1. API endpoint receives render request
2. Creates job record in Firestore
3. Sends message to SQS queue
4. Worker Lambda processes jobs from queue
5. Updates job status in Firestore
6. Failed jobs go to DLQ after 3 retries

### SQS Queue Configuration
- **Queue**: `onlyvoices-render-jobs-prod`
- **DLQ**: `onlyvoices-render-jobs-dlq-prod`
- **Visibility Timeout**: 5 minutes
- **Message Retention**: 14 days
- **Max Receives**: 3 (before DLQ)

### Worker Lambda
- **Function**: `onlyvoices-render-worker-prod`
- **Timeout**: 15 minutes
- **Memory**: 1024 MB
- **Trigger**: SQS event source mapping

### Implementation Status
- ✅ SQS queue and DLQ created
- ✅ Worker Lambda function structure
- ✅ Event source mapping configured
- ⚠️ Full book rendering logic needs implementation

## 5. Rate Limiting

### Implementation
- In-memory rate limiter (per Lambda instance)
- 100 requests per minute per user (configurable)
- Returns 429 status code when rate limited

### Production Considerations
For distributed rate limiting across multiple Lambda instances:
- Use DynamoDB for shared state
- Or use AWS API Gateway throttling
- Or use Redis/ElastiCache

### Configuration
Rate limits can be configured per endpoint:
- Default: 100 requests/minute
- Render jobs: 10 requests/minute
- Voice training: 5 requests/minute

## 6. Security Improvements

### Secrets Management
- ✅ API keys stored in AWS Secrets Manager
- ✅ OAuth tokens encrypted at rest
- ✅ IAM policies restrict access

### Encryption
- All secrets encrypted at rest by AWS Secrets Manager
- In-transit encryption via HTTPS/TLS
- Firestore data encrypted by default

### Access Control
- Firebase authentication required for all endpoints
- IAM roles with least privilege
- Secrets Manager resource-based policies

## Deployment Steps

1. **Deploy Infrastructure**
   ```bash
   cd terraform
   terraform apply
   ```

2. **Create Lambda Layer** (for YouTube extraction)
   - Follow instructions above to create yt-dlp layer
   - Update Terraform to reference layer ARN

3. **Configure Secrets**
   - Store Audible OAuth credentials in Secrets Manager
   - Migrate existing API keys from Firestore

4. **Update Environment Variables**
   - Set `AUDIBLE_CLIENT_ID` in Lambda environment
   - Set `YTDLP_PATH` and `FFMPEG_PATH` if using custom paths

5. **Test Endpoints**
   - Test OAuth flow
   - Test YouTube extraction
   - Test render job processing

## Monitoring

### CloudWatch Metrics
- SQS queue depth
- Lambda function errors
- Render job success/failure rates
- Rate limit hits

### Alarms
- DLQ message count > 0
- Lambda error rate > 5%
- SQS queue depth > 100

## Next Steps

1. Complete Audible OAuth implementation with actual API endpoints
2. Test YouTube extraction with yt-dlp layer
3. Implement full book rendering logic
4. Add distributed rate limiting
5. Set up monitoring and alerts


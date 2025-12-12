# OnlyVoices

Repository that builds the onlyvoices.ai website

## Architecture

This project uses:
- **Vite** for frontend build tooling
- **S3** for static website hosting
- **Lambda** for serverless API functions
- **API Gateway** for HTTP API endpoints
- **CloudFront** for CDN and distribution

## Infrastructure Setup

The infrastructure is managed with Terraform and includes:

- S3 bucket for hosting the static website
- Lambda function for API endpoints
- API Gateway (HTTP API) for routing `/api/*` requests to Lambda
- CloudFront distribution that:
  - Serves static files from S3
  - Proxies `/api/*` requests to API Gateway

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Terraform** >= 1.0 installed
3. **Node.js** >= 18 for Lambda runtime
4. **ACM Certificate** in us-east-1 for CloudFront (required for custom domain)

## Setup

### 1. Install Prerequisites

**Install Terraform:**
```bash
# macOS
brew install terraform

# Or download from: https://www.terraform.io/downloads
```

**Verify AWS CLI is configured:**
```bash
aws configure
aws sts get-caller-identity  # Should return your AWS account info
```

### 2. Get or Create ACM Certificate

CloudFront requires an ACM certificate in the `us-east-1` region for custom domains.

**Option A: Find existing certificate**
```bash
./scripts/get-acm-certificate.sh
```

**Option B: Create new certificate**
1. Go to AWS Console -> Certificate Manager (make sure you're in **us-east-1** region)
2. Click "Request a certificate"
3. Select "Request a public certificate"
4. Add domain names:
   - `onlyvoices.ai`
   - `*.onlyvoices.ai` (wildcard for subdomains)
5. Choose validation method (DNS recommended)
6. Complete validation
7. Once issued, run `./scripts/get-acm-certificate.sh` to get the ARN

### 3. Configure Terraform Variables

Copy the example terraform variables file:

```bash
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
```

Edit `terraform/terraform.tfvars` and set:
- `acm_certificate_arn`: Your ACM certificate ARN (must be in us-east-1 for CloudFront)

### 2. Prepare Lambda Package

The Lambda function needs to be packaged before deployment. Create the lambda package:

```bash
# Create lambda-package directory structure
mkdir -p lambda-package/api
cp api/api.js lambda-package/api/

# Create zip file
cd lambda-package
zip -r ../lambda-package.zip .
cd ..
```

### 3. Create Lambda Layer (Optional)

If you have dependencies, create a Lambda layer:

```bash
mkdir -p lambda-layer/nodejs
# Install dependencies to lambda-layer/nodejs
cd lambda-layer
zip -r ../lambda-layer.zip .
cd ..
```

For now, the basic API handler doesn't require dependencies, so you can create an empty layer:

```bash
mkdir -p lambda-layer/nodejs
touch lambda-layer/nodejs/package.json
cd lambda-layer
zip -r ../lambda-layer.zip .
cd ..
```

### 4. Deploy Infrastructure

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

After deployment, Terraform will output:
- API Gateway endpoint URL
- CloudFront distribution ID
- S3 bucket name
- Website URL

### 5. Deploy Frontend

Build and deploy the Vite frontend to S3:

```bash
# Build the frontend
npm run build

# Deploy to S3 (replace BUCKET_NAME with your S3 bucket name from Terraform output)
aws s3 sync dist/ s3://onlyvoices.ai --delete
```

## API Endpoints

### Test Endpoint

- **GET** `/api/test`
- Returns a simple JSON response confirming the API is working

Example response:
```json
{
  "message": "OnlyVoices API is working!",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "stage": "prod"
}
```

## Development

### Local Development

For local development, you can run the Vite dev server:

```bash
npm run dev
```

### Testing the API

After deployment, test the API endpoint:

```bash
curl https://onlyvoices.ai/api/test
```

Or visit in your browser: `https://onlyvoices.ai/api/test`

## Project Structure

```
.
├── api/                 # Lambda API handler
│   └── api.js          # Main Lambda handler
├── terraform/          # Terraform infrastructure code
│   ├── main.tf         # Main Terraform configuration
│   ├── variables.tf    # Variable definitions
│   ├── outputs.tf      # Output values
│   ├── data.tf         # Data sources
│   └── terraform.tfvars.example  # Example variables
├── lambda-package/     # Lambda deployment package (generated)
├── lambda-layer/       # Lambda layer package (generated)
└── README.md           # This file
```

## Troubleshooting

### CloudFront Distribution Not Updating

CloudFront distributions can take 15-20 minutes to propagate changes. If you've updated the API Gateway, wait for the distribution to finish deploying.

### API Gateway Not Found

Check Terraform outputs:
```bash
cd terraform
terraform output api_gateway_id
```

### S3 Bucket Access Issues

Ensure the S3 bucket policy allows CloudFront OAC access. The Terraform configuration handles this automatically.

### Certificate Issues

The ACM certificate must be:
- In the `us-east-1` region (required for CloudFront)
- Validated and in the `Issued` status
- Covering your domain (`onlyvoices.ai` and `www.onlyvoices.ai`)

## Cleanup

To destroy all infrastructure:

```bash
cd terraform
terraform destroy
```

**Warning**: This will delete all resources including the S3 bucket and all its contents.

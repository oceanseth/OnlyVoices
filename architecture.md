# OnlyVoices — technical architecture

This document describes how the **onlyvoices.ai** site is built and deployed. For what the product does for creators and callers, see [README.md](README.md).

## Architecture

This project uses:

- **Vite** for frontend build tooling
- **S3** for static website hosting
- **Lambda** for serverless API functions
- **API Gateway** for HTTP API endpoints
- **CloudFront** for CDN and distribution

## Infrastructure setup

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

### 1. Install prerequisites

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

### 2. Get or create ACM certificate

CloudFront requires an ACM certificate in the `us-east-1` region for custom domains.

**Option A: Find existing certificate**

```bash
./scripts/get-acm-certificate.sh
```

**Option B: Create new certificate**

1. Go to AWS Console → Certificate Manager (make sure you're in **us-east-1** region)
2. Click "Request a certificate"
3. Select "Request a public certificate"
4. Add domain names:
   - `onlyvoices.ai`
   - `*.onlyvoices.ai` (wildcard for subdomains)
5. Choose validation method (DNS recommended)
6. Complete validation
7. Once issued, run `./scripts/get-acm-certificate.sh` to get the ARN

### 3. Configure Terraform variables

Copy the example terraform variables file:

```bash
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
```

Edit `terraform/terraform.tfvars` and set:

- `acm_certificate_arn`: Your ACM certificate ARN (must be in us-east-1 for CloudFront)

### 4. Prepare Lambda package

The Lambda function needs to be packaged before deployment. Create the lambda package (handler lives in `api/api.cjs`):

```bash
mkdir -p lambda-package/api
cp api/api.cjs lambda-package/api/

cd lambda-package
zip -r ../lambda-package.zip .
cd ..
```

### 5. Create Lambda layer (optional)

If you have dependencies, create a Lambda layer:

```bash
mkdir -p lambda-layer/nodejs
# Install dependencies to lambda-layer/nodejs
cd lambda-layer
zip -r ../lambda-layer.zip .
cd ..
```

If the basic API handler has no extra dependencies, you can create an empty layer:

```bash
mkdir -p lambda-layer/nodejs
touch lambda-layer/nodejs/package.json
cd lambda-layer
zip -r ../lambda-layer.zip .
cd ..
```

### 6. Deploy infrastructure

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

### 7. Deploy frontend

Build and deploy the Vite frontend to S3:

```bash
npm run build

# Deploy to S3 (replace BUCKET_NAME with your S3 bucket name from Terraform output)
aws s3 sync dist/ s3://onlyvoices.ai --delete
```

## API endpoints

### Test endpoint

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

### Local development

Run the Vite dev server:

```bash
npm run dev
```

### Testing the API

After deployment, test the API endpoint:

```bash
curl https://onlyvoices.ai/api/test
```

Or visit in your browser: `https://onlyvoices.ai/api/test`

## Project structure

```
.
├── api/                 # Lambda API handler
│   └── api.cjs          # Main Lambda handler
├── terraform/           # Terraform infrastructure code
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── data.tf
│   └── terraform.tfvars.example
├── lambda-package/      # Lambda deployment package (generated)
├── lambda-layer/        # Lambda layer package (generated)
├── architecture.md      # This file
└── README.md            # Product overview
```

## Troubleshooting

### CloudFront distribution not updating

CloudFront distributions can take 15–20 minutes to propagate changes. If you've updated the API Gateway, wait for the distribution to finish deploying.

### API Gateway not found

Check Terraform outputs:

```bash
cd terraform
terraform output api_gateway_id
```

### S3 bucket access issues

Ensure the S3 bucket policy allows CloudFront OAC access. The Terraform configuration handles this automatically.

### Certificate issues

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

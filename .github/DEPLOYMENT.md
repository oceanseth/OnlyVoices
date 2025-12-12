# GitHub Actions Deployment

This repository uses GitHub Actions to automatically deploy to AWS when code is pushed to the `production` branch.

## Required GitHub Secrets

The following secrets must be configured in your GitHub repository under **Settings → Secrets and variables → Actions → Secrets**:

### AWS Credentials
- `AWS_ACCESS_KEY_ID` - AWS access key ID with permissions to:
  - Deploy to S3
  - Update Lambda functions
  - Update CloudFront distributions
  - Run Terraform operations
- `AWS_SECRET_ACCESS_KEY` - AWS secret access key

### Environment Setup

1. Go to **Settings → Environments → New environment**
2. Create an environment named `production`
3. Add the AWS secrets to this environment

## Workflows

### `deploy.yml` (Main Workflow)
Triggers on push to `production` branch and runs both:
- Frontend deployment (S3 + CloudFront)
- Lambda deployment (Terraform)

### `deploy-frontend.yml`
Deploys the Vite-built frontend to S3 and invalidates CloudFront cache.
- Triggers on changes to: `src/`, `public/`, `index.html`, `vite.config.js`, `package.json`
- Builds the frontend with `npm run build`
- Syncs `dist/` to S3 bucket
- Invalidates CloudFront cache

### `deploy-lambda.yml`
Deploys the Lambda function and updates infrastructure with Terraform.
- Triggers on changes to: `api/`, `utils/`, `terraform/`, `package.json`
- Packages Lambda function and layer
- Runs Terraform to update infrastructure
- Updates CloudFront to point to new API Gateway
- Invalidates CloudFront cache for API routes

## Manual Deployment

You can also trigger deployments manually:
1. Go to **Actions** tab in GitHub
2. Select the workflow you want to run
3. Click **Run workflow**
4. Select the branch (usually `production`)
5. Click **Run workflow**

## Deployment Process

1. **Frontend Deployment:**
   - Installs dependencies
   - Builds the Vite application
   - Syncs files to S3 bucket (from Terraform output)
   - Invalidates CloudFront cache

2. **Lambda Deployment:**
   - Prepares Lambda package (copies API and utils files)
   - Creates Lambda layer zip
   - Initializes Terraform
   - Applies Terraform changes
   - Updates CloudFront API Gateway origin
   - Invalidates CloudFront cache for API routes

## Troubleshooting

### Terraform State Lock
If Terraform apply fails with a state lock error:
- Check if another deployment is running
- Wait for it to complete or manually unlock if needed

### CloudFront Distribution Not Found
If CloudFront distribution ID is not found:
- Ensure Terraform has been applied at least once
- Check that the ACM certificate is validated
- The workflow will skip CloudFront operations if distribution doesn't exist

### AWS Permissions
Ensure the AWS credentials have the following permissions:
- `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket` on the S3 bucket
- `lambda:UpdateFunctionCode`, `lambda:GetFunction` on Lambda functions
- `cloudfront:CreateInvalidation`, `cloudfront:GetDistribution`, `cloudfront:UpdateDistribution`
- Full permissions for Terraform-managed resources


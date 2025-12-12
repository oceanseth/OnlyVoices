#!/bin/bash
# Helper script to find ACM certificate ARN for onlyvoices.ai

echo "Searching for ACM certificate for onlyvoices.ai in us-east-1..."
echo ""

CERT_ARN=$(aws acm list-certificates --region us-east-1 \
  --query "CertificateSummaryList[?DomainName=='onlyvoices.ai' || DomainName=='*.onlyvoices.ai'].CertificateArn" \
  --output text 2>/dev/null)

if [ -z "$CERT_ARN" ] || [ "$CERT_ARN" = "None" ]; then
  echo "❌ No ACM certificate found for onlyvoices.ai in us-east-1"
  echo ""
  echo "To create a certificate:"
  echo "1. Go to AWS Console -> Certificate Manager (us-east-1 region)"
  echo "2. Request a public certificate"
  echo "3. Add domain names: onlyvoices.ai and *.onlyvoices.ai"
  echo "4. Validate the certificate (DNS or email validation)"
  echo "5. Once issued, run this script again to get the ARN"
  echo ""
  echo "Or list all certificates:"
  echo "  aws acm list-certificates --region us-east-1"
  exit 1
else
  echo "✅ Found certificate:"
  echo "   $CERT_ARN"
  echo ""
  echo "Add this to terraform/terraform.tfvars:"
  echo "   acm_certificate_arn = \"$CERT_ARN\""
fi


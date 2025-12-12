variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "stage" {
  description = "Deployment stage (prod, dev, etc.)"
  type        = string
  default     = "prod"
}

variable "domain_name" {
  description = "Domain name for the website (e.g., onlyvoices.ai)"
  type        = string
  default     = "onlyvoices.ai"
}

variable "acm_certificate_arn" {
  description = "ARN of the ACM certificate for CloudFront (must be in us-east-1). If not provided, will look up by domain name."
  type        = string
  default     = ""
}

variable "lambda_package_path" {
  description = "Path to the Lambda deployment package"
  type        = string
  default     = "../lambda-package.zip"
}

variable "lambda_layer_path" {
  description = "Path to the Lambda layer zip file"
  type        = string
  default     = "../lambda-layer.zip"
}


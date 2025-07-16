## S3 Bucket for User Files
# This bucket is used to store user-uploaded files.
# Ensure the bucket name is globally unique.
# Replace "your-app-user-files-123456" with a unique name.
# The bucket is configured to enforce ownership controls, block public access,
# and enable server-side encryption with AES256.
resource "aws_s3_bucket" "user_files" {
  bucket        = var.aws_s3_bucket # Use the variable defined in variables.tf
  force_destroy = true              # allows deleting non-empty bucket if needed
}

# --- NEW: CORS Configuration for the S3 Bucket ---
# This allows cross-origin requests from any origin for testing purposes.
resource "aws_s3_bucket_cors_configuration" "cors_rules" {
  bucket = aws_s3_bucket.user_files.bucket

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_ownership_controls" "owner" {
  bucket = aws_s3_bucket.user_files.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "block" {
  bucket = aws_s3_bucket.user_files.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "encrypt" {
  bucket = aws_s3_bucket.user_files.bucket

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

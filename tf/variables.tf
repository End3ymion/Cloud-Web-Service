
variable "key_name" {
  description = "Name of the EC2 key pair"
  type        = string
}

# AWS General Config
variable "region" {
  description = "AWS region to deploy resources"
  type        = string
}

variable "aws_s3_bucket" {
  description = "Globally unique S3 bucket name"
  type        = string
}

# Availability Zones
variable "az_a" {
  description = "AWS availability zone A"
  type        = string
}

variable "az_b" {
  description = "AWS availability zone B"
  type        = string
}

variable "az_c" {
  description = "AWS availability zone C"
  type        = string
}
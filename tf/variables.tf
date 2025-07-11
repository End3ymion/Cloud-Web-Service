
variable "key_name" {
  description = "Name of the EC2 key pair"
  type        = string
}

variable "custom_sg_id" {
  description = "ID of the custom security group to use for ALB and EC2"
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

# Optional (only needed if used elsewhere)
variable "subnet_id" {
  description = "Subnet ID for single EC2 instance (not used in ASG setup)"
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
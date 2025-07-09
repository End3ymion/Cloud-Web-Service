variable "subnet_id" {
  description = "Subnet ID for EC2 instance"
  type        = string
}

variable "security_group_id" {
  description = "Security Group ID for EC2 instance"
  type        = string
}

variable "key_name" {
  description = "Name of the EC2 key pair"
  type        = string
}

variable "region" {
  description = "AWS region to deploy resources"
  type        = string
}

variable "aws_s3_bucket" {
  description = "Globally unique S3 bucket name"
  type        = string
}

variable "az_a" {
  description = "AWS availability zone"
  type        = string
}

variable "az_b" {
  description = "AWS availability zone"
  type        = string
}

variable "az_c" {
  description = "AWS availability zone"
  type        = string
}
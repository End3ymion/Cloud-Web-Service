# VPC
resource "aws_vpc" "cloud_drive" {
  cidr_block           = "172.16.0.0/16"
  instance_tenancy     = "default"
  enable_dns_hostnames = true

  tags = {
    Name = "cloud-drive-vpc"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "cloud_drive" {
  vpc_id = aws_vpc.cloud_drive.id

  tags = {
    Name = "cloud-drive-igw"
  }
}

# Public Subnets
resource "aws_subnet" "public1" {
  vpc_id            = aws_vpc.cloud_drive.id
  cidr_block        = "172.16.0.0/20"
  availability_zone = var.az_a
  tags = {
    Name = "cloud-drive-subnet-public1-${var.az_a}"
  }
}

resource "aws_subnet" "public2" {
  vpc_id            = aws_vpc.cloud_drive.id
  cidr_block        = "172.16.16.0/20"
  availability_zone = var.az_b
  tags = {
    Name = "cloud-drive-subnet-public2-${var.az_b}"
  }
}

resource "aws_subnet" "public3" {
  vpc_id            = aws_vpc.cloud_drive.id
  cidr_block        = "172.16.32.0/20"
  availability_zone = var.az_c
  tags = {
    Name = "cloud-drive-subnet-public3-${var.az_c}"
  }
}

# Private Subnets
resource "aws_subnet" "private1" {
  vpc_id            = aws_vpc.cloud_drive.id
  cidr_block        = "172.16.128.0/20"
  availability_zone = var.az_a
  tags = {
    Name = "cloud-drive-subnet-private1-${var.az_a}"
  }
}

resource "aws_subnet" "private2" {
  vpc_id            = aws_vpc.cloud_drive.id
  cidr_block        = "172.16.144.0/20"
  availability_zone = var.az_b
  tags = {
    Name = "cloud-drive-subnet-private2-${var.az_b}"
  }
}

resource "aws_subnet" "private3" {
  vpc_id            = aws_vpc.cloud_drive.id
  cidr_block        = "172.16.160.0/20"
  availability_zone = var.az_c
  tags = {
    Name = "cloud-drive-subnet-private3-${var.az_c}"
  }
}

# Route Table for Public Subnets
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.cloud_drive.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.cloud_drive.id
  }

  tags = {
    Name = "cloud-drive-rtb-public"
  }
}

resource "aws_route_table_association" "public1" {
  subnet_id      = aws_subnet.public1.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public2" {
  subnet_id      = aws_subnet.public2.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public3" {
  subnet_id      = aws_subnet.public3.id
  route_table_id = aws_route_table.public.id
}

# Route Tables for Private Subnets
resource "aws_route_table" "private1" {
  vpc_id = aws_vpc.cloud_drive.id
  tags = {
    Name = "cloud-drive-rtb-private1-var.az_a"
  }
}

resource "aws_route_table" "private2" {
  vpc_id = aws_vpc.cloud_drive.id
  tags = {
    Name = "cloud-drive-rtb-private2-var.az_b"
  }
}

resource "aws_route_table" "private3" {
  vpc_id = aws_vpc.cloud_drive.id
  tags = {
    Name = "cloud-drive-rtb-private3-var.var.az_c"
  }
}

resource "aws_route_table_association" "private1" {
  subnet_id      = aws_subnet.private1.id
  route_table_id = aws_route_table.private1.id
}

resource "aws_route_table_association" "private2" {
  subnet_id      = aws_subnet.private2.id
  route_table_id = aws_route_table.private2.id
}

resource "aws_route_table_association" "private3" {
  subnet_id      = aws_subnet.private3.id
  route_table_id = aws_route_table.private3.id
}

# VPC Endpoint for S3
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.cloud_drive.id
  service_name      = "com.amazonaws.ap-southeast-1.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids = [
    aws_route_table.private1.id,
    aws_route_table.private2.id,
    aws_route_table.private3.id
  ]

  tags = {
    Name = "cloud-drive-vpce-s3"
  }
}

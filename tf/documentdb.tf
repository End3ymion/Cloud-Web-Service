# Fetches the original database password securely from AWS Secrets Manager.
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = "clouddrive/main/password"
}

# Creates a dedicated security group for the DocumentDB cluster.
resource "aws_security_group" "docdb_sg" {
  name        = "docdb-security-group"
  description = "Allow inbound traffic to DocumentDB from web servers"
  vpc_id      = aws_vpc.cloud_drive.id

  # This now directly references your web server's security group.
  ingress {
    from_port       = 27017 # DocumentDB port
    to_port         = 27017
    protocol        = "tcp"
    security_groups = [aws_security_group.cloud_drive_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "cloud-drive-sg-docdb"
  }
}

# Creates a subnet group using your three private subnets.
resource "aws_docdb_subnet_group" "docdb" {
  name = "cloud-drive-docdb-subnet-group"
  subnet_ids = [
    aws_subnet.private1.id,
    aws_subnet.private2.id,
    aws_subnet.private3.id
  ]
  tags = {
    Name = "cloud-drive-docdb-subnets"
  }
}

# Defines the DocumentDB cluster itself.
resource "aws_docdb_cluster" "docdb" {
  cluster_identifier       = "cloud-drive-docdb-cluster"
  engine                   = "docdb"
  master_username          = jsondecode(data.aws_secretsmanager_secret_version.db_password.secret_string)["username"]
  master_password          = jsondecode(data.aws_secretsmanager_secret_version.db_password.secret_string)["password"]
  db_subnet_group_name   = aws_docdb_subnet_group.docdb.name
  vpc_security_group_ids = [aws_security_group.docdb_sg.id]
  skip_final_snapshot      = true

  tags = {
    Name = "cloud-drive-docdb"
  }
}

# Defines the instance required for the cluster to run.
resource "aws_docdb_cluster_instance" "docdb" {
  count              = 1
  identifier         = "cloud-drive-docdb-instance"
  cluster_identifier = aws_docdb_cluster.docdb.id
  instance_class     = "db.t3.medium"

  tags = {
    Name = "cloud-drive-docdb-instance"
  }
}

# Resources to store dynamic DB connection details in Secrets Manager.
resource "aws_secretsmanager_secret" "db_connection_details" {
  name = "clouddrive/main/db_connection_details"
  tags = {
    Name = "Cloud Drive DB Connection Details"
  }
}

resource "aws_secretsmanager_secret_version" "db_connection_details_version" {
  secret_id = aws_secretsmanager_secret.db_connection_details.id

  secret_string = jsonencode({
    username = jsondecode(data.aws_secretsmanager_secret_version.db_password.secret_string)["username"]
    password = jsondecode(data.aws_secretsmanager_secret_version.db_password.secret_string)["password"]
    host     = aws_docdb_cluster.docdb.endpoint
  })

  lifecycle {
    replace_triggered_by = [aws_docdb_cluster.docdb.endpoint]
  }
}

# Output to display the cluster endpoint after apply.
output "docdb_cluster_endpoint" {
  description = "The connection endpoint for the DocumentDB cluster"
  value       = aws_docdb_cluster.docdb.endpoint
  sensitive   = true
}

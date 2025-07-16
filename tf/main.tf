# --- IAM Role, Policies, and Instance Profile for EC2 ---

# 1. The Role for EC2 instances
resource "aws_iam_role" "s3_access_role" {
  name = "ec2-s3-full-access-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action    = "sts:AssumeRole",
        Effect    = "Allow",
        Principal = { Service = "ec2.amazonaws.com" }
      }
    ]
  })
}

# 2. The Instance Profile that contains the role
resource "aws_iam_instance_profile" "s3_access_profile" {
  name = "ec2-s3-full-access-profile"
  role = aws_iam_role.s3_access_role.name
}

# 3. Policy attachment for S3 Access
resource "aws_iam_role_policy_attachment" "s3_access_attach" {
  role       = aws_iam_role.s3_access_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}

# 4. Policy attachment for CloudWatch Access
resource "aws_iam_role_policy_attachment" "cloudwatch_access_attach" {
  role       = aws_iam_role.s3_access_role.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

data "aws_secretsmanager_secret" "env_file_secret" {
  name = "clouddrive/main/env_file"
}

# 5. Inline policy for Secrets Manager Access
resource "aws_iam_role_policy" "secrets_manager_access" {
  name = "secrets-manager-read-access"
  role = aws_iam_role.s3_access_role.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = "secretsmanager:GetSecretValue",
        Resource = [
          # ARN for the automated connection details secret
          aws_secretsmanager_secret.db_connection_details.arn,

          # ARN for the manually created .env file secret
          data.aws_secretsmanager_secret.env_file_secret.arn
        ]
      }
    ]
  })
}


# --- Web Server Security Group ---
resource "aws_security_group" "cloud_drive_sg" {
  name        = "cloud-drive-sg"
  description = "Security group for cloud-drive instances"
  vpc_id      = aws_vpc.cloud_drive.id

  ingress {
    description = "Allow SSH from anywhere"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Replace with your IP for more security
  }

  ingress {
    description = "Allow HTTP from anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name = "cloud-drive-sg"
  }
}

# --- EC2 Launch Template ---
resource "aws_launch_template" "web_launch_template" {
  name_prefix   = "web-launch-"
  image_id      = "ami-0a3ece531caa5d49d" # Amazon Linux 2 AMI
  instance_type = "t2.micro"
  key_name      = var.key_name

  iam_instance_profile {
    arn = aws_iam_instance_profile.s3_access_profile.arn
  }

  user_data = base64encode(<<EOF
#!/bin/bash
sudo yum update -y
# Import MongoDB GPG key
sudo rpm --import https://pgp.mongodb.com/server-6.0.asc

# Add MongoDB repo
echo "[mongodb-org-6.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/amazon/2/mongodb-org/6.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://pgp.mongodb.com/server-6.0.asc" | sudo tee /etc/yum.repos.d/mongodb-org-6.0.repo

# Install dependencies
sudo yum install -y mongodb-mongosh gcc-c++ make nodejs git awscli
git clone https://github.com/End3ymion/Cloud-Web-Service.git /home/ec2-user/Cloud-Web-Service
cd /home/ec2-user/Cloud-Web-Service
npm install
wget https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -O /home/ec2-user/Cloud-Web-Service/global-bundle.pem

aws secretsmanager get-secret-value --secret-id clouddrive/main/env_file --query SecretString --output text > /home/ec2-user/Cloud-Web-Service/.env
SECRET_JSON=$(aws secretsmanager get-secret-value --secret-id clouddrive/main/db_connection_details --query SecretString --output text)
DB_USER=$(jq -r .username <<< "$SECRET_JSON")
DB_PASS=$(jq -r .password <<< "$SECRET_JSON")
DB_HOST=$(jq -r .host <<< "$SECRET_JSON")
MONGODB_URI="mongodb://$DB_USER:$DB_PASS@$DB_HOST:27017/?tls=true&tlsCAFile=global-bundle.pem&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false"
echo "MONGODB_URI=$MONGODB_URI" >> /home/ec2-user/Cloud-Web-Service/.env
#Create and start service
cat <<EOT | sudo tee /etc/systemd/system/clouddrive.service
[Unit]
Description=Cloud Drive Node.js Server
After=network.target
[Service]
User=ec2-user
WorkingDirectory=/home/ec2-user/Cloud-Web-Service
ExecStart=/usr/bin/node /home/ec2-user/Cloud-Web-Service/server.js
Restart=always
EnvironmentFile=/home/ec2-user/Cloud-Web-Service/.env
Environment=PATH=/usr/bin:/usr/local/bin
Environment=NODE_ENV=production
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=true
[Install]
WantedBy=multi-user.target
EOT

sudo systemctl daemon-reload
sudo systemctl enable clouddrive
sudo systemctl start clouddrive
sudo chown -R ec2-user:ec2-user /home/ec2-user/Cloud-Web-Service

EOF
  )

  network_interfaces {
    associate_public_ip_address = true
    security_groups             = [aws_security_group.cloud_drive_sg.id]
  }

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "WebServer-ASG"
    }
  }
}
# --- Load Balancing and Auto Scaling ---
resource "aws_lb_target_group" "web_tg" {
  name        = "web-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = aws_vpc.cloud_drive.id
  target_type = "instance"
}

resource "aws_lb" "web_alb" {
  name               = "web-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.cloud_drive_sg.id]
  subnets = [
    aws_subnet.public1.id,
    aws_subnet.public2.id,
    aws_subnet.public3.id
  ]
  tags = {
    Name = "WebALB"
  }
}

resource "aws_lb_listener" "web_listener" {
  load_balancer_arn = aws_lb.web_alb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web_tg.arn
  }
}

resource "aws_autoscaling_group" "web_asg" {
  name                = "web-asg"
  max_size            = 4
  min_size            = 2
  desired_capacity    = 2
  vpc_zone_identifier = [
    aws_subnet.public1.id,
    aws_subnet.public2.id,
    aws_subnet.public3.id
  ]
  target_group_arns = [aws_lb_target_group.web_tg.arn]
  health_check_type = "EC2"

  launch_template {
    id      = aws_launch_template.web_launch_template.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "WebASGInstance"
    propagate_at_launch = true
  }

  lifecycle {
    create_before_destroy = true
  }
}

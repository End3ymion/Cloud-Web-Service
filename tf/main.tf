# === Security Group ====
resource "aws_security_group" "cloud_drive_sg" {
  name        = "cloud-drive-sg"
  description = "Security group for cloud-drive instances"
  vpc_id      = aws_vpc.cloud_drive.id

  # Inbound rules
  ingress {
    description      = "Allow SSH from anywhere"
    from_port        = 22
    to_port          = 22
    protocol         = "tcp"
    cidr_blocks      = ["0.0.0.0/0"] # Replace with your IP for more security
  }

  ingress {
    description      = "Allow HTTP from anywhere"
    from_port        = 80
    to_port          = 80
    protocol         = "tcp"
    cidr_blocks      = ["0.0.0.0/0"]
  }

  # Outbound rules
  egress {
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
    description      = "Allow all outbound traffic"
  }

  tags = {
    Name = "cloud-drive-sg"
  }
}

resource "aws_launch_template" "web_launch_template" {
  name_prefix   = "web-launch-"
  image_id      = "ami-0a3ece531caa5d49d" # Amazon Linux 2 AMI
  instance_type = "t2.micro"
  key_name      = var.key_name

user_data = base64encode(<<EOF
#!/bin/bash
# Update system
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

# Clone repository
git clone https://github.com/End3ymion/Cloud-Web-Service.git /home/ec2-user/Cloud-Web-Service
cd /home/ec2-user/Cloud-Web-Service

# Install npm dependencies
npm install

# Download global-bundle.pem
wget https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -O /home/ec2-user/Cloud-Web-Service/global-bundle.pem

# Download secrets from S3
aws s3 cp s3://my-bucket-test-168/.env /home/ec2-user/Cloud-Web-Service/.env

# Create systemd service
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

# Reload and start service
sudo systemctl daemon-reload
sudo systemctl enable clouddrive
sudo systemctl start clouddrive

# Fix permissions
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


# === Target Group ===
resource "aws_lb_target_group" "web_tg" {
  name        = "web-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = aws_vpc.cloud_drive.id
  target_type = "instance"
}

# === Load Balancer (ALB) ===
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

# === Listener ===
resource "aws_lb_listener" "web_listener" {
  load_balancer_arn = aws_lb.web_alb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web_tg.arn
  }
}

# === Auto Scaling Group ===
resource "aws_autoscaling_group" "web_asg" {
  name                      = "web-asg"
  max_size                  = 4
  min_size                  = 2
  desired_capacity          = 2
  vpc_zone_identifier       = [
    aws_subnet.public1.id,
    aws_subnet.public2.id,
    aws_subnet.public3.id
  ]
  target_group_arns         = [aws_lb_target_group.web_tg.arn]
  health_check_type         = "EC2"

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

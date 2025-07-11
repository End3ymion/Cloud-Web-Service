# === Launch Template ===
resource "aws_launch_template" "web_launch_template" {
  name_prefix   = "web-launch-"
  image_id      = "ami-0a3ece531caa5d49d" # Replace with latest valid AMI in ap-southeast-1
  instance_type = "t2.micro"
  key_name      = var.key_name

  network_interfaces {
    associate_public_ip_address = true
    security_groups             = [var.custom_sg_id]
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
  security_groups    = [var.custom_sg_id]
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

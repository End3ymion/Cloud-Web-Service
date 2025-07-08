# ## This Terraform configuration sets up an AWS environment for hosting a website.

# resource "aws_instance" "web_instance" {
#   ami           = "ami-0a3ece531caa5d49d"
#   instance_type = "t2.micro"
#   key_name      = var.key_name

#   subnet_id              = var.subnet_id
#   vpc_security_group_ids = [var.security_group_id]

#   associate_public_ip_address = true

#   credit_specification {
#     cpu_credits = "standard"
#   }

#   metadata_options {
#     http_endpoint               = "enabled"
#     http_tokens                 = "required"
#     http_put_response_hop_limit = 2
#   }

#   private_dns_name_options {
#     hostname_type                        = "ip-name"
#     enable_resource_name_dns_a_record    = true
#     enable_resource_name_dns_aaaa_record = false
#   }

#   tags = {
#     Name = "hosting website"
#   }
# }

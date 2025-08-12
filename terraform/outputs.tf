# Terraform Outputs for AP_Tool_V1 Infrastructure
# Provides access to key infrastructure resource identifiers and endpoints

# ============================================================================
# Application Endpoints
# ============================================================================

output "application_url" {
  description = "Application URL"
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "https://${module.alb.dns_name}"
}

output "load_balancer_dns" {
  description = "Load balancer DNS name"
  value       = module.alb.dns_name
}

output "load_balancer_zone_id" {
  description = "Load balancer zone ID for Route 53"
  value       = module.alb.zone_id
}

# ============================================================================
# Network Infrastructure
# ============================================================================

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "vpc_cidr" {
  description = "VPC CIDR block"
  value       = module.vpc.vpc_cidr
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = module.vpc.private_subnet_ids
}

output "database_subnet_ids" {
  description = "Database subnet IDs"
  value       = module.vpc.database_subnet_ids
}

# ============================================================================
# Security Groups
# ============================================================================

output "alb_security_group_id" {
  description = "Application Load Balancer security group ID"
  value       = module.security_groups.alb_security_group_id
}

output "ecs_security_group_id" {
  description = "ECS Fargate security group ID"
  value       = module.security_groups.ecs_security_group_id
}

output "rds_security_group_id" {
  description = "RDS security group ID"
  value       = module.security_groups.rds_security_group_id
}

# ============================================================================
# ECS Fargate Resources
# ============================================================================

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.ecs.cluster_name
}

output "ecs_cluster_arn" {
  description = "ECS cluster ARN"
  value       = module.ecs.cluster_arn
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = module.ecs.service_name
}

output "ecs_service_arn" {
  description = "ECS service ARN"
  value       = module.ecs.service_arn
}

output "ecs_task_definition_arn" {
  description = "ECS task definition ARN"
  value       = module.ecs.task_definition_arn
}

# ============================================================================
# Database Resources
# ============================================================================

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.endpoint
  sensitive   = true
}

output "rds_port" {
  description = "RDS port"
  value       = module.rds.port
}

output "rds_instance_identifier" {
  description = "RDS instance identifier"
  value       = module.rds.instance_identifier
}

output "database_name" {
  description = "Database name"
  value       = module.rds.database_name
}

# ============================================================================
# Cache Resources
# ============================================================================

output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = module.redis.endpoint
  sensitive   = true
}

output "redis_port" {
  description = "Redis port"
  value       = module.redis.port
}

# ============================================================================
# Storage Resources
# ============================================================================

output "backup_bucket_name" {
  description = "S3 backup bucket name"
  value       = module.s3.backup_bucket_name
}

output "backup_bucket_arn" {
  description = "S3 backup bucket ARN"
  value       = module.s3.backup_bucket_arn
}

output "assets_bucket_name" {
  description = "S3 assets bucket name"
  value       = module.s3.assets_bucket_name
}

output "assets_bucket_arn" {
  description = "S3 assets bucket ARN"
  value       = module.s3.assets_bucket_arn
}

# ============================================================================
# Monitoring Resources
# ============================================================================

output "cloudwatch_log_group_name" {
  description = "CloudWatch log group name"
  value       = module.ecs.log_group_name
}

output "cloudwatch_log_group_arn" {
  description = "CloudWatch log group ARN"
  value       = module.ecs.log_group_arn
}

output "sns_topic_arn" {
  description = "SNS topic ARN for alerts"
  value       = module.monitoring.sns_topic_arn
}

# ============================================================================
# Security Resources
# ============================================================================

output "waf_web_acl_arn" {
  description = "WAF Web ACL ARN"
  value       = module.waf.web_acl_arn
}

output "waf_web_acl_id" {
  description = "WAF Web ACL ID"
  value       = module.waf.web_acl_id
}

# ============================================================================
# IAM Resources
# ============================================================================

output "ecs_task_role_arn" {
  description = "ECS task role ARN"
  value       = module.iam.ecs_task_role_arn
}

output "ecs_execution_role_arn" {
  description = "ECS execution role ARN"
  value       = module.iam.ecs_execution_role_arn
}

# ============================================================================
# DNS Resources (if configured)
# ============================================================================

output "route53_zone_id" {
  description = "Route 53 hosted zone ID"
  value       = length(module.dns) > 0 ? module.dns[0].zone_id : null
}

# ============================================================================
# Educational Institution Specific Outputs
# ============================================================================

output "ferpa_compliance_status" {
  description = "FERPA compliance configuration status"
  value = {
    encryption_enabled        = var.enable_encryption
    deletion_protection      = var.enable_deletion_protection
    audit_logging_enabled    = true
    data_residency_region    = var.data_residency_region
    backup_retention_years   = floor(var.common_tags.BackupRequired == "true" ? 2555 / 365 : 0)
    waf_protection_enabled   = true
    network_isolation        = "enabled"
  }
}

output "monitoring_endpoints" {
  description = "Monitoring and observability endpoints"
  value = {
    cloudwatch_dashboard = "https://console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${var.project_name}-${var.environment}"
    alb_metrics         = "https://console.aws.amazon.com/ec2/v2/home?region=${var.aws_region}#LoadBalancers:sort=loadBalancerName"
    ecs_metrics         = "https://console.aws.amazon.com/ecs/home?region=${var.aws_region}#/clusters/${module.ecs.cluster_name}/services"
    rds_metrics         = "https://console.aws.amazon.com/rds/home?region=${var.aws_region}#database:id=${module.rds.instance_identifier}"
  }
}

# ============================================================================
# Connection Information (Sensitive)
# ============================================================================

output "database_connection_info" {
  description = "Database connection information for application configuration"
  value = {
    host     = module.rds.endpoint
    port     = module.rds.port
    database = module.rds.database_name
    username = "attendly_admin"
    # Password is stored in AWS Systems Manager Parameter Store
    password_parameter = "/attendly/${var.environment}/database/password"
  }
  sensitive = true
}

output "redis_connection_info" {
  description = "Redis connection information"
  value = {
    host = module.redis.endpoint
    port = module.redis.port
  }
  sensitive = true
}

# ============================================================================
# Deployment Information
# ============================================================================

output "deployment_info" {
  description = "Information needed for deployment scripts"
  value = {
    region                = var.aws_region
    ecs_cluster           = module.ecs.cluster_name
    ecs_service           = module.ecs.service_name
    task_definition_family = "${var.project_name}-${var.environment}"
    container_name        = "${var.project_name}-app"
    log_group             = module.ecs.log_group_name
    environment           = var.environment
  }
}
# Main Terraform Configuration for AP_Tool_V1
# FERPA-compliant educational technology infrastructure
# Implements security-first design with comprehensive monitoring

terraform {
  required_version = ">= 1.5"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.4"
    }
  }

  # Configure remote state backend
  backend "s3" {
    # Bucket and key should be configured via backend config file
    # Example: terraform init -backend-config=backend.conf
    encrypt = true
    # bucket = "attendly-terraform-state-prod"
    # key    = "ap-tool-v1/terraform.tfstate"
    # region = "us-west-2"
    # dynamodb_table = "attendly-terraform-locks"
  }
}

# Configure AWS Provider
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = var.common_tags
  }
}

# ============================================================================
# Data Sources
# ============================================================================

data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ssm_parameter" "db_password" {
  name            = "/attendly/${var.environment}/database/password"
  with_decryption = true
}

data "aws_ssm_parameter" "supabase_service_key" {
  name            = "/attendly/${var.environment}/supabase/service-key"
  with_decryption = true
}

# ============================================================================
# Random Password Generation
# ============================================================================

resource "random_password" "db_password" {
  length  = 32
  special = true
  lifecycle {
    ignore_changes = [length, special]
  }
}

# ============================================================================
# VPC and Network Infrastructure
# ============================================================================

module "vpc" {
  source = "./modules/vpc"
  
  project_name           = var.project_name
  environment           = var.environment
  vpc_cidr              = var.vpc_cidr
  availability_zones    = var.availability_zones
  public_subnet_cidrs   = var.public_subnet_cidrs
  private_subnet_cidrs  = var.private_subnet_cidrs
  database_subnet_cidrs = var.database_subnet_cidrs
  
  enable_nat_gateway = true
  enable_vpn_gateway = false
  enable_dns_hostnames = true
  enable_dns_support = true
  
  tags = var.common_tags
}

# ============================================================================
# Security Groups
# ============================================================================

module "security_groups" {
  source = "./modules/security"
  
  project_name    = var.project_name
  environment     = var.environment
  vpc_id          = module.vpc.vpc_id
  vpc_cidr        = var.vpc_cidr
  allowed_cidrs   = var.allowed_cidr_blocks
  office_ip_ranges = var.office_ip_ranges
  
  tags = var.common_tags
}

# ============================================================================
# Application Load Balancer
# ============================================================================

module "alb" {
  source = "./modules/alb"
  
  project_name         = var.project_name
  environment         = var.environment
  vpc_id              = module.vpc.vpc_id
  public_subnet_ids   = module.vpc.public_subnet_ids
  security_group_id   = module.security_groups.alb_security_group_id
  ssl_certificate_arn = var.ssl_certificate_arn
  
  tags = var.common_tags
}

# ============================================================================
# ECS Fargate Cluster and Service
# ============================================================================

module "ecs" {
  source = "./modules/ecs"
  
  project_name      = var.project_name
  environment       = var.environment
  vpc_id            = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  
  # Application configuration
  app_image        = var.app_image
  app_port         = var.app_port
  app_cpu          = var.app_cpu
  app_memory       = var.app_memory
  desired_count    = var.app_desired_count
  min_capacity     = var.app_min_capacity
  max_capacity     = var.app_max_capacity
  
  # Load balancer integration
  target_group_arn = module.alb.target_group_arn
  security_group_id = module.security_groups.ecs_security_group_id
  
  # Environment variables
  environment_variables = {
    NODE_ENV                    = "production"
    DATABASE_URL               = module.rds.connection_string
    NEXT_PUBLIC_SUPABASE_URL   = "/attendly/${var.environment}/supabase/url"
    NEXT_PUBLIC_SUPABASE_ANON_KEY = "/attendly/${var.environment}/supabase/anon-key"
    SUPABASE_SERVICE_ROLE_KEY  = "/attendly/${var.environment}/supabase/service-key"
    FERPA_COMPLIANCE_MODE      = "enabled"
    STUDENT_DATA_PROTECTION    = "enabled"
    SECURITY_LEVEL             = "OWASP_ASVS_L2"
    AWS_REGION                 = var.aws_region
    CLOUDWATCH_LOG_GROUP       = "/aws/ecs/${var.project_name}-${var.environment}"
  }
  
  # Logging configuration
  log_group_name    = "/aws/ecs/${var.project_name}-${var.environment}"
  log_retention_days = var.log_retention_days
  
  tags = var.common_tags
}

# ============================================================================
# RDS PostgreSQL Database
# ============================================================================

module "rds" {
  source = "./modules/rds"
  
  project_name               = var.project_name
  environment               = var.environment
  vpc_id                    = module.vpc.vpc_id
  database_subnet_ids       = module.vpc.database_subnet_ids
  security_group_id         = module.security_groups.rds_security_group_id
  
  # Database configuration
  instance_class            = var.db_instance_class
  allocated_storage         = var.db_allocated_storage
  max_allocated_storage     = var.db_max_allocated_storage
  engine_version           = var.db_engine_version
  backup_retention_period  = var.db_backup_retention_period
  backup_window           = var.db_backup_window
  maintenance_window      = var.db_maintenance_window
  
  # Security configuration
  enable_encryption       = var.enable_encryption
  enable_deletion_protection = var.enable_deletion_protection
  enable_monitoring      = var.enable_monitoring
  monitoring_interval    = var.monitoring_interval
  
  # Database credentials
  database_password = random_password.db_password.result
  
  tags = var.common_tags
}

# ============================================================================
# ElastiCache Redis Cluster
# ============================================================================

module "redis" {
  source = "./modules/redis"
  
  project_name        = var.project_name
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  security_group_id  = module.security_groups.redis_security_group_id
  
  node_type          = "cache.t3.micro"
  num_cache_nodes    = 1
  engine_version     = "7.0"
  
  enable_encryption_at_rest    = var.enable_encryption
  enable_encryption_in_transit = var.enable_encryption
  
  tags = var.common_tags
}

# ============================================================================
# CloudWatch Monitoring and Alerting
# ============================================================================

module "monitoring" {
  source = "./modules/monitoring"
  
  project_name  = var.project_name
  environment   = var.environment
  
  # ECS monitoring
  ecs_cluster_name = module.ecs.cluster_name
  ecs_service_name = module.ecs.service_name
  
  # RDS monitoring
  rds_instance_identifier = module.rds.instance_identifier
  
  # ALB monitoring
  alb_arn_suffix = module.alb.alb_arn_suffix
  target_group_arn_suffix = module.alb.target_group_arn_suffix
  
  # Notification configuration
  sns_email_endpoints = ["devops@attendly.com"]
  
  tags = var.common_tags
}

# ============================================================================
# WAF (Web Application Firewall)
# ============================================================================

module "waf" {
  source = "./modules/waf"
  
  project_name      = var.project_name
  environment       = var.environment
  alb_arn          = module.alb.alb_arn
  allowed_countries = ["US"] # Restrict to US for FERPA compliance
  
  # Educational institution specific rules
  enable_sql_injection_protection = true
  enable_xss_protection          = true
  enable_rate_limiting           = true
  
  # FERPA compliance rules
  block_non_us_requests = true
  enable_audit_logging  = true
  
  tags = var.common_tags
}

# ============================================================================
# Route 53 DNS (if managing DNS)
# ============================================================================

module "dns" {
  count  = var.domain_name != "" ? 1 : 0
  source = "./modules/dns"
  
  domain_name    = var.domain_name
  alb_dns_name   = module.alb.dns_name
  alb_zone_id    = module.alb.zone_id
  
  tags = var.common_tags
}

# ============================================================================
# S3 Buckets for Backups and Static Assets
# ============================================================================

module "s3" {
  source = "./modules/s3"
  
  project_name  = var.project_name
  environment   = var.environment
  
  # Backup configuration
  backup_retention_days = 2555 # 7 years for educational records
  storage_class        = var.backup_s3_storage_class
  
  # FERPA compliance
  enable_versioning    = true
  enable_encryption    = var.enable_encryption
  enable_access_logging = true
  block_public_access  = true
  
  tags = var.common_tags
}

# ============================================================================
# Systems Manager Parameters for Secrets
# ============================================================================

resource "aws_ssm_parameter" "db_password" {
  name  = "/attendly/${var.environment}/database/password"
  type  = "SecureString"
  value = random_password.db_password.result
  
  description = "Database password for ${var.project_name} ${var.environment}"
  
  tags = merge(var.common_tags, {
    Name = "${var.project_name}-${var.environment}-db-password"
  })
}

# ============================================================================
# IAM Roles and Policies
# ============================================================================

module "iam" {
  source = "./modules/iam"
  
  project_name = var.project_name
  environment  = var.environment
  
  # S3 bucket ARNs for access policies
  backup_bucket_arn = module.s3.backup_bucket_arn
  assets_bucket_arn = module.s3.assets_bucket_arn
  
  # CloudWatch log group ARN
  log_group_arn = module.ecs.log_group_arn
  
  tags = var.common_tags
}
# Terraform Variables for AP_Tool_V1 Infrastructure
# FERPA-compliant educational technology infrastructure
# Implements security-first design for student data protection

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "ap-tool-v1"
}

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-west-2"
}

variable "availability_zones" {
  description = "Availability zones for high availability"
  type        = list(string)
  default     = ["us-west-2a", "us-west-2b", "us-west-2c"]
}

# ============================================================================
# VPC & Networking Configuration
# ============================================================================

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.20.0/24", "10.0.30.0/24"]
}

variable "database_subnet_cidrs" {
  description = "CIDR blocks for database subnets"
  type        = list(string)
  default     = ["10.0.40.0/24", "10.0.50.0/24", "10.0.60.0/24"]
}

# ============================================================================
# ECS Fargate Configuration
# ============================================================================

variable "app_image" {
  description = "Docker image for the application"
  type        = string
  default     = "attendly/ap-tool-v1:latest"
}

variable "app_port" {
  description = "Port on which the application runs"
  type        = number
  default     = 3000
}

variable "app_cpu" {
  description = "CPU units for Fargate task (256, 512, 1024, 2048, 4096)"
  type        = number
  default     = 512
  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.app_cpu)
    error_message = "CPU must be one of: 256, 512, 1024, 2048, 4096."
  }
}

variable "app_memory" {
  description = "Memory for Fargate task (MB)"
  type        = number
  default     = 1024
}

variable "app_desired_count" {
  description = "Desired number of running tasks"
  type        = number
  default     = 2
}

variable "app_min_capacity" {
  description = "Minimum number of tasks for auto scaling"
  type        = number
  default     = 1
}

variable "app_max_capacity" {
  description = "Maximum number of tasks for auto scaling"
  type        = number
  default     = 10
}

# ============================================================================
# Database Configuration (RDS PostgreSQL)
# ============================================================================

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_allocated_storage" {
  description = "Allocated storage for RDS (GB)"
  type        = number
  default     = 100
}

variable "db_max_allocated_storage" {
  description = "Maximum allocated storage for RDS auto scaling (GB)"
  type        = number
  default     = 500
}

variable "db_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.4"
}

variable "db_backup_retention_period" {
  description = "Backup retention period (days)"
  type        = number
  default     = 30
}

variable "db_backup_window" {
  description = "Backup window (UTC)"
  type        = string
  default     = "03:00-04:00"
}

variable "db_maintenance_window" {
  description = "Maintenance window (UTC)"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

# ============================================================================
# Load Balancer Configuration
# ============================================================================

variable "ssl_certificate_arn" {
  description = "ARN of SSL certificate for HTTPS"
  type        = string
  default     = ""
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "ap-tool.attendly.com"
}

# ============================================================================
# Monitoring & Logging Configuration
# ============================================================================

variable "log_retention_days" {
  description = "CloudWatch log retention period (days)"
  type        = number
  default     = 30
}

variable "enable_monitoring" {
  description = "Enable enhanced monitoring"
  type        = bool
  default     = true
}

variable "monitoring_interval" {
  description = "Monitoring interval for RDS (seconds)"
  type        = number
  default     = 60
}

# ============================================================================
# Security Configuration
# ============================================================================

variable "enable_deletion_protection" {
  description = "Enable deletion protection for critical resources"
  type        = bool
  default     = true
}

variable "enable_encryption" {
  description = "Enable encryption at rest for all applicable resources"
  type        = bool
  default     = true
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access the load balancer"
  type        = list(string)
  default     = ["0.0.0.0/0"] # Restrict this in production
}

variable "office_ip_ranges" {
  description = "Office IP ranges for administrative access"
  type        = list(string)
  default     = [] # Add specific IP ranges for office access
}

# ============================================================================
# Educational Institution Configuration
# ============================================================================

variable "institution_name" {
  description = "Name of educational institution"
  type        = string
  default     = "Romoland School District"
}

variable "ferpa_compliance_mode" {
  description = "Enable FERPA compliance features"
  type        = bool
  default     = true
}

variable "data_residency_region" {
  description = "Data residency requirement region"
  type        = string
  default     = "us-west-2"
}

# ============================================================================
# Cost Optimization Configuration
# ============================================================================

variable "enable_spot_instances" {
  description = "Enable Spot instances for cost optimization (non-production)"
  type        = bool
  default     = false
}

variable "backup_s3_storage_class" {
  description = "S3 storage class for backups"
  type        = string
  default     = "STANDARD_IA"
  validation {
    condition     = contains(["STANDARD", "STANDARD_IA", "GLACIER"], var.backup_s3_storage_class)
    error_message = "Storage class must be one of: STANDARD, STANDARD_IA, GLACIER."
  }
}

# ============================================================================
# Tags for Resource Management
# ============================================================================

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default = {
    Project             = "AP_Tool_V1"
    Environment         = "prod"
    ManagedBy          = "Terraform"
    DataClassification = "Confidential"
    FERPACompliant     = "true"
    Institution        = "Romoland-School-District"
    CostCenter         = "IT-Educational-Technology"
    BackupRequired     = "true"
    MonitoringEnabled  = "true"
  }
}
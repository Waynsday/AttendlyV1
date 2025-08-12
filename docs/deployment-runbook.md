# Production Deployment Runbook for AP Tool V1

## Overview

This runbook provides step-by-step procedures for deploying and managing the AP Tool V1 in production environments. The system is designed for FERPA-compliant educational technology operations with comprehensive monitoring and security controls.

**System Architecture**: Next.js 15 + Supabase + AWS Fargate + Comprehensive Monitoring Stack

## Pre-Deployment Checklist

### Infrastructure Requirements
- [ ] AWS Account with appropriate permissions
- [ ] Supabase project with production configuration
- [ ] Domain name and SSL certificates
- [ ] GitHub repository with CI/CD workflows
- [ ] Monitoring stack (Prometheus, Grafana, AlertManager)

### Security Requirements
- [ ] FERPA compliance review completed
- [ ] Security scanning passed (SAST, DAST, Container)
- [ ] Penetration testing completed
- [ ] Data encryption validated (at rest and in transit)
- [ ] Access controls configured (RBAC, MFA)

### Educational Requirements
- [ ] Aeries API integration tested
- [ ] Student data protection verified
- [ ] Attendance sync workflows validated
- [ ] Recovery session scheduling tested
- [ ] Reporting functionality verified

## Deployment Process

### Phase 1: Infrastructure Deployment (30-45 minutes)

#### 1.1 Setup AWS Infrastructure
```bash
# Clone repository
git clone https://github.com/attendly/ap-tool-v1.git
cd ap-tool-v1

# Configure AWS credentials
aws configure set aws_access_key_id YOUR_ACCESS_KEY
aws configure set aws_secret_access_key YOUR_SECRET_KEY
aws configure set default.region us-west-2

# Initialize Terraform
cd terraform
terraform init -backend-config="bucket=attendly-terraform-state-prod" \
              -backend-config="key=ap-tool-v1/terraform.tfstate" \
              -backend-config="region=us-west-2" \
              -backend-config="dynamodb_table=attendly-terraform-locks"

# Plan infrastructure deployment
terraform plan -var="environment=prod" \
              -var="domain_name=ap-tool.romoland.k12.ca.us" \
              -var="ssl_certificate_arn=arn:aws:acm:us-west-2:ACCOUNT:certificate/CERT_ID" \
              -out=tfplan

# Apply infrastructure
terraform apply tfplan
```

#### 1.2 Configure Secrets
```bash
# Database password
aws ssm put-parameter \
  --name "/attendly/prod/database/password" \
  --value "$(openssl rand -base64 32)" \
  --type "SecureString" \
  --description "Production database password"

# Supabase service key
aws ssm put-parameter \
  --name "/attendly/prod/supabase/service-key" \
  --value "YOUR_SUPABASE_SERVICE_KEY" \
  --type "SecureString" \
  --description "Supabase service role key"

# Aeries API certificate
aws ssm put-parameter \
  --name "/attendly/prod/aeries/certificate" \
  --value "$(cat certs/aeries-client.crt)" \
  --type "SecureString" \
  --description "Aeries API client certificate"
```

### Phase 2: Application Deployment (15-20 minutes)

#### 2.1 Build and Push Docker Image
```bash
# Build production image
docker build -t attendly/ap-tool-v1:$(git rev-parse --short HEAD) .

# Tag for ECR
docker tag attendly/ap-tool-v1:$(git rev-parse --short HEAD) \
  123456789012.dkr.ecr.us-west-2.amazonaws.com/ap-tool-v1:latest

# Push to ECR
aws ecr get-login-password --region us-west-2 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.us-west-2.amazonaws.com

docker push 123456789012.dkr.ecr.us-west-2.amazonaws.com/ap-tool-v1:latest
```

#### 2.2 Deploy to ECS Fargate
```bash
# Update ECS service with new image
aws ecs update-service \
  --cluster ap-tool-v1-prod \
  --service ap-tool-v1-prod \
  --force-new-deployment

# Wait for deployment to complete
aws ecs wait services-stable \
  --cluster ap-tool-v1-prod \
  --services ap-tool-v1-prod
```

### Phase 3: Monitoring Setup (10-15 minutes)

#### 3.1 Deploy Monitoring Stack
```bash
# Deploy monitoring services
docker-compose -f docker-compose.prod.yml up -d prometheus grafana loki alertmanager

# Verify monitoring services
curl -f http://prometheus.ap-tool.internal:9090/-/healthy
curl -f http://grafana.ap-tool.internal:3000/api/health
```

#### 3.2 Import Dashboards
```bash
# Import AP Tool overview dashboard
curl -X POST \
  -H "Authorization: Bearer $GRAFANA_API_KEY" \
  -H "Content-Type: application/json" \
  -d @monitoring/grafana/dashboards/ap-tool-overview.json \
  http://grafana.ap-tool.internal:3000/api/dashboards/db

# Import educational metrics dashboard
curl -X POST \
  -H "Authorization: Bearer $GRAFANA_API_KEY" \
  -H "Content-Type: application/json" \
  -d @monitoring/grafana/dashboards/educational-metrics.json \
  http://grafana.ap-tool.internal:3000/api/dashboards/db
```

### Phase 4: Post-Deployment Validation (20-30 minutes)

#### 4.1 Health Checks
```bash
# Application health check
curl -f https://ap-tool.romoland.k12.ca.us/api/health

# Detailed health status
curl -s https://ap-tool.romoland.k12.ca.us/api/health | jq '.'

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2025-07-30T20:00:00.000Z",
#   "version": "1.0.0",
#   "environment": "production",
#   "database": "healthy",
#   "cache": "healthy",
#   "aeries_api": "healthy",
#   "supabase": "healthy",
#   "ferpa_compliance": "compliant",
#   "overall_status": "healthy"
# }
```

#### 4.2 FERPA Compliance Validation
```bash
# Verify student data protection
curl -s https://ap-tool.romoland.k12.ca.us/api/metrics | grep -E "ferpa|student_data"

# Expected metrics:
# ferpa_compliance_status 1
# ferpa_violation_total 0
# student_data_protection 1
```

#### 4.3 Educational Workflow Testing
```bash
# Test attendance data retrieval (no PII exposed)
curl -H "Authorization: Bearer $API_TOKEN" \
  https://ap-tool.romoland.k12.ca.us/api/attendance?aggregated=true

# Test recovery session scheduling
curl -X POST \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"school_id": 1, "date": "2025-07-31", "capacity": 25}' \
  https://ap-tool.romoland.k12.ca.us/api/recovery-sessions

# Test Aeries sync status
curl -H "Authorization: Bearer $API_TOKEN" \
  https://ap-tool.romoland.k12.ca.us/api/aeries/sync-status
```

## Monitoring and Alerting Configuration

### Key Metrics to Monitor

#### System Health
- Application uptime: `up{job="ap-tool-v1"}`
- Response time: `histogram_quantile(0.95, http_request_duration_ms_bucket)`
- Error rate: `rate(http_requests_total{status=~"5.."}[5m])`
- Memory usage: `memory_usage_bytes`
- CPU usage: `cpu_usage_percent`

#### Educational Metrics
- Attendance sync success: `aeries_sync_operations_total`
- Recovery sessions active: `recovery_sessions_active`
- FERPA compliance: `ferpa_compliance_status`
- Student data protection: `student_data_protection`

#### Security Metrics
- Failed login attempts: `failed_login_attempts_total`
- Unauthorized access: `unauthorized_access_attempts_total`
- Security alerts: `security_alert_total`

### Alert Thresholds

#### Critical Alerts (Immediate Response)
- FERPA violation: `> 0`
- Application down: `up == 0`
- High error rate: `> 5%`
- Database unavailable: `database_connections_active == 0`

#### Warning Alerts (15-minute Response)
- High response time: `> 2 seconds`
- High memory usage: `> 80%`
- High CPU usage: `> 80%`
- Sync errors: `> 3 in 1 hour`

## Operational Procedures

### Daily Operations

#### Morning Checklist (8:00 AM PST)
```bash
# Check system health
curl -f https://ap-tool.romoland.k12.ca.us/api/health

# Verify overnight Aeries sync
grep "sync_completed" /var/log/ap-tool/aeries-sync.log | tail -1

# Check for alerts
curl -s http://alertmanager.ap-tool.internal:9093/api/v1/alerts | \
  jq '.data[] | select(.state == "firing")'

# Review key metrics
curl -s https://ap-tool.romoland.k12.ca.us/api/metrics | \
  grep -E "attendance_rate|recovery_sessions|ferpa_compliance"
```

#### End of Day Checklist (4:00 PM PST)
```bash
# Verify attendance data completeness
curl -H "Authorization: Bearer $API_TOKEN" \
  "https://ap-tool.romoland.k12.ca.us/api/attendance/completeness?date=$(date +%Y-%m-%d)"

# Check intervention activities
curl -s https://ap-tool.romoland.k12.ca.us/api/metrics | \
  grep -E "truancy_letters|sarb_referrals|recovery_sessions_scheduled"

# Backup critical data
./scripts/backup/daily-backup.sh
```

### Weekly Operations

#### Monday Morning Review
- Review weekly attendance trends
- Check system performance metrics
- Validate FERPA compliance status
- Review security incident logs
- Plan capacity for the week

#### Friday Afternoon Maintenance
- Update system documentation
- Review and rotate log files
- Check SSL certificate status
- Validate backup integrity
- Plan weekend maintenance if needed

### Monthly Operations

#### Security Review
- Audit user access permissions
- Review security incident reports
- Update security configurations
- Penetration testing review
- FERPA compliance audit

#### Performance Review
- Analyze system performance trends
- Review capacity planning metrics
- Update performance baselines
- Optimize database queries
- Plan infrastructure scaling

## Troubleshooting Guide

### Common Issues

#### Application Won't Start
```bash
# Check ECS service status
aws ecs describe-services --cluster ap-tool-v1-prod --services ap-tool-v1-prod

# Check CloudWatch logs
aws logs tail /aws/ecs/ap-tool-v1-prod --follow

# Common fixes:
# 1. Environment variables missing
# 2. Database connection failure
# 3. SSL certificate issues
# 4. Resource limits exceeded
```

#### High Response Times
```bash
# Check database performance
curl -s https://ap-tool.romoland.k12.ca.us/api/health | jq '.database_response_time_ms'

# Check for slow queries
grep "slow query" /var/log/postgresql/postgresql.log

# Check system resources
curl -s https://ap-tool.romoland.k12.ca.us/api/metrics | grep -E "memory_usage|cpu_usage"

# Common fixes:
# 1. Database query optimization
# 2. Increase ECS task resources
# 3. Add database connection pooling
# 4. Implement caching
```

#### Aeries Sync Failures
```bash
# Check Aeries API status
curl -f https://romolandapi.aeries.net/admin/api/v5/ping

# Check certificate validity
openssl x509 -in certs/aeries-client.crt -text -noout | grep "Not After"

# Check sync logs
tail -f /var/log/ap-tool/aeries-sync.log

# Common fixes:
# 1. Renew API certificate
# 2. Check API rate limits
# 3. Validate API permissions
# 4. Review network connectivity
```

### Emergency Procedures

#### FERPA Violation Detected
1. **Immediate**: Isolate affected systems
2. **Within 5 minutes**: Notify compliance officer
3. **Within 15 minutes**: Secure all student data
4. **Within 30 minutes**: Begin incident investigation
5. **Within 1 hour**: Document violation details
6. **Within 24 hours**: Complete incident report

#### Security Breach
1. **Immediate**: Activate incident response team
2. **Within 2 minutes**: Isolate compromised systems
3. **Within 5 minutes**: Preserve forensic evidence
4. **Within 15 minutes**: Assess breach scope
5. **Within 30 minutes**: Notify stakeholders
6. **Within 2 hours**: Begin recovery procedures

#### System Outage During School Hours
1. **Immediate**: Assess outage scope
2. **Within 5 minutes**: Notify school administrators
3. **Within 10 minutes**: Implement workaround procedures
4. **Within 15 minutes**: Begin recovery procedures
5. **Within 30 minutes**: Provide status updates
6. **Within 2 hours**: Complete system restoration

## Performance Optimization

### Database Optimization
```sql
-- Analyze query performance
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;

-- Optimize attendance queries
CREATE INDEX CONCURRENTLY idx_attendance_school_date 
ON attendance_records(school_id, attendance_date);

-- Optimize student lookup
CREATE INDEX CONCURRENTLY idx_students_active 
ON students(school_id, active) WHERE active = true;
```

### Application Optimization
```bash
# Enable gzip compression
# Add to nginx.conf or ALB configuration
gzip on;
gzip_types text/plain application/json application/javascript text/css;

# Optimize Docker image
# Multi-stage build with minimal runtime dependencies
# See Dockerfile for implementation

# Configure caching
# Redis for session storage and query caching
# CDN for static assets
```

### Infrastructure Scaling
```bash
# Scale ECS service
aws ecs update-service \
  --cluster ap-tool-v1-prod \
  --service ap-tool-v1-prod \
  --desired-count 4

# Scale database
# Upgrade RDS instance class via AWS console
# Or use Aurora Auto Scaling

# Scale monitoring
# Increase Prometheus retention
# Add Grafana read replicas
```

## Maintenance Windows

### Monthly Maintenance (First Saturday of Month, 6 PM - 10 PM PST)

#### Pre-Maintenance
- [ ] Notify stakeholders 48 hours in advance
- [ ] Create complete system backup
- [ ] Prepare rollback procedures
- [ ] Test maintenance steps in staging

#### Maintenance Activities
- [ ] Apply security updates
- [ ] Update application dependencies
- [ ] Optimize database performance
- [ ] Rotate SSL certificates
- [ ] Update monitoring configurations

#### Post-Maintenance
- [ ] Verify system functionality
- [ ] Run performance tests
- [ ] Update documentation
- [ ] Notify stakeholders of completion

### Emergency Maintenance

#### Criteria for Emergency Maintenance
- Critical security vulnerability
- FERPA compliance violation
- System outage > 2 hours
- Data corruption detected

#### Emergency Procedures
1. **Assessment** (15 minutes): Evaluate impact and urgency
2. **Approval** (15 minutes): Get emergency change approval
3. **Implementation** (Variable): Execute emergency fix
4. **Validation** (30 minutes): Verify fix and system stability
5. **Communication** (15 minutes): Notify all stakeholders

## Contact Information

### On-Call Rotation
- **Primary**: DevOps Engineer (24/7)
- **Secondary**: Lead Developer (Business Hours)
- **Escalation**: CTO/IT Director

### Emergency Contacts
- **FERPA Compliance Officer**: compliance@romoland.k12.ca.us
- **Security Team**: security@romoland.k12.ca.us
- **District IT**: it-support@romoland.k12.ca.us
- **Superintendent Office**: superintendent@romoland.k12.ca.us

### Vendor Support
- **AWS Support**: Enterprise 24/7 Support
- **Supabase Support**: Pro Plan Support
- **Grafana Support**: Cloud Support

---

**Document Version**: 1.0  
**Last Updated**: July 30, 2025  
**Next Review**: October 30, 2025  
**Owner**: DevOps Team  
**Approved By**: CTO/IT Director
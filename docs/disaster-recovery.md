# Disaster Recovery Plan for AP Tool V1

## Executive Summary

This document outlines the disaster recovery procedures for the AP Tool V1 educational attendance management system. The plan is designed to ensure FERPA compliance and minimal disruption to educational services while maintaining the integrity and security of student data.

**Recovery Time Objective (RTO):** 4 hours  
**Recovery Point Objective (RPO):** 1 hour  
**Maximum Acceptable Downtime:** 8 hours during school hours

## 1. System Architecture Overview

### 1.1 Production Environment Components
- **Application**: Next.js 15 on AWS Fargate
- **Database**: Supabase PostgreSQL with encryption at rest
- **Load Balancer**: AWS Application Load Balancer
- **CDN**: CloudFront (if applicable)
- **Monitoring**: Prometheus, Grafana, CloudWatch
- **Secrets**: AWS Systems Manager Parameter Store

### 1.2 Data Classification
- **Confidential**: Student attendance records, PII data
- **Internal**: Teacher assignments, school configurations
- **Public**: System health metrics, general documentation

## 2. Backup Strategy

### 2.1 Database Backups
- **Automated Daily Backups**: Supabase Point-in-Time Recovery (PITR)
- **Retention Period**: 30 days for operational recovery, 7 years for educational compliance
- **Cross-Region Replication**: Secondary region (us-east-1) for disaster recovery
- **Backup Verification**: Daily automated backup integrity checks

### 2.2 Application Backups
- **Container Images**: Stored in Amazon ECR with versioning
- **Configuration**: Infrastructure as Code (Terraform) in Git
- **Secrets**: AWS Systems Manager Parameter Store with encryption

### 2.3 Critical Data Exports
```bash
# Daily educational data export (FERPA-compliant)
# Run at 2 AM Pacific Time
./scripts/backup/export-critical-data.sh
```

## 3. Disaster Scenarios and Response

### 3.1 Scenario 1: Database Failure

**Detection**: 
- Health check failures
- Database connection timeouts
- Prometheus alerts

**Response Procedure**:
1. **Immediate (0-15 minutes)**:
   ```bash
   # Check database status
   curl -f https://app.attendly.com/api/health
   
   # Verify Supabase dashboard
   # Navigate to Supabase project dashboard
   ```

2. **Short-term Recovery (15-60 minutes)**:
   ```bash
   # Enable read-only mode
   kubectl patch deployment ap-tool-v1 -p '{"spec":{"template":{"metadata":{"labels":{"maintenance":"true"}}}}}'
   
   # Restore from latest backup
   supabase db reset --db-url $RECOVERY_DATABASE_URL
   ```

3. **Full Recovery (1-4 hours)**:
   - Restore from point-in-time backup
   - Verify data integrity
   - Run post-recovery validation scripts

### 3.2 Scenario 2: Application Failure

**Detection**:
- Load balancer health check failures
- Application metrics showing 0 healthy instances
- User reports of inaccessible system

**Response Procedure**:
1. **Immediate (0-5 minutes)**:
   ```bash
   # Check ECS service status
   aws ecs describe-services --cluster ap-tool-v1-prod --services ap-tool-v1-prod
   
   # Review CloudWatch logs
   aws logs tail /aws/ecs/ap-tool-v1-prod --follow
   ```

2. **Rollback (5-15 minutes)**:
   ```bash
   # Rollback to previous stable version
   aws ecs update-service \
     --cluster ap-tool-v1-prod \
     --service ap-tool-v1-prod \
     --task-definition ap-tool-v1-prod:PREVIOUS_REVISION
   ```

### 3.3 Scenario 3: Complete AWS Region Failure

**Detection**:
- Multiple AWS service outages
- Region-wide connectivity issues
- Cross-region monitoring alerts

**Response Procedure**:
1. **Activate DR Region (0-30 minutes)**:
   ```bash
   # Switch to disaster recovery region
   export AWS_DEFAULT_REGION=us-east-1
   
   # Deploy infrastructure in DR region
   cd terraform/disaster-recovery
   terraform apply -auto-approve
   ```

2. **Data Recovery (30-120 minutes)**:
   ```bash
   # Restore from cross-region backup
   ./scripts/disaster-recovery/restore-from-cross-region.sh
   
   # Validate data integrity
   ./scripts/disaster-recovery/validate-data-integrity.sh
   ```

3. **DNS Failover (2-4 hours)**:
   ```bash
   # Update Route 53 records to point to DR region
   aws route53 change-resource-record-sets \
     --hosted-zone-id Z123456789 \
     --change-batch file://dns-failover.json
   ```

## 4. Recovery Procedures

### 4.1 Database Recovery

#### 4.1.1 Point-in-Time Recovery
```sql
-- Restore to specific timestamp (FERPA compliance requires precision)
SELECT pg_create_restore_point('pre_disaster_recovery');

-- Restore from backup
pg_restore --clean --if-exists --verbose \
  --host=recovery-db.supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=attendly_recovery \
  backup_file.sql
```

#### 4.1.2 Data Validation Post-Recovery
```sql
-- Verify critical educational data integrity
SELECT 
  COUNT(*) as total_students,
  COUNT(DISTINCT school_id) as total_schools,
  MAX(created_at) as latest_record
FROM students;

-- Check attendance data completeness
SELECT 
  school_year,
  COUNT(*) as attendance_records,
  MIN(attendance_date) as earliest_date,
  MAX(attendance_date) as latest_date
FROM attendance_records 
WHERE school_year = '2024-2025'
GROUP BY school_year;
```

### 4.2 Application Recovery

#### 4.2.1 Container Deployment
```bash
# Deploy specific version for recovery
docker run -d \
  --name ap-tool-recovery \
  --env-file .env.recovery \
  -p 3000:3000 \
  attendly/ap-tool-v1:stable-20240730-abc123f

# Verify health
curl -f http://localhost:3000/api/health
```

#### 4.2.2 Configuration Recovery
```bash
# Restore environment variables from backup
aws ssm get-parameters-by-path \
  --path "/attendly/recovery/" \
  --recursive \
  --with-decryption > recovery-config.json

# Apply configuration
./scripts/recovery/apply-config.sh recovery-config.json
```

## 5. FERPA Compliance During Recovery

### 5.1 Data Protection Requirements
- All recovery operations must maintain encryption at rest and in transit
- Access to student data during recovery must be logged and audited
- Recovery procedures must not expose PII in logs or temporary files

### 5.2 Compliance Checklist
- [ ] Recovery environment has same security controls as production
- [ ] All recovery actions are logged with timestamps and user identification
- [ ] Student data access is limited to authorized personnel only
- [ ] Recovery systems are isolated from non-educational uses
- [ ] Data validation confirms no student records were corrupted or lost

### 5.3 Privacy Protection Script
```bash
#!/bin/bash
# Privacy protection during recovery
set -e

echo "Starting FERPA-compliant recovery process..."

# Ensure secure environment
export FERPA_COMPLIANCE_MODE=enabled
export STUDENT_DATA_PROTECTION=enabled
export RECOVERY_AUDIT_LOG=/secure/logs/recovery-$(date +%Y%m%d-%H%M%S).log

# Log all operations
exec > >(tee -a $RECOVERY_AUDIT_LOG)
exec 2>&1

echo "Recovery initiated by: $(whoami)"
echo "Recovery timestamp: $(date -u)"
echo "Recovery environment: PRODUCTION-DR"

# Verify security controls
./scripts/security/verify-ferpa-compliance.sh

echo "FERPA compliance verified. Proceeding with recovery..."
```

## 6. Communication Plan

### 6.1 Notification Hierarchy
1. **Immediate Notification (0-15 minutes)**:
   - DevOps Team Lead
   - CTO/IT Director
   - Database Administrator

2. **School Administration (15-30 minutes)**:
   - District IT Coordinator
   - Assistant Principals
   - School Administrative Staff

3. **Stakeholder Communication (30-60 minutes)**:
   - Teachers (if during school hours)
   - District Administration
   - External support teams

### 6.2 Communication Templates

#### 6.2.1 Initial Incident Notification
```
Subject: [URGENT] AP Tool System Incident - Recovery in Progress

Dear Team,

We are currently experiencing technical difficulties with the AP Tool attendance management system. Our technical team has been notified and recovery procedures are underway.

Estimated Resolution Time: [X] hours
Impact: [Description of impact]
Workaround: [If available]

We will provide updates every 30 minutes until resolution.

Student data remains secure and FERPA compliant throughout this incident.

AP Tool DevOps Team
```

#### 6.2.2 Recovery Complete Notification
```
Subject: [RESOLVED] AP Tool System Restored - Full Service Available

Dear Team,

The AP Tool attendance management system has been fully restored and is operating normally.

Resolution Time: [X] hours [X] minutes
Root Cause: [Brief description]
Preventive Measures: [Actions taken to prevent recurrence]

All student data integrity has been verified and remains FERPA compliant.

Thank you for your patience during this incident.

AP Tool DevOps Team
```

## 7. Testing and Validation

### 7.1 Disaster Recovery Testing Schedule
- **Monthly**: Backup restoration testing
- **Quarterly**: Full disaster recovery simulation
- **Annually**: Multi-region failover testing

### 7.2 Test Scenarios
1. **Database corruption recovery**
2. **Application deployment rollback**
3. **Cross-region failover**
4. **Security incident response**

### 7.3 Test Validation Checklist
- [ ] All critical functionality restored
- [ ] Student data integrity maintained
- [ ] FERPA compliance verified
- [ ] Performance meets baseline requirements
- [ ] Security controls operational
- [ ] Monitoring and alerting functional

## 8. Recovery Scripts

### 8.1 Automated Recovery Script
```bash
#!/bin/bash
# automated-recovery.sh
# FERPA-compliant disaster recovery automation

set -euo pipefail

# Configuration
RECOVERY_TYPE=${1:-"application"}
BACKUP_TIMESTAMP=${2:-"latest"}
DRY_RUN=${3:-"false"}

# Logging
RECOVERY_LOG="/var/log/ap-tool/recovery-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$RECOVERY_LOG")
exec 2>&1

echo "=== AP Tool V1 Disaster Recovery ==="
echo "Recovery Type: $RECOVERY_TYPE"
echo "Backup Timestamp: $BACKUP_TIMESTAMP"
echo "Dry Run: $DRY_RUN"
echo "Started: $(date -u)"
echo

# FERPA compliance check
if [[ "$FERPA_COMPLIANCE_MODE" != "enabled" ]]; then
    echo "ERROR: FERPA compliance mode not enabled. Aborting recovery."
    exit 1
fi

# Recovery procedures
case $RECOVERY_TYPE in
    "database")
        ./scripts/recovery/database-recovery.sh "$BACKUP_TIMESTAMP" "$DRY_RUN"
        ;;
    "application")
        ./scripts/recovery/application-recovery.sh "$BACKUP_TIMESTAMP" "$DRY_RUN"
        ;;
    "full")
        ./scripts/recovery/full-system-recovery.sh "$BACKUP_TIMESTAMP" "$DRY_RUN"
        ;;
    *)
        echo "ERROR: Unknown recovery type: $RECOVERY_TYPE"
        echo "Valid types: database, application, full"
        exit 1
        ;;
esac

echo
echo "Recovery completed: $(date -u)"
echo "Recovery log: $RECOVERY_LOG"
```

## 9. Post-Recovery Procedures

### 9.1 System Validation
1. **Health Checks**: Verify all health endpoints return healthy status
2. **Data Integrity**: Run data validation queries
3. **Performance Testing**: Confirm system meets performance baselines
4. **Security Validation**: Verify all security controls are operational

### 9.2 Educational Workflow Validation
```bash
# Validate critical educational workflows
./scripts/validation/test-attendance-workflow.sh
./scripts/validation/test-recovery-session-scheduling.sh
./scripts/validation/test-truancy-letter-generation.sh
./scripts/validation/test-sarb-referral-process.sh
```

### 9.3 Post-Incident Review
1. **Root Cause Analysis**: Within 24 hours
2. **Timeline Documentation**: Complete incident timeline
3. **Lessons Learned**: Identify improvement opportunities
4. **Process Updates**: Update procedures based on findings

## 10. Contact Information

### 10.1 Emergency Contacts
- **DevOps Team Lead**: [Phone] / [Email]
- **Database Administrator**: [Phone] / [Email]
- **Security Officer**: [Phone] / [Email]
- **District IT Coordinator**: [Phone] / [Email]

### 10.2 Vendor Support
- **AWS Support**: Enterprise Support (24/7)
- **Supabase Support**: Pro Plan Support
- **Third-party Monitoring**: Grafana Cloud Support

### 10.3 Escalation Matrix
- **Level 1**: DevOps Team (0-30 minutes)
- **Level 2**: IT Management (30-60 minutes)
- **Level 3**: District Administration (1-2 hours)
- **Level 4**: External Vendors (2+ hours)

---

**Document Version**: 1.0  
**Last Updated**: July 30, 2025  
**Next Review**: January 30, 2026  
**Owner**: DevOps Team Lead  
**Approved By**: CTO/IT Director
# AP Tool V1 - Enhanced Attendance Sync Deployment Guide

## Overview

This guide covers the deployment of the Enhanced Attendance Sync Service for production environments. The service synchronizes attendance data from Aeries SIS to Supabase with comprehensive error handling, security features, and monitoring.

## Prerequisites

### System Requirements
- Node.js 18+ with pnpm package manager
- Supabase project with proper schema
- Aeries SIS API access with certificates
- Docker (optional, for containerized deployment)
- SSL certificates for Aeries API authentication

### Required Environment Variables

Create a `.env.production` file with the following variables:

```bash
# Application Settings
NODE_ENV=production
PORT=3000

# Database Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Aeries SIS API Configuration
AERIES_API_BASE_URL=https://romolandapi.aeries.net/admin/api/v5
AERIES_API_KEY=your-aeries-api-key
AERIES_CLIENT_ID=your-client-id
AERIES_CLIENT_SECRET=your-client-secret
AERIES_DISTRICT_CODE=romoland

# Certificate Paths
AERIES_CERTIFICATE_PATH=/certs/aeries-client.crt
AERIES_PRIVATE_KEY_PATH=/certs/aeries-private.key
AERIES_CA_CERT_PATH=/certs/aeries-ca.crt

# Sync Configuration
AERIES_SYNC_ENABLED=true
AERIES_SYNC_SCHEDULE=0 1 * * *
AERIES_ATTENDANCE_START_DATE=2024-08-15
AERIES_ATTENDANCE_END_DATE=2025-06-12
AERIES_BATCH_SIZE=500
AERIES_RATE_LIMIT_PER_MINUTE=60

# Security Settings
ENCRYPTION_MASTER_PASSWORD=your-secure-master-password
ENCRYPTION_SALT=your-secure-salt
SESSION_SECRET=your-secure-session-secret
JWT_SECRET=your-secure-jwt-secret

# Monitoring and Logging
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=info
AUDIT_LOG_ENABLED=true

# FERPA Compliance
FERPA_COMPLIANCE_MODE=enabled
DATA_RETENTION_DAYS=2555
```

## Deployment Methods

### Method 1: Direct Node.js Deployment

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd AP_Tool_V1/ap-tool-v1
   pnpm install
   ```

2. **Build Application**
   ```bash
   pnpm build
   ```

3. **Setup Certificates**
   ```bash
   mkdir -p /etc/ap-tool/certs
   cp path/to/aeries-client.crt /etc/ap-tool/certs/
   cp path/to/aeries-private.key /etc/ap-tool/certs/
   cp path/to/aeries-ca.crt /etc/ap-tool/certs/
   chmod 600 /etc/ap-tool/certs/*
   ```

4. **Create Systemd Service**
   
   Create `/etc/systemd/system/ap-tool-sync.service`:
   ```ini
   [Unit]
   Description=AP Tool V1 Attendance Sync Service
   After=network.target
   Wants=network.target

   [Service]
   Type=simple
   User=ap-tool
   Group=ap-tool
   WorkingDirectory=/opt/ap-tool-v1
   Environment=NODE_ENV=production
   EnvironmentFile=/etc/ap-tool/.env.production
   ExecStart=/usr/bin/node dist/src/scripts/run-attendance-sync.js --full
   Restart=always
   RestartSec=10
   StandardOutput=journal
   StandardError=journal
   SyslogIdentifier=ap-tool-sync

   [Install]
   WantedBy=multi-user.target
   ```

5. **Enable and Start Service**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable ap-tool-sync
   sudo systemctl start ap-tool-sync
   ```

### Method 2: Docker Deployment

1. **Create Dockerfile**
   ```dockerfile
   FROM node:18-alpine AS builder

   WORKDIR /app
   COPY package*.json pnpm-lock.yaml ./
   RUN npm install -g pnpm && pnpm install --frozen-lockfile

   COPY . .
   RUN pnpm build

   FROM node:18-alpine AS runner

   RUN addgroup --system --gid 1001 nodejs
   RUN adduser --system --uid 1001 nextjs

   WORKDIR /app

   COPY --from=builder /app/dist ./dist
   COPY --from=builder /app/node_modules ./node_modules
   COPY --from=builder /app/package.json ./package.json

   # Create certs directory
   RUN mkdir -p /app/certs && chown nextjs:nodejs /app/certs

   USER nextjs

   EXPOSE 3000

   CMD ["node", "dist/src/scripts/run-attendance-sync.js", "--full"]
   ```

2. **Build and Run Container**
   ```bash
   docker build -t ap-tool-sync:latest .
   
   docker run -d \
     --name ap-tool-sync \
     --env-file .env.production \
     -v /path/to/certs:/app/certs:ro \
     -v /path/to/logs:/app/logs \
     --restart unless-stopped \
     ap-tool-sync:latest
   ```

### Method 3: Docker Compose Deployment

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  ap-tool-sync:
    build: .
    container_name: ap-tool-sync
    restart: unless-stopped
    env_file:
      - .env.production
    volumes:
      - ./certs:/app/certs:ro
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "node", "dist/src/scripts/health-check.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "5"

  prometheus:
    image: prom/prometheus:latest
    container_name: ap-tool-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'

  grafana:
    image: grafana/grafana:latest
    container_name: ap-tool-grafana
    ports:
      - "3001:3000"
    volumes:
      - grafana-data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin123

volumes:
  prometheus-data:
  grafana-data:
```

## Database Setup

### Supabase Schema Deployment

1. **Apply Schema Changes**
   ```bash
   # Copy the final schema to Supabase
   cat FINAL_supabase_schema.sql | pbcopy
   # Paste and execute in Supabase SQL Editor
   ```

2. **Configure Row Level Security**
   ```sql
   -- Enable RLS on sensitive tables
   ALTER TABLE students ENABLE ROW LEVEL SECURITY;
   ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
   
   -- Create policies for service role
   CREATE POLICY "Service role can manage students"
     ON students FOR ALL
     TO service_role
     USING (true);
   
   CREATE POLICY "Service role can manage attendance"
     ON attendance_records FOR ALL
     TO service_role
     USING (true);
   ```

3. **Create Indexes for Performance**
   ```sql
   -- Attendance sync performance indexes
   CREATE INDEX CONCURRENTLY idx_attendance_student_date 
     ON attendance_records(student_id, attendance_date);
   
   CREATE INDEX CONCURRENTLY idx_attendance_school_date 
     ON attendance_records(school_id, attendance_date);
   
   CREATE INDEX CONCURRENTLY idx_students_aeries_id 
     ON students(aeries_student_id);
   ```

## Monitoring Setup

### 1. Prometheus Configuration

Create `monitoring/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'ap-tool-sync'
    static_configs:
      - targets: ['ap-tool-sync:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### 2. Grafana Dashboard

Create dashboard configuration in `monitoring/grafana/dashboards/ap-tool-sync.json`:

```json
{
  "dashboard": {
    "id": null,
    "title": "AP Tool V1 - Attendance Sync",
    "tags": ["ap-tool", "attendance", "sync"],
    "panels": [
      {
        "title": "Sync Operations Status",
        "type": "stat",
        "targets": [
          {
            "expr": "sync_operations_total",
            "legendFormat": "Total Operations"
          }
        ]
      },
      {
        "title": "Records Processed",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(records_processed_total[5m])",
            "legendFormat": "Records/sec"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(sync_errors_total[5m])",
            "legendFormat": "Errors/sec"
          }
        ]
      }
    ]
  }
}
```

### 3. Alert Rules

Create `monitoring/alert_rules.yml`:

```yaml
groups:
  - name: ap-tool-sync-alerts
    rules:
      - alert: SyncServiceDown
        expr: up{job="ap-tool-sync"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "AP Tool sync service is down"
          description: "The attendance sync service has been down for more than 1 minute"

      - alert: HighErrorRate
        expr: rate(sync_errors_total[5m]) > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High error rate in sync operations"
          description: "Error rate is {{ $value }} errors per second"

      - alert: SyncStalled
        expr: increase(records_processed_total[10m]) == 0
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Sync appears to be stalled"
          description: "No records have been processed in the last 10 minutes"
```

## Security Considerations

### 1. Certificate Management

- Store certificates in secure location with proper permissions (600)
- Implement certificate rotation procedures
- Monitor certificate expiry dates
- Use proper CA chain validation

### 2. API Key Security

- Use encrypted storage for API keys
- Implement key rotation procedures
- Monitor for key exposure
- Use environment-specific keys

### 3. Network Security

- Use HTTPS for all communications
- Implement proper firewall rules
- Monitor for suspicious network activity
- Use VPN for administrative access

### 4. FERPA Compliance

- Enable audit logging for all operations
- Implement data retention policies
- Encrypt sensitive data in transit and at rest
- Monitor data access patterns

## Operational Procedures

### 1. Daily Operations

**Morning Checklist:**
- Check sync service status
- Review overnight sync results
- Monitor error logs
- Verify data consistency

**Commands:**
```bash
# Check service status
sudo systemctl status ap-tool-sync

# Check recent logs
sudo journalctl -u ap-tool-sync --since "24 hours ago"

# Run manual sync if needed
./scripts/run-enhanced-sync.sh --start $(date -d yesterday +%Y-%m-%d) --end $(date +%Y-%m-%d)
```

### 2. Weekly Maintenance

- Review sync performance metrics
- Check certificate expiry dates
- Update security patches
- Backup configuration files

### 3. Monthly Tasks

- Rotate API keys
- Review audit logs
- Performance optimization
- Capacity planning

## Troubleshooting

### Common Issues

1. **Certificate Errors**
   ```bash
   # Check certificate validity
   openssl x509 -in /etc/ap-tool/certs/aeries-client.crt -text -noout
   
   # Test certificate chain
   openssl verify -CAfile /etc/ap-tool/certs/aeries-ca.crt /etc/ap-tool/certs/aeries-client.crt
   ```

2. **Rate Limiting Issues**
   ```bash
   # Check current rate limit status
   curl -s http://localhost:3000/health | jq '.rateLimiting'
   
   # Adjust rate limits in configuration
   export AERIES_RATE_LIMIT_PER_MINUTE=30
   ```

3. **Database Connection Issues**
   ```bash
   # Test Supabase connection
   curl -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
        -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
        "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/schools?select=*&limit=1"
   ```

### Log Analysis

**View sync operation logs:**
```bash
# Real-time logs
sudo journalctl -u ap-tool-sync -f

# Error logs only
sudo journalctl -u ap-tool-sync -p err

# Performance metrics
grep "Sync completed" /var/log/ap-tool/sync.log | tail -10
```

### Performance Tuning

1. **Batch Size Optimization**
   - Start with 500 records per batch
   - Monitor memory usage and processing time
   - Adjust based on network latency and API limits

2. **Parallel Processing**
   - Use 2-3 parallel batches for optimal performance
   - Monitor CPU and memory usage
   - Adjust based on system resources

3. **Database Optimization**
   - Ensure proper indexes are in place
   - Monitor query performance
   - Use connection pooling

## Rollback Procedures

### Quick Rollback

```bash
# Stop current service
sudo systemctl stop ap-tool-sync

# Restore previous version
sudo cp -r /opt/ap-tool-v1-backup/* /opt/ap-tool-v1/

# Restart service
sudo systemctl start ap-tool-sync
```

### Data Rollback

```sql
-- Rollback attendance records to specific date
DELETE FROM attendance_records 
WHERE aeries_last_sync > '2024-01-01 00:00:00';

-- Restore from backup if available
-- psql -h your-supabase-host -U postgres -d postgres < backup.sql
```

## Support and Maintenance

### Contact Information
- **Primary**: Development Team
- **Secondary**: System Administrator
- **Emergency**: On-call Support

### Documentation Updates
- Update this guide when configuration changes
- Document any custom procedures
- Maintain troubleshooting knowledge base

### Backup Strategy
- Daily configuration backups
- Weekly database snapshots
- Monthly full system backups

---

**Last Updated**: 2025-08-04  
**Version**: 1.0.0  
**Review Date**: 2025-09-04
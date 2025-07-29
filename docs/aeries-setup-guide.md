# Aeries SIS Integration Setup Guide

## Overview

This guide provides detailed instructions for setting up Aeries SIS integration with the AP_Tool_V1 attendance recovery system for Romoland School District. The integration covers attendance data synchronization from August 15, 2024, to June 12, 2025.

## Prerequisites

### Required Information from District IT (Contact: Vince Butler, CTO)

1. **Aeries API Credentials**
   - API Base URL: `https://aeries.romoland.k12.ca.us/api`
   - API Key (32+ character string)
   - Client ID
   - Client Secret
   - District Code: `romoland`

2. **SSL Certificates**
   - Client Certificate (.crt file)
   - Private Key (.key file)
   - CA Certificate (.crt file)
   - Certificate passphrase (if applicable)

3. **Network Access**
   - Firewall rules allowing HTTPS access to Aeries API
   - IP whitelisting if required by district security policy

## Step 1: Certificate Setup

### 1.1 Create Certificate Directory

```bash
# Create secure certificate directory
sudo mkdir -p /certs
sudo chmod 700 /certs
sudo chown $(whoami):$(whoami) /certs
```

### 1.2 Install Certificates

Copy the certificates provided by Vince Butler to the certificate directory:

```bash
# Copy certificates (replace with actual filenames)
cp aeries-client.crt /certs/
cp aeries-private.key /certs/
cp aeries-ca.crt /certs/

# Set secure permissions
chmod 600 /certs/aeries-client.crt
chmod 600 /certs/aeries-private.key
chmod 600 /certs/aeries-ca.crt
```

### 1.3 Verify Certificate Validity

```bash
# Check certificate expiration
openssl x509 -in /certs/aeries-client.crt -text -noout | grep "Not After"

# Verify certificate chain
openssl verify -CAfile /certs/aeries-ca.crt /certs/aeries-client.crt

# Test private key matches certificate
openssl x509 -noout -modulus -in /certs/aeries-client.crt | openssl md5
openssl rsa -noout -modulus -in /certs/aeries-private.key | openssl md5
# The MD5 hashes should match
```

## Step 2: Environment Configuration

### 2.1 Update Environment Variables

Add the following to your `.env.local` file:

```bash
# =====================================================
# Aeries SIS API Configuration
# =====================================================
AERIES_API_BASE_URL=https://aeries.romoland.k12.ca.us/api
AERIES_API_KEY=your-actual-api-key-from-vince-butler
AERIES_CLIENT_ID=your-actual-client-id
AERIES_CLIENT_SECRET=your-actual-client-secret
AERIES_DISTRICT_CODE=romoland

# Certificate Paths
AERIES_CERTIFICATE_PATH=/certs/aeries-client.crt
AERIES_PRIVATE_KEY_PATH=/certs/aeries-private.key
AERIES_CA_CERT_PATH=/certs/aeries-ca.crt

# Sync Configuration
AERIES_SYNC_ENABLED=true
AERIES_SYNC_SCHEDULE=0 1 * * *  # Daily at 1:00 AM Pacific Time
AERIES_ATTENDANCE_START_DATE=2024-08-15
AERIES_ATTENDANCE_END_DATE=2025-06-12
AERIES_BATCH_SIZE=100
AERIES_RATE_LIMIT_PER_MINUTE=60
```

### 2.2 Validate Configuration

```bash
# Run configuration validation
npm run validate:aeries-config

# Check certificate permissions
ls -la /certs/

# Test API connectivity
npm run test:aeries-connection
```

## Step 3: Database Setup

### 3.1 Run Aeries Migration

```bash
# Apply Aeries integration database migration
npx supabase db push --file supabase/migrations/006_aeries_integration.sql

# Verify tables were created
npx supabase db ls
```

### 3.2 Verify Database Schema

The migration should create these tables:
- `aeries_sync_operations` - Tracks sync operations
- `aeries_api_audit_log` - FERPA-compliant audit logging
- `aeries_certificates` - Certificate management
- `aeries_validation_rules` - Data validation rules

## Step 4: Initial Sync Setup

### 4.1 Test Aeries API Connection

```bash
# Test basic connectivity
curl -X GET \
  --cert /certs/aeries-client.crt \
  --key /certs/aeries-private.key \
  --cacert /certs/aeries-ca.crt \
  -H "Authorization: Bearer YOUR_API_KEY" \
  https://aeries.romoland.k12.ca.us/api/health
```

### 4.2 Perform Initial Data Validation

```bash
# Start the application
npm run dev

# Test configuration endpoint
curl -X GET http://localhost:3000/api/aeries/sync \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4.3 Run First Sync (Test)

```bash
# Manual sync for one day (test)
curl -X POST http://localhost:3000/api/aeries/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -d '{
    "syncType": "MANUAL_SYNC",
    "startDate": "2024-08-15",
    "endDate": "2024-08-15",
    "batchSize": 10
  }'
```

## Step 5: Production Deployment

### 5.1 Certificate Security for Production

```bash
# For production deployment, use environment-specific certificates
# Development certificates should NOT be used in production

# Create separate certificate directories
sudo mkdir -p /etc/ssl/certs/aeries/production
sudo mkdir -p /etc/ssl/certs/aeries/staging

# Set environment-specific paths
AERIES_CERTIFICATE_PATH=/etc/ssl/certs/aeries/production/client.crt
AERIES_PRIVATE_KEY_PATH=/etc/ssl/certs/aeries/production/private.key
AERIES_CA_CERT_PATH=/etc/ssl/certs/aeries/production/ca.crt
```

### 5.2 GitHub Secrets Configuration

For CI/CD deployment, configure these GitHub repository secrets:

```bash
# Using GitHub CLI
gh secret set AERIES_API_KEY --body "your-api-key"
gh secret set AERIES_CLIENT_ID --body "your-client-id"
gh secret set AERIES_CLIENT_SECRET --body "your-client-secret"

# Certificate files (base64 encoded)
base64 -i /certs/aeries-client.crt | gh secret set AERIES_CERTIFICATE_BASE64
base64 -i /certs/aeries-private.key | gh secret set AERIES_PRIVATE_KEY_BASE64
base64 -i /certs/aeries-ca.crt | gh secret set AERIES_CA_CERT_BASE64
```

### 5.3 Docker Configuration

For containerized deployment:

```dockerfile
# Dockerfile additions for Aeries certificates
FROM node:18-alpine

# Create certificates directory
RUN mkdir -p /certs && chmod 700 /certs

# Copy certificates during build (use build secrets)
# These should be injected at runtime, not baked into the image
COPY --from=certs /certs/ /certs/
RUN chmod 600 /certs/*

# Set certificate environment variables
ENV AERIES_CERTIFICATE_PATH=/certs/aeries-client.crt
ENV AERIES_PRIVATE_KEY_PATH=/certs/aeries-private.key
ENV AERIES_CA_CERT_PATH=/certs/aeries-ca.crt
```

## Step 6: Monitoring and Maintenance

### 6.1 Set Up Certificate Monitoring

```bash
# Create certificate monitoring script
cat > /scripts/check-aeries-certs.sh << 'EOF'
#!/bin/bash
CERT_PATH="/certs/aeries-client.crt"
DAYS_WARNING=30

# Check certificate expiration
EXPIRY_DATE=$(openssl x509 -in "$CERT_PATH" -noout -enddate | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
CURRENT_EPOCH=$(date +%s)
DAYS_UNTIL_EXPIRY=$(( (EXPIRY_EPOCH - CURRENT_EPOCH) / 86400 ))

if [ $DAYS_UNTIL_EXPIRY -le $DAYS_WARNING ]; then
    echo "WARNING: Aeries certificate expires in $DAYS_UNTIL_EXPIRY days"
    # Send alert to administrators
    curl -X POST YOUR_ALERT_WEBHOOK \
      -d "Aeries certificate for Romoland expires in $DAYS_UNTIL_EXPIRY days"
fi
EOF

chmod +x /scripts/check-aeries-certs.sh

# Add to crontab
echo "0 8 * * * /scripts/check-aeries-certs.sh" | crontab -
```

### 6.2 Sync Operation Monitoring

```bash
# Check sync status
curl -X GET http://localhost:3000/api/aeries/sync

# View recent sync operations
curl -X GET http://localhost:3000/api/aeries/sync?limit=10

# Check for failed syncs
curl -X GET http://localhost:3000/api/aeries/sync?status=FAILED
```

## Step 7: Troubleshooting

### 7.1 Common Issues

**Certificate Issues:**
```bash
# Certificate not found
ls -la /certs/
# Check file permissions
stat /certs/aeries-client.crt

# Certificate expired
openssl x509 -in /certs/aeries-client.crt -noout -dates

# Certificate/key mismatch
openssl x509 -noout -modulus -in /certs/aeries-client.crt | openssl md5
openssl rsa -noout -modulus -in /certs/aeries-private.key | openssl md5
```

**API Connection Issues:**
```bash
# Test network connectivity
curl -I https://aeries.romoland.k12.ca.us

# Test API endpoint with certificates
curl -X GET \
  --cert /certs/aeries-client.crt \
  --key /certs/aeries-private.key \
  --cacert /certs/aeries-ca.crt \
  -H "Authorization: Bearer YOUR_API_KEY" \
  https://aeries.romoland.k12.ca.us/api/health -v
```

**Sync Issues:**
```bash
# Check application logs
tail -f logs/application.log | grep AERIES

# Verify database connectivity
npm run db:check

# Test date range validation
curl -X POST http://localhost:3000/api/aeries/sync \
  -d '{"startDate": "2024-01-01", "endDate": "2024-01-01"}'
```

### 7.2 Log Analysis

```bash
# Filter Aeries-related logs
grep "AERIES" logs/application.log

# Check sync operation logs
grep "SYNC" logs/application.log | tail -20

# Monitor API rate limiting
grep "RATE_LIMIT" logs/application.log
```

## Step 8: Security Considerations

### 8.1 FERPA Compliance Checklist

- [ ] All Aeries API calls are logged in `aeries_api_audit_log`
- [ ] Educational interest is validated for all data access
- [ ] User access is tracked with employee IDs
- [ ] Certificates are stored securely with restricted permissions
- [ ] API keys are not logged or exposed in error messages
- [ ] Data retention policies are configured (7-year FERPA requirement)

### 8.2 Security Best Practices

```bash
# Regular security checks
# 1. Certificate rotation (annually or as required by district)
# 2. API key rotation (quarterly)
# 3. Audit log review (monthly)
# 4. Access permission review (quarterly)

# Security monitoring
grep -i "AUTHENTICATION\|AUTHORIZATION" logs/application.log | tail -50
```

## Contact Information

### Technical Support
- **Aeries Integration**: Vince Butler (CTO) - vbutler@romoland.k12.ca.us
- **System Administration**: IT Department
- **Security Issues**: Report via GitHub Issues (non-sensitive only)

### Emergency Procedures
- **Certificate Expiration**: Contact Vince Butler immediately
- **API Outage**: Check district status page and contact IT
- **Data Sync Failure**: Review logs and contact system administrator

## Appendix: API Endpoints Reference

### Aeries SIS Endpoints (Romoland)
```
Base URL: https://aeries.romoland.k12.ca.us/api

Authentication: GET /auth/token
Health Check: GET /health
Students: GET /students
Attendance: GET /attendance/daterange
Schools: GET /schools
```

### AP_Tool_V1 Aeries Integration Endpoints
```
Base URL: http://localhost:3000/api/aeries

Sync Status: GET /sync
Start Sync: POST /sync
Cancel Sync: DELETE /sync
Config Check: GET /config
```

This setup guide ensures secure, FERPA-compliant integration with Aeries SIS for Romoland School District's attendance recovery system.
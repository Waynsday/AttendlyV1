#!/bin/bash

# =====================================================
# Aeries SIS Integration Setup Script
# Complete setup for Romoland School District
# =====================================================

set -e  # Exit on any error

echo "🚀 Setting up Aeries SIS Integration for Romoland School District"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if script is run from project root
if [ ! -f "package.json" ]; then
    log_error "Please run this script from the project root directory"
    exit 1
fi

# =====================================================
# Step 1: Install Dependencies
# =====================================================

log_info "Installing required dependencies..."

if command -v npm &> /dev/null; then
    npm install node-cron papaparse
    npm install --save-dev @types/node-cron @types/papaparse
    log_success "Dependencies installed with npm"
elif command -v pnpm &> /dev/null; then
    pnpm add node-cron papaparse
    pnpm add -D @types/node-cron @types/papaparse
    log_success "Dependencies installed with pnpm"
else
    log_error "Neither npm nor pnpm found. Please install Node.js package manager."
    exit 1
fi

# =====================================================
# Step 2: Create Certificate Directory
# =====================================================

log_info "Setting up certificate directory..."

if [ ! -d "/certs" ]; then
    sudo mkdir -p /certs
    sudo chmod 700 /certs
    sudo chown $(whoami):$(whoami) /certs
    log_success "Certificate directory created at /certs"
else
    log_warning "Certificate directory already exists at /certs"
fi

# Create placeholder certificate files
cat > /certs/README.txt << 'EOF'
Aeries SSL Certificates for Romoland School District
====================================================

This directory should contain the following files from Vince Butler (CTO):

1. aeries-client.crt    - Client certificate for API authentication
2. aeries-private.key   - Private key for client certificate  
3. aeries-ca.crt        - Certificate Authority certificate

SECURITY IMPORTANT:
- These files must have 600 permissions (readable only by owner)
- Never commit these files to version control
- Contact vbutler@romoland.k12.ca.us for actual certificates

Current status: PLACEHOLDER FILES - NOT FOR PRODUCTION USE
EOF

# Create placeholder certificates (for development/testing only)
cat > /certs/aeries-client.crt << 'EOF'
-----BEGIN CERTIFICATE-----
PLACEHOLDER CERTIFICATE - NOT FOR PRODUCTION USE
Contact Vince Butler (CTO) at vbutler@romoland.k12.ca.us for actual certificates
-----END CERTIFICATE-----
EOF

cat > /certs/aeries-private.key << 'EOF'
-----BEGIN PRIVATE KEY-----
PLACEHOLDER PRIVATE KEY - NOT FOR PRODUCTION USE
Contact Vince Butler (CTO) at vbutler@romoland.k12.ca.us for actual certificates
-----END PRIVATE KEY-----
EOF

cat > /certs/aeries-ca.crt << 'EOF'
-----BEGIN CERTIFICATE-----
PLACEHOLDER CA CERTIFICATE - NOT FOR PRODUCTION USE
Contact Vince Butler (CTO) at vbutler@romoland.k12.ca.us for actual certificates
-----END CERTIFICATE-----
EOF

# Set secure permissions
chmod 600 /certs/aeries-client.crt
chmod 600 /certs/aeries-private.key
chmod 600 /certs/aeries-ca.crt
chmod 644 /certs/README.txt

log_success "Placeholder certificates created (replace with actual certificates from Vince Butler)"

# =====================================================
# Step 3: Environment Configuration
# =====================================================

log_info "Setting up environment configuration..."

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    cp .env.example .env.local
    log_success "Created .env.local from .env.example"
else
    log_warning ".env.local already exists - backing up to .env.local.backup"
    cp .env.local .env.local.backup
fi

# Add Aeries configuration to .env.local
cat >> .env.local << 'EOF'

# =====================================================
# Aeries SIS API Configuration - Added by setup script
# =====================================================
# ** REPLACE WITH ACTUAL VALUES FROM VINCE BUTLER **
AERIES_API_BASE_URL=https://aeries.romoland.k12.ca.us/api
AERIES_API_KEY=REPLACE-WITH-ACTUAL-API-KEY-FROM-VINCE-BUTLER
AERIES_CLIENT_ID=REPLACE-WITH-ACTUAL-CLIENT-ID-FROM-VINCE-BUTLER
AERIES_CLIENT_SECRET=REPLACE-WITH-ACTUAL-CLIENT-SECRET-FROM-VINCE-BUTLER
AERIES_DISTRICT_CODE=romoland

# Certificate Paths
AERIES_CERTIFICATE_PATH=/certs/aeries-client.crt
AERIES_PRIVATE_KEY_PATH=/certs/aeries-private.key
AERIES_CA_CERT_PATH=/certs/aeries-ca.crt

# Aeries Sync Configuration
AERIES_SYNC_ENABLED=true
AERIES_SYNC_SCHEDULE=0 1 * * *
AERIES_ATTENDANCE_START_DATE=2024-08-15
AERIES_ATTENDANCE_END_DATE=2025-06-12
AERIES_BATCH_SIZE=100
AERIES_RATE_LIMIT_PER_MINUTE=60
EOF

log_success "Aeries configuration added to .env.local"

# =====================================================
# Step 4: Database Migration
# =====================================================

log_info "Running database migration..."

if command -v npx &> /dev/null; then
    if [ -f "supabase/migrations/007_aeries_complete_implementation.sql" ]; then
        log_info "Migration file found. Please run manually:"
        echo "  npx supabase db push"
        log_warning "Database migration must be run manually after Supabase is configured"
    else
        log_error "Migration file not found. Please ensure all files are copied correctly."
    fi
else
    log_warning "npx not found. Please run database migration manually after setup."
fi

# =====================================================
# Step 5: Create Admin Navigation Link
# =====================================================

log_info "Setting up admin navigation..."

# Update dashboard layout to include Aeries admin link
DASHBOARD_LAYOUT_FILE="src/presentation/components/dashboard-layout.tsx"

if [ -f "$DASHBOARD_LAYOUT_FILE" ]; then
    # Check if Aeries admin link already exists
    if ! grep -q "Aeries Admin" "$DASHBOARD_LAYOUT_FILE"; then
        log_info "Admin navigation link will need to be added manually to $DASHBOARD_LAYOUT_FILE"
        log_info "Add this to the navigation items array:"
        echo "  { name: 'Aeries Admin', href: '/admin/aeries', icon: Database },"
    else
        log_success "Aeries admin navigation link already exists"
    fi
else
    log_warning "Dashboard layout file not found. Navigation link must be added manually."
fi

# =====================================================
# Step 6: Build and Test
# =====================================================

log_info "Building application to check for errors..."

if command -v npm &> /dev/null; then
    if npm run build; then
        log_success "Application builds successfully"
    else
        log_error "Build failed. Please check for TypeScript errors."
        exit 1
    fi
elif command -v pnpm &> /dev/null; then
    if pnpm build; then
        log_success "Application builds successfully"
    else
        log_error "Build failed. Please check for TypeScript errors."
        exit 1
    fi
fi

# =====================================================
# Step 7: Setup Validation
# =====================================================

log_info "Validating setup..."

VALIDATION_PASSED=true

# Check if all required files exist
REQUIRED_FILES=(
    "src/lib/aeries/aeries-client.ts"
    "src/lib/aeries/aeries-sync.ts"
    "src/app/api/aeries/route.ts"
    "src/app/admin/aeries/page.tsx"
    "supabase/migrations/007_aeries_complete_implementation.sql"
    ".env.production"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        log_success "✓ $file"
    else
        log_error "✗ $file not found"
        VALIDATION_PASSED=false
    fi
done

# Check certificate directory
if [ -d "/certs" ] && [ -f "/certs/aeries-client.crt" ]; then
    log_success "✓ Certificate directory setup"
else
    log_error "✗ Certificate directory not properly setup"
    VALIDATION_PASSED=false
fi

# Check environment configuration
if grep -q "AERIES_API_BASE_URL" .env.local; then
    log_success "✓ Environment configuration"
else
    log_error "✗ Environment configuration missing"
    VALIDATION_PASSED=false
fi

# =====================================================
# Step 8: Final Instructions
# =====================================================

echo ""
echo "=================================================="
log_info "Aeries SIS Integration Setup Complete!"
echo "=================================================="

if [ "$VALIDATION_PASSED" = true ]; then
    log_success "All files and configurations are in place"
    echo ""
    log_info "NEXT STEPS:"
    echo "1. 📧 Contact Vince Butler (CTO) at vbutler@romoland.k12.ca.us to get:"
    echo "   - Aeries API key"
    echo "   - Client ID and Client Secret"
    echo "   - SSL certificates (client.crt, private.key, ca.crt)"
    echo ""
    echo "2. 📝 Update .env.local with actual credentials:"
    echo "   - Replace AERIES_API_KEY with actual API key"
    echo "   - Replace AERIES_CLIENT_ID with actual client ID"
    echo "   - Replace AERIES_CLIENT_SECRET with actual client secret"
    echo ""
    echo "3. 🔐 Replace placeholder certificates in /certs/ with actual certificates"
    echo ""
    echo "4. 🗄️  Run database migration:"
    echo "   npx supabase db push"
    echo ""
    echo "5. 🚀 Start the application:"
    echo "   npm run dev"
    echo ""
    echo "6. 🌐 Access Aeries admin at:"
    echo "   http://localhost:3000/admin/aeries"
    echo ""
    log_info "📖 For detailed instructions, see docs/aeries-setup-guide.md"
    echo ""
    log_success "Ready for deployment once credentials are obtained!"
else
    log_error "Setup validation failed. Please check the errors above and re-run the script."
    exit 1
fi

echo "=================================================="
log_info "Contact Information:"
echo "🏢 Romoland School District"
echo "👨‍💻 Vince Butler (CTO): vbutler@romoland.k12.ca.us"
echo "📅 School Year: 2024-2025 (Aug 15, 2024 - June 12, 2025)"
echo "🔗 Aeries API: https://aeries.romoland.k12.ca.us/api"
echo "=================================================="
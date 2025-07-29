# AttendlyV1 - Setup and Configuration Guide

## Overview

AttendlyV1 is a FERPA-compliant school attendance recovery system designed for Romoland School District. This application implements California SB 153/176 attendance recovery legislation with secure data handling for confidential student information.

## Tech Stack

- **Frontend**: Next.js 15.4.4, React 19, TypeScript 5, Tailwind CSS v4
- **Backend**: Node.js 18+, Prisma ORM, PostgreSQL 15
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Testing**: Vitest, Playwright, Jest
- **CI/CD**: GitHub Actions, Docker, AWS Fargate
- **Security**: OWASP ASVS L2, FERPA compliance

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm or pnpm package manager
- Git
- Supabase account (for database)
- GitHub account (for repository access)

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/Waynsday/AttendlyV1.git
cd AttendlyV1
```

### 2. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 3. Environment Configuration

Copy the environment template:

```bash
cp .env.example .env.local
```

## Environment Variables Setup

### Required Configuration

Edit `.env.local` with your actual values:

#### Next.js Configuration
```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here-generate-with-openssl-rand-base64-32
NODE_ENV=development
```

#### Supabase Configuration
```bash
# Get these from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
```

### Supabase Setup

#### Method 1: CLI (Recommended)
```bash
# Install Supabase CLI
npm install -g @supabase/cli

# Initialize Supabase
supabase init

# Start local development
supabase start

# Apply migrations
supabase db push
```

#### Method 2: Manual Dashboard Setup
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Create a new project
3. Copy the API URL and anon key to your `.env.local`
4. Go to SQL Editor and run the migration files in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_row_level_security.sql`
   - `supabase/migrations/003_functions_and_views.sql`

### External System Integration (Optional)

#### Aeries SIS Integration
Contact: Vince Butler (CTO) for API credentials
```bash
AERIES_API_URL=https://aeries.romoland.k12.ca.us/api
AERIES_API_KEY=your-aeries-api-key-here
AERIES_CLIENT_ID=your-aeries-client-id
AERIES_CLIENT_SECRET=your-aeries-client-secret
```

#### iReady Integration
Contact: District IT for SFTP credentials
```bash
IREADY_SFTP_HOST=sftp.iready.com
IREADY_SFTP_USERNAME=romoland_district
IREADY_SFTP_PASSWORD=your-sftp-password
IREADY_SFTP_PORT=22
```

#### School Status Attend (A2A) Integration
Contact: Matthew Valdivia (Director of Pupil Services)
```bash
A2A_API_URL=https://schoolstatusattend.com/api
A2A_API_KEY=your-a2a-api-key
A2A_DISTRICT_ID=romoland-usd
```

## Security Configuration

### FERPA Compliance Settings
```bash
FERPA_COMPLIANCE_MODE=enabled
AUDIT_LOG_RETENTION_DAYS=2555  # 7 years as required by FERPA
STUDENT_DATA_ENCRYPTION_KEY=your-encryption-key-here-32-chars
```

### Rate Limiting & Session Management
```bash
RATE_LIMIT_PER_USER=100
RATE_LIMIT_PER_IP=200
SESSION_TIMEOUT_HOURS=4
MAX_CONCURRENT_SESSIONS=3
```

### California Compliance (SB 153/176)
```bash
CA_ATTENDANCE_RECOVERY_ENABLED=true
CA_ADA_FUNDING_CALCULATION=enabled
CA_CHRONIC_ABSENTEEISM_THRESHOLD=0.10
CA_RECOVERY_SESSION_RATIO=4  # 4 hours = 1 day recovered
```

## Development Commands

### Start Development Server
```bash
npm run dev
# Application runs on http://localhost:3000
```

### Testing
```bash
npm run test              # Run unit tests
npm run test:e2e          # Run end-to-end tests
npm run test:coverage     # Run tests with coverage report
```

### Build & Production
```bash
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
```

### Development Tools
```bash
npm run dev:clean        # Clean development startup
npm run dev:docker       # Run with Docker Compose
npm run dev:validate     # Validate environment configuration
```

## GitHub Repository Secrets

For CI/CD and deployment, set these secrets in GitHub:

### Method 1: GitHub CLI
```bash
gh secret set SUPABASE_SERVICE_ROLE_KEY
gh secret set AERIES_API_KEY
gh secret set NEXTAUTH_SECRET
gh secret set STUDENT_DATA_ENCRYPTION_KEY
```

### Method 2: Manual Setup
1. Go to [Repository Settings → Secrets and variables → Actions](https://github.com/Waynsday/AttendlyV1/settings/secrets/actions)
2. Click "New repository secret"
3. Add each secret with corresponding value from your `.env.local`

### Required GitHub Secrets
- `SUPABASE_SERVICE_ROLE_KEY`
- `AERIES_API_KEY`
- `NEXTAUTH_SECRET`
- `STUDENT_DATA_ENCRYPTION_KEY`
- `SENTRY_DSN` (for error tracking)

## Docker Development (Optional)

### Start with Docker Compose
```bash
npm run dev:docker
```

This starts:
- Next.js application (port 3000)
- PostgreSQL database (port 5432)
- pgAdmin (port 8080)
- Redis cache (port 6379)
- Mailhog email testing (port 8025)

## SSL Certificates (Production)

For production deployment, you'll need SSL certificates:

```bash
# Generate development certificates (for testing)
openssl req -x509 -newkey rsa:4096 -keyout private-key.pem -out certificate.crt -days 365 -nodes

# Place certificates in:
# - /certs/certificate.crt
# - /certs/private-key.pem
```

**⚠️ CRITICAL**: Never commit actual certificates to version control.

## Data Security & FERPA Compliance

### Student Data Protection
- All files in `References/` contain confidential student information
- **NEVER commit actual student data** to version control
- Use `.gitignore` patterns to exclude sensitive data files
- Encrypt all student data at rest and in transit

### Required File Permissions
```bash
# Restrict access to sensitive directories
chmod 700 References/
chmod 600 .env.local
chmod 600 private-key.pem
```

## Troubleshooting

### Common Issues

#### 1. Module Not Found Errors
```bash
rm -rf node_modules package-lock.json
npm install
```

#### 2. Port Already in Use
```bash
lsof -ti:3000 | xargs kill -9
npm run dev
```

#### 3. Database Connection Issues
```bash
# Verify Supabase connection
npm run dev:validate
```

#### 4. Build Errors
```bash
# Clean build cache
npm run clean
npm run build
```

### Development vs Production

#### Development Mode
- Uses simplified middleware for faster development
- Allows CORS for localhost testing
- Provides detailed error messages
- Includes development tools and hot reloading

#### Production Mode
- Full security middleware with rate limiting
- Strict CORS policy
- Encrypted student data handling
- Comprehensive audit logging
- Performance optimizations

## API Documentation

API endpoints are documented using OpenAPI 3.0 specification:
- Development: `http://localhost:3000/api-docs`
- Production: Generated from `openapi.yaml`

## Contact Information

### Technical Support
- **System Administrator**: IT Department
- **Security Issues**: Report via GitHub Issues (non-sensitive only)
- **FERPA Compliance**: Contact District Privacy Officer

### District Contacts
- **Aeries Integration**: Vince Butler (CTO)
- **A2A Integration**: Matthew Valdivia (Director of Pupil Services)
- **iReady Integration**: District IT Department

## License & Compliance

This system is designed specifically for educational institutions and complies with:
- Family Educational Rights and Privacy Act (FERPA)
- California SB 153/176 attendance recovery legislation
- OWASP Application Security Verification Standard (ASVS) Level 2

---

**⚠️ IMPORTANT**: This application handles confidential student data. Ensure all team members are trained on FERPA compliance and data security protocols before accessing production systems.

## Quick Start Checklist

- [ ] Node.js 18+ installed
- [ ] Repository cloned
- [ ] Dependencies installed (`npm install`)
- [ ] `.env.local` configured with Supabase credentials
- [ ] Supabase database setup and migrations applied
- [ ] Development server started (`npm run dev`)
- [ ] Application accessible at `http://localhost:3000`
- [ ] GitHub repository secrets configured (for deployment)
- [ ] Team members trained on FERPA compliance

For additional support, see `docs/TROUBLESHOOTING.md` or create an issue in the GitHub repository.
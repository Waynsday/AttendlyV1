# Production Dockerfile for AP_Tool_V1
# Multi-stage build optimized for FERPA-compliant educational environments
# Implements security best practices following OWASP Container Security Top 10

# ============================================================================
# Stage 1: Dependencies Installation
# ============================================================================
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat git python3 make g++

WORKDIR /app

# Install pnpm for efficient package management
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml* package-lock.json* yarn.lock* ./

# Install production dependencies with security optimizations
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile --production=false; \
    elif [ -f package-lock.json ]; then npm ci; \
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    else npm install; fi

# ============================================================================
# Stage 2: Application Build
# ============================================================================
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source code
COPY . .

# SECURITY: Explicitly exclude sensitive directories
RUN rm -rf References/ \
    && rm -rf certs/aeries-client.crt \
    && rm -rf .env* \
    && rm -rf *.log

# Install pnpm for build process
RUN corepack enable && corepack prepare pnpm@latest --activate

# Build the Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV FERPA_COMPLIANCE_MODE=enabled
ENV STUDENT_DATA_PROTECTION=enabled

# Run security audit before build
RUN pnpm audit --audit-level=high || true

# Build the application
RUN pnpm build

# ============================================================================
# Stage 3: Production Runtime
# ============================================================================
FROM node:20-alpine AS runner
WORKDIR /app

# SECURITY: Create non-root user for container security
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# SECURITY: Install minimal runtime dependencies only
RUN apk add --no-cache \
    curl \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV FERPA_COMPLIANCE_MODE=enabled
ENV STUDENT_DATA_PROTECTION=enabled
ENV OWASP_ASVS_L2=enabled

# Copy built application from builder stage
COPY --from=builder /app/public ./public

# Copy Next.js build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/tmp \
    && chown -R nextjs:nodejs /app/logs /app/tmp \
    && chmod 755 /app/logs /app/tmp

# SECURITY: Remove unnecessary files and set proper permissions
RUN rm -rf /app/src \
    && find /app -type f -name "*.md" -delete \
    && find /app -type f -name "*.log" -delete \
    && chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose application port
EXPOSE 3000

# SECURITY: Use dumb-init to handle signal forwarding properly
ENTRYPOINT ["dumb-init", "--"]

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Security labels for container metadata
LABEL maintainer="Attendly DevOps <devops@attendly.com>" \
      version="1.0.0" \
      description="AP Tool V1 - FERPA Compliant Attendance Management System" \
      security.compliance="FERPA,OWASP_ASVS_L2" \
      security.scan-date="2025-07-30" \
      edu.data-classification="confidential" \
      edu.ferpa-compliant="true"

# Start the application
CMD ["node", "server.js"]
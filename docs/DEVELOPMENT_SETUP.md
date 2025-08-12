# AttendlyV1 Development Setup Guide

This guide ensures a smooth development experience without devtools errors.

## Prerequisites

- Node.js 18+ (20 recommended)
- pnpm (preferred) or npm
- Docker Desktop (optional, for containerized development)
- PostgreSQL 15 (or use Docker)
- Git

## Initial Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd ap-tool-v1

# Install dependencies
pnpm install
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local with your values
# At minimum, update:
# - DATABASE_URL
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY

# Validate your environment
pnpm run dev:validate
```

### 3. Database Setup

#### Option A: Using Docker (Recommended)

```bash
# Start PostgreSQL with Docker
pnpm run dev:docker:build
pnpm run dev:docker

# Database will be available at:
# postgresql://attendly:attendly_dev@localhost:5432/attendly_dev
```

#### Option B: Local PostgreSQL

```bash
# Create database
createdb attendly_dev

# Run migrations
pnpm prisma migrate dev
```

## Development Workflow

### Starting Development Server

```bash
# Standard start (with automatic port conflict resolution)
pnpm dev

# Clean start (clears all caches first)
pnpm run dev:clean

# Force specific port
pnpm dev -- --port=3001

# With Docker services
pnpm run dev:docker
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server with smart port handling |
| `pnpm dev:clean` | Clear caches and start fresh |
| `pnpm dev:docker` | Start all services with Docker |
| `pnpm dev:validate` | Validate environment configuration |
| `pnpm build` | Build for production |
| `pnpm test` | Run all tests |
| `pnpm lint` | Run ESLint |
| `pnpm clean` | Clear Next.js and node_modules cache |
| `pnpm clean:all` | Full cleanup including dependencies |

## Avoiding DevTools Errors

The project has been configured to prevent Next.js devtools conflicts:

1. **Webpack Configuration**: Custom webpack config in `next.config.ts` disables problematic modules
2. **Environment Variables**: `.env.local` disables experimental features
3. **Clean Scripts**: Use `dev:clean` if you encounter issues
4. **No DevTools Dependencies**: `@hookform/devtools` has been removed

## Docker Development

For a consistent development environment:

```bash
# Build and start all services
pnpm run dev:docker:build
pnpm run dev:docker

# Services available:
# - App: http://localhost:3000
# - PostgreSQL: localhost:5432
# - pgAdmin: http://localhost:5050
# - Mailhog: http://localhost:8025
# - Redis: localhost:6379

# Stop all services
pnpm run dev:docker:down
```

## Troubleshooting Quick Reference

### Port Conflicts
```bash
# Auto-resolve port conflicts
pnpm dev

# Force kill process on port
pnpm dev -- --force
```

### Cache Issues
```bash
# Clear Next.js cache
pnpm clean

# Full reset
pnpm clean:all && pnpm install
```

### Environment Issues
```bash
# Validate environment
pnpm run dev:validate

# Show environment report
pnpm run dev:validate -- --report
```

## VS Code Setup

Recommended extensions:
- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense
- Prisma

Settings (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

## Security Reminders

1. **Never commit `.env.local`** - It's in `.gitignore` for a reason
2. **Student data stays local** - Files in `References/` are confidential
3. **Use encryption** - All student data must be encrypted at rest
4. **Follow FERPA guidelines** - This is an educational system

## Daily Development Checklist

- [ ] Pull latest changes: `git pull`
- [ ] Update dependencies: `pnpm install`
- [ ] Validate environment: `pnpm run dev:validate`
- [ ] Start development: `pnpm dev`
- [ ] Run tests before committing: `pnpm test`

## Getting Help

1. Check `docs/TROUBLESHOOTING.md` for common issues
2. Run diagnostics: `pnpm run dev:validate --report`
3. Check logs in `.next/server/`
4. Review GitHub Issues

## Performance Tips

1. Use `pnpm dev:clean` weekly to prevent cache buildup
2. Allocate sufficient Docker resources (4GB+ RAM)
3. Disable source maps if not debugging: `GENERATE_SOURCEMAP=false`
4. Use Docker for consistent performance across team

## Next Steps

1. Review the architecture in `CLAUDE.md`
2. Explore the codebase structure
3. Run the test suite: `pnpm test`
4. Try building: `pnpm build`
5. Review security guidelines in the troubleshooting guide
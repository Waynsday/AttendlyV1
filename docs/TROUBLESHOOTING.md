# AttendlyV1 Development Troubleshooting Guide

This guide helps resolve common development environment issues.

## Table of Contents

1. [Next.js DevTools Errors](#nextjs-devtools-errors)
2. [Port Conflicts](#port-conflicts)
3. [Environment Variable Issues](#environment-variable-issues)
4. [Database Connection Problems](#database-connection-problems)
5. [Docker Issues](#docker-issues)
6. [Build and Compilation Errors](#build-and-compilation-errors)
7. [Performance Issues](#performance-issues)
8. [Common Error Messages](#common-error-messages)

---

## Next.js DevTools Errors

### Error: "Cannot read properties of undefined (reading 'ReactDevTools')"

**Solution:**
The project has been configured to disable conflicting devtools. If you still see this error:

1. Clear all caches:
   ```bash
   pnpm run dev:clean
   ```

2. Remove node_modules and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   pnpm install
   ```

3. Ensure your `.env.local` has:
   ```
   NEXT_DISABLE_EXPERIMENTAL_FEATURES=1
   GENERATE_SOURCEMAP=false
   ```

### Error: "Module not found: Can't resolve '@hookform/devtools'"

**Solution:**
This module has been removed from the project. If you see this error:

1. Search for any remaining imports:
   ```bash
   grep -r "@hookform/devtools" src/
   ```

2. Remove any found imports

3. Clear Next.js cache:
   ```bash
   rm -rf .next
   ```

---

## Port Conflicts

### Error: "Port 3000 is already in use"

**Solution:**

1. Use the enhanced startup script:
   ```bash
   node scripts/dev-start.js
   ```

2. Force kill the process on port 3000:
   ```bash
   node scripts/dev-start.js --force
   ```

3. Use a different port:
   ```bash
   node scripts/dev-start.js --port=3001
   ```

4. Manually find and kill the process:
   ```bash
   # On macOS/Linux
   lsof -ti:3000 | xargs kill -9
   
   # On Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```

---

## Environment Variable Issues

### Error: "Missing required environment variables"

**Solution:**

1. Run the environment validator:
   ```bash
   node scripts/env-validator.js
   ```

2. Copy the example file if `.env.local` is missing:
   ```bash
   cp .env.example .env.local
   ```

3. Update `.env.local` with your actual values

4. Generate an environment report:
   ```bash
   node scripts/env-validator.js --report
   ```

### Error: "Invalid DATABASE_URL"

**Solution:**

1. Ensure the URL follows PostgreSQL format:
   ```
   postgresql://username:password@host:port/database
   ```

2. For local development with Docker:
   ```
   DATABASE_URL=postgresql://attendly:attendly_dev@localhost:5432/attendly_dev
   ```

3. Test the connection:
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```

---

## Database Connection Problems

### Error: "Connection refused to PostgreSQL"

**Solution:**

1. Start PostgreSQL with Docker:
   ```bash
   docker-compose -f docker-compose.dev.yml up postgres
   ```

2. Check if PostgreSQL is running:
   ```bash
   docker ps | grep postgres
   ```

3. Verify connection details:
   ```bash
   psql -h localhost -p 5432 -U attendly -d attendly_dev
   ```

### Error: "Database does not exist"

**Solution:**

1. Create the database:
   ```bash
   docker-compose -f docker-compose.dev.yml exec postgres createdb -U attendly attendly_dev
   ```

2. Run migrations:
   ```bash
   pnpm prisma migrate dev
   ```

---

## Docker Issues

### Error: "Cannot connect to Docker daemon"

**Solution:**

1. Ensure Docker Desktop is running

2. On macOS, check Docker socket:
   ```bash
   ls -la /var/run/docker.sock
   ```

3. Restart Docker Desktop

### Error: "Container name already in use"

**Solution:**

1. Remove existing containers:
   ```bash
   docker-compose -f docker-compose.dev.yml down
   ```

2. Remove all containers:
   ```bash
   docker rm -f $(docker ps -aq)
   ```

### Slow performance on macOS

**Solution:**

1. Use named volumes instead of bind mounts for node_modules
2. Enable VirtioFS in Docker Desktop settings
3. Allocate more resources in Docker Desktop preferences

---

## Build and Compilation Errors

### Error: "Module parse failed: Unexpected token"

**Solution:**

1. Check TypeScript configuration:
   ```bash
   pnpm tsc --noEmit
   ```

2. Clear build cache:
   ```bash
   rm -rf .next
   pnpm build
   ```

3. Update dependencies:
   ```bash
   pnpm update
   ```

### Error: "Cannot find module '@/...' "

**Solution:**

1. Verify `tsconfig.json` paths configuration:
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./src/*"]
       }
     }
   }
   ```

2. Restart TypeScript server in VS Code:
   - Open Command Palette (Cmd+Shift+P)
   - Run "TypeScript: Restart TS Server"

---

## Performance Issues

### Slow Hot Module Replacement (HMR)

**Solution:**

1. Disable source maps in development:
   ```bash
   echo "GENERATE_SOURCEMAP=false" >> .env.local
   ```

2. Use the clean development script:
   ```bash
   pnpm run dev:clean
   ```

3. Exclude large directories from file watching:
   - Add to `.env.local`:
     ```
     WATCHPACK_POLLING=true
     ```

### High Memory Usage

**Solution:**

1. Increase Node.js memory limit:
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" pnpm dev
   ```

2. Clear caches regularly:
   ```bash
   rm -rf .next node_modules/.cache
   ```

---

## Common Error Messages

### "EADDRINUSE: address already in use"
- **Cause:** Port is already occupied
- **Fix:** Use `--force` flag or change port

### "ENOENT: no such file or directory"
- **Cause:** Missing file or directory
- **Fix:** Ensure all paths are correct and files exist

### "EPERM: operation not permitted"
- **Cause:** Permission issues
- **Fix:** Check file permissions or run with appropriate privileges

### "MODULE_NOT_FOUND"
- **Cause:** Missing dependency
- **Fix:** Run `pnpm install`

### "NEXT_NOT_FOUND"
- **Cause:** Next.js not properly installed
- **Fix:** Reinstall dependencies

---

## Quick Recovery Steps

If nothing else works, follow these steps for a clean restart:

1. **Stop all processes:**
   ```bash
   pkill -f "node"
   ```

2. **Clean everything:**
   ```bash
   rm -rf .next node_modules package-lock.json pnpm-lock.yaml
   ```

3. **Reinstall dependencies:**
   ```bash
   pnpm install
   ```

4. **Validate environment:**
   ```bash
   node scripts/env-validator.js
   ```

5. **Start with clean script:**
   ```bash
   node scripts/dev-start.js --clean
   ```

---

## Getting Help

If you continue to experience issues:

1. Check the error logs in `.next/server/`
2. Run Next.js in debug mode:
   ```bash
   DEBUG=* pnpm dev
   ```
3. Check GitHub Issues for similar problems
4. Contact the development team with:
   - Full error message
   - Steps to reproduce
   - Environment details (OS, Node version, etc.)

---

## Preventive Measures

1. **Always use the provided scripts:**
   - `pnpm run dev:clean` for clean starts
   - `node scripts/dev-start.js` for intelligent startup

2. **Keep dependencies updated:**
   ```bash
   pnpm update --interactive
   ```

3. **Regular maintenance:**
   - Clear caches weekly
   - Update Docker images monthly
   - Review environment variables quarterly

4. **Use Docker for consistency:**
   ```bash
   docker-compose -f docker-compose.dev.yml up
   ```

This ensures everyone has the same development environment.
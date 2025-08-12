# FILE_DESCRIPTIONS.md - AP_Tool_V1 Repository Analysis

Generated on: 2025-08-05  
Last Updated: 2025-08-05 (Post-Cleanup)  
Total Repository Size: ~1.3GB (includes 1GB backup)  
Active Repository Size: ~300MB  
Total Files Analyzed: 39,831 files → ~1,000 files (post-cleanup)  

## Repository Structure Overview

AP_Tool_V1 is an attendance and performance tracking tool for educational institutions using Next.js 14, TypeScript, and Supabase. The project follows Clean (Hexagonal) Architecture principles with strict FERPA compliance for handling student data.

---

## CRITICAL FILES (Essential for System Operation)

### Configuration & Core Setup
| File Path | Size | Last Modified | Purpose | Risk Level |
|-----------|------|---------------|---------|------------|
| `/ap-tool-v1/package.json` | 4.2KB | Recent | Main project dependencies and scripts | **CRITICAL** |
| `/ap-tool-v1/next.config.ts` | ~1KB | Recent | Next.js configuration | **CRITICAL** |
| `/ap-tool-v1/tsconfig.json` | ~1KB | Recent | TypeScript configuration | **CRITICAL** |
| `/ap-tool-v1/tailwind.config.ts` | ~1KB | Recent | Tailwind CSS configuration | **CRITICAL** |
| `/CLAUDE.md` | 15KB | Recent | Project instructions and architecture guide | **CRITICAL** |

### Source Code - Core Application
| File Path | Size | Last Modified | Purpose | Risk Level |
|-----------|------|---------------|---------|------------|
| `/ap-tool-v1/src/app/layout.tsx` | ~2KB | Recent | Root layout component | **CRITICAL** |
| `/ap-tool-v1/src/app/page.tsx` | ~3KB | Recent | Main dashboard page | **CRITICAL** |
| `/ap-tool-v1/src/lib/supabase/client.ts` | ~1KB | Recent | Supabase client configuration | **CRITICAL** |
| `/ap-tool-v1/src/lib/aeries/enhanced-aeries-client.ts` | ~8KB | Recent | Production Aeries API client | **CRITICAL** |

---

## IMPORTANT FILES (Core Functionality)

### API Routes
| File Path | Size | Last Modified | Purpose | Risk Level |
|-----------|------|---------------|---------|------------|
| `/ap-tool-v1/src/app/api/schools/route.ts` | ~2KB | Recent | Schools API endpoint | **IMPORTANT** |
| `/ap-tool-v1/src/app/api/attendance/route.ts` | ~3KB | Recent | Attendance data API | **IMPORTANT** |
| `/ap-tool-v1/src/app/api/dashboard/route.ts` | ~2KB | Recent | Dashboard data API | **IMPORTANT** |

### Domain Layer (Clean Architecture)
| File Path | Size | Last Modified | Purpose | Risk Level |
|-----------|------|---------------|---------|------------|
| `/ap-tool-v1/src/domain/entities/student.ts` | ~2KB | Recent | Student domain entity | **IMPORTANT** |
| `/ap-tool-v1/src/domain/entities/attendance-record.ts` | ~3KB | Recent | Attendance record entity | **IMPORTANT** |
| `/ap-tool-v1/src/domain/repositories/` | Various | Recent | Repository interfaces | **IMPORTANT** |

### Data Services
| File Path | Size | Last Modified | Purpose | Risk Level |
|-----------|------|---------------|---------|------------|
| `/ap-tool-v1/src/lib/sync/data-sync-service.ts` | ~5KB | Recent | Data synchronization service | **IMPORTANT** |
| `/ap-tool-v1/src/lib/services/dashboard-data-service.ts` | ~4KB | Recent | Dashboard data aggregation | **IMPORTANT** |

---

## OPTIONAL FILES (Development & Testing)

### Test Files
| File Path | Size | Last Modified | Purpose | Risk Level |
|-----------|------|---------------|---------|------------|
| `/ap-tool-v1/src/tests/` | Various | Recent | Test suite (85%+ coverage required) | **OPTIONAL** |
| `/ap-tool-v1/jest.config.js` | ~1KB | Recent | Jest testing configuration | **OPTIONAL** |
| `/ap-tool-v1/playwright.config.ts` | ~2KB | Recent | E2E testing configuration | **OPTIONAL** |

### Documentation
| File Path | Size | Last Modified | Purpose | Risk Level |
|-----------|------|---------------|---------|------------|
| `/docs/adr/` | Various | Recent | Architecture Decision Records | **OPTIONAL** |
| `/ap-tool-v1/docs/` | Various | Recent | Project documentation | **OPTIONAL** |
| `/ap-tool-v1/README.md` | ~3KB | Recent | Project README | **OPTIONAL** |

---

## CLEANUP STATUS UPDATE (2025-08-05)

### Successfully Deleted Files (1.05GB recovered)
| File Path | Size | Status |
|-----------|------|--------|
| `/ap-tool-v1/.next/` | **245MB** | ✅ DELETED |
| `/ap-tool-v1/node_modules/` | **796MB** | ✅ DELETED |
| `/scripts/node_modules/` | **7.5MB** | ✅ DELETED |
| Various debug/test scripts | ~20KB | ✅ DELETED |

### Backup Created
- Location: `/cleanup-backup-2025-08-05/` (1GB)
- Contains all deleted files for recovery if needed

## REMAINING CLEANUP CANDIDATES

### Still Present - Legacy Sync Scripts (Need Review)
| File Path | Size | Purpose | Risk Level | Recommendation |
|-----------|------|---------|------------|----------------|
| `/ap-tool-v1/final-attendance-sync.js` | 14KB | Legacy sync script | **MEDIUM** | Review for deletion |
| `/ap-tool-v1/full-population-sync.js` | 9.4KB | Legacy sync script | **MEDIUM** | Review for deletion |
| `/ap-tool-v1/full-school-year-sync.js` | 11KB | **ACTIVE SYNC SCRIPT** | **CRITICAL** | ⚠️ **KEEP - DO NOT DELETE** |
| `/ap-tool-v1/quick-attendance-sync.js` | 7.7KB | Legacy sync script | **MEDIUM** | Review for deletion |
| `/ap-tool-v1/working-attendance-sync.js` | 10KB | Legacy sync script | **MEDIUM** | Review for deletion |
| `/scripts/aeries-full-sync.js` | 12KB | Duplicate of enhanced sync | **LOW** | Can be deleted |
| `/scripts/aeries-sync.js` | 18KB | Duplicate of enhanced sync | **LOW** | Can be deleted |
| `/scripts/complete-remaining-sync.js` | 10KB | One-time migration | **LOW** | Can be deleted |
| `/scripts/fix-and-complete-sync.js` | 17KB | One-time fix script | **LOW** | Can be deleted |
| `/scripts/optimized-aeries-sync.js` | 15KB | Superseded version | **LOW** | Can be deleted |

### Still Present - iReady/Student Data Scripts
| File Path | Size | Purpose | Risk Level | Recommendation |
|-----------|------|---------|------------|----------------|
| `/scripts/test-iready-student-linking.js` | 8.8KB | iReady student linking test | **MEDIUM** | Review usage |
| `/scripts/test-isolated-iready-system.js` | 23KB | iReady system testing | **MEDIUM** | Review usage |
| `/scripts/simple-iready-upload.js` | 14KB | iReady data upload | **MEDIUM** | Review if needed |
| `/scripts/optimized-iready-upload.js` | 13KB | Optimized iReady upload | **MEDIUM** | Review if needed |
| `/scripts/upload-iready-data.js` | 21KB | Main iReady upload | **MEDIUM** | Review if needed |
| `/scripts/verify-iready-upload.js` | 7.5KB | iReady verification | **LOW** | Can be deleted |
| `/scripts/verify-iready-upload-final.js` | 4.1KB | Final verification | **LOW** | Can be deleted |

### Still Present - Student Data Management Scripts
| File Path | Size | Purpose | Risk Level | Recommendation |
|-----------|------|---------|------------|----------------|
| `/scripts/analyze-data-issues.js` | 6.9KB | Data analysis | **LOW** | Can be deleted |
| `/scripts/complete-student-id-mapping.js` | 5.3KB | ID mapping completion | **LOW** | Can be deleted |
| `/scripts/debug-student-ids.js` | 3.6KB | Debug student IDs | **LOW** | Can be deleted |
| `/scripts/debug-student-matching.js` | 3.5KB | Debug matching | **LOW** | Can be deleted |
| `/scripts/examine-student-data.js` | 3.9KB | Data examination | **LOW** | Can be deleted |
| `/scripts/validate-id-resolution.js` | 5.5KB | ID validation | **LOW** | Can be deleted |
| `/scripts/verify-student-sync.js` | 3.6KB | Sync verification | **LOW** | Can be deleted |

### Still Present - SQL Migration Files (Historical)
| File Path | Size | Purpose | Risk Level | Recommendation |
|-----------|------|---------|------------|----------------|
| `/scripts/disable-triggers-for-bulk-upload.sql` | ~2KB | Bulk upload optimization | **MEDIUM** | Keep if bulk uploads planned |
| `/scripts/re-enable-triggers.sql` | ~1KB | Re-enable after bulk | **MEDIUM** | Keep with above |
| `/scripts/fix-iready-*.sql` | Various | iReady schema fixes | **LOW** | Historical - can delete |
| `/scripts/regenerate-summary-*.sql` | Various | Summary regeneration | **LOW** | Can be deleted |
| `/scripts/update-*.sql` | Various | One-time updates | **LOW** | Can be deleted |

---

## CONFIDENTIAL DATA FILES (Handle with Extreme Care)

### Student Data References
| File Path | Size | Last Modified | Purpose | Risk Level |
|-----------|------|---------------|---------|------------|
| `/References/` | Various | Recent | **CONFIDENTIAL STUDENT DATA** | **NEVER_DELETE** |
| `/References/iReady Data/` | Various | Recent | Multi-year diagnostic results | **NEVER_DELETE** |
| `/References/*.csv` | Various | Recent | Attendance and conference data | **NEVER_DELETE** |

**⚠️ CRITICAL SECURITY NOTE**: The References/ directory contains FERPA-protected student data and must NEVER be committed to version control or deleted without proper authorization.

---

## POST-CLEANUP RISK ASSESSMENT SUMMARY

### ✅ Successfully Cleaned (1.05GB+ recovered)
- `/ap-tool-v1/.next/` (245MB) - Build artifacts - **DELETED**
- `/ap-tool-v1/node_modules/` (796MB) - Dependencies - **DELETED**  
- `/scripts/node_modules/` (7.5MB) - Dependencies - **DELETED**
- Debug/test scripts (~20KB) - **DELETED**

### ⚠️ Critical Files to KEEP
- `/ap-tool-v1/full-school-year-sync.js` - **ACTIVE SYNC SCRIPT - DO NOT DELETE**
- `/ap-tool-v1/scripts/enhanced-attendance-sync.ts` - Current production sync
- `/ap-tool-v1/scripts/run-enhanced-sync.sh` - Production sync runner
- All files in `/ap-tool-v1/src/` - Core application code

### 🟡 Still Needs Review (~200KB total)
- **Legacy Sync Scripts** (~100KB) - 9 files that may be superseded
- **iReady Upload Scripts** (~80KB) - 5 files, review if still needed
- **Student Data Debug Scripts** (~40KB) - 7 files, likely can be deleted
- **SQL Migration Files** (~20KB) - Historical, mostly can be deleted

### 📦 Backup Information
- **Location**: `/cleanup-backup-2025-08-05/` (1GB)
- **Contents**: All deleted files preserved for recovery
- **Action**: Can be removed after verifying application works correctly

### Never Delete
- Core application source code (`/ap-tool-v1/src/`)
- Configuration files (package.json, tsconfig.json, etc.)
- Student data in `/References/`
- Current enhanced sync infrastructure

---

## DEPENDENCY ANALYSIS

### Key Dependencies (from package.json)
- **Runtime**: Next.js 15.4.4, React 19.0.0, TypeScript 5
- **Database**: Supabase client, Prisma ORM (unused?)
- **UI**: Tailwind CSS, Radix UI components
- **Security**: jsonwebtoken, validator
- **Testing**: Jest, Playwright, Stryker (mutation testing)

### Potential Cleanup Opportunities
1. **Prisma** appears in devDependencies but project uses Supabase directly
2. Multiple sync scripts suggest iterative development - older versions likely unused
3. Build artifacts consuming significant disk space

---

## RECOMMENDED CLEANUP ACTIONS

### Phase 1: Immediate Safe Cleanup (1.05GB savings)
```bash
rm -rf ap-tool-v1/.next/
rm -rf ap-tool-v1/node_modules/
rm -rf scripts/node_modules/
# Regenerate with: cd ap-tool-v1 && pnpm install && pnpm build
```

### Phase 2: Legacy Script Review
Review and potentially remove 10+ duplicate sync scripts after confirming the enhanced version handles all use cases.

### Phase 3: Dependency Audit
- Remove unused Prisma dependency if confirmed
- Audit other devDependencies for actual usage

---

## ARCHITECTURE COMPLIANCE

✅ **Follows Clean Architecture** - Domain, Application, Infrastructure layers properly separated  
✅ **FERPA Compliant** - Student data properly isolated in References/  
✅ **Test Coverage** - Comprehensive test suite with 85%+ coverage requirement  
✅ **TypeScript** - Full type safety implementation  
✅ **Security** - JWT auth, input validation, rate limiting implemented  

---

## RECOMMENDED NEXT CLEANUP ACTIONS

### Phase 1: ✅ COMPLETED - Build Artifacts (1.05GB recovered)
```bash
# Already deleted:
# - ap-tool-v1/.next/
# - ap-tool-v1/node_modules/
# - scripts/node_modules/
# To regenerate: cd ap-tool-v1 && pnpm install && pnpm build
```

### Phase 2: Legacy Script Cleanup (~100KB)
```bash
# Safe to delete (duplicates of enhanced sync):
rm scripts/aeries-full-sync.js
rm scripts/aeries-sync.js
rm scripts/complete-remaining-sync.js
rm scripts/fix-and-complete-sync.js
rm scripts/optimized-aeries-sync.js

# Review before deleting (may have unique functionality):
# - ap-tool-v1/final-attendance-sync.js
# - ap-tool-v1/full-population-sync.js
# - ap-tool-v1/quick-attendance-sync.js
# - ap-tool-v1/working-attendance-sync.js

# CRITICAL - DO NOT DELETE:
# - ap-tool-v1/full-school-year-sync.js (ACTIVE SCRIPT)
```

### Phase 3: Debug/Test Script Cleanup (~40KB)
```bash
# Low-risk deletions:
rm scripts/analyze-data-issues.js
rm scripts/debug-student-ids.js
rm scripts/debug-student-matching.js
rm scripts/examine-student-data.js
rm scripts/validate-id-resolution.js
rm scripts/verify-student-sync.js
rm scripts/verify-iready-upload*.js
```

### Phase 4: SQL Migration Cleanup (~20KB)
```bash
# Historical migrations (safe to delete):
rm scripts/fix-iready-*.sql
rm scripts/regenerate-summary-*.sql
rm scripts/update-*.sql

# Keep these if bulk uploads are planned:
# - scripts/disable-triggers-for-bulk-upload.sql
# - scripts/re-enable-triggers.sql
```

### Phase 5: Final Cleanup
```bash
# After verifying application works:
rm -rf cleanup-backup-2025-08-05/
rm interactive-cleanup.js  # The cleanup tool itself
```

---

*Analysis completed by Senior Architect Agent - AP_Tool_V1 Codebase Optimization*  
*Last Updated: 2025-08-05 (Post-Cleanup Assessment)*
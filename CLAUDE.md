# CLAUDE.md â€” Shared Context File

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AP_Tool_V1 is an attendance and performance tracking tool for educational institutions. The project appears to be in initial development stage.

## Tech Stack (2025)

- **Front-End**: Next.js 14, React 19, TypeScript 5, Tailwind CSS v4, shadcn-ui
- **Back-End**: Node 18 (pnpm), Prisma ORM, PostgreSQL 15
- **Testing**: Vitest + Playwright + fast-check + Stryker (mutation testing)
- **CI/CD**: GitHub Actions, Docker, AWS Fargate (via Terraform)
- **Observability**: Prometheus, Grafana, Sentry, CloudWatch Logs
- **Version Control**: git + GitHub CLI (`gh`)

---

## Architectural Rules

1. **Clean (Hexagonal) Architecture** â€" business logic in `core/`, adapters in `adapters/`, never in controllers.
2. **API Design** â€" RESTful routes under `/api`, contract documented by OpenAPI 3 spec (`openapi.yaml`).
3. **State Management** â€" React 19 Server Components + Zustand for client state; no Redux.
4. **Database Migrations** â€" Prisma Migrate; never hand-edit SQL.
5. **Component Design** â€" Functional, accessible, responsive, WCAG 2.1 AA.
6. **Educational Data Processing** â€" Document data processing pipeline for attendance and performance data.
7. **System Integration** â€" Define integration points with school information systems.
8. **Student Data Security** â€" Secure handling of confidential student data in `References/`.
9. **Supabase Schema Management** â€" All schema changes must be done manually in Supabase Dashboard; never attempt programmatic schema modifications.
10. **NO FAKE DATA POLICY** â€" **NEVER** create, generate, or insert fake/synthetic student data. This is an educational system handling real student information. Only use authentic data from official sources like Aeries SIS or approved CSV imports.

---

## Database Management (Supabase)

### Schema Management Rules
- **CRITICAL**: All database schema changes (table creation, column additions, constraint modifications) must be done manually through the Supabase Dashboard
- **Never** attempt to modify schemas programmatically via SQL scripts or migrations
- **Always** verify schema changes in the dashboard before writing code that depends on them

### Current Database Structure
- **schools**: Core school information (17 records) - primary table
- **students**: Student demographics and enrollment data 
- **teachers**: Staff information and assignments
- **attendance_records**: Daily attendance data from Aeries API (1,840+ records)
- **truancy_letters**: Intervention tracking for attendance issues
- **sarb_referrals**: Student Attendance Review Board referrals
- **recovery_sessions**: Attendance recovery program scheduling
- **iready_scores**: iReady diagnostic assessment data
- **aeries_sync_operations**: Sync operation logging and status

### Dashboard Integration Architecture

The dashboard now features dynamic school dropdown integration with real-time grade-level summaries:

#### Data Flow Architecture
```
Aeries SIS API → Sync Scripts → Supabase Tables → API Endpoints → Dashboard Service → React Components
```

#### Key Components:
1. **API Endpoints**: 
   - `/api/schools` - Returns active schools with grade levels served
   - `/api/grade-summaries` - Calculates attendance metrics by grade/school
   
2. **Dashboard Data Service**: 
   - Handles API calls with caching (5-minute TTL)
   - Provides fallback data when APIs fail
   - Supports both school-specific and district-wide aggregation

3. **React Integration**:
   - `useDashboardData` hook manages state and API calls
   - Dynamic dropdown population from Supabase schools table
   - Real-time grade card updates when school selection changes
   - Loading states and error handling with user feedback

4. **Data Transformations**:
   - District-wide view aggregates data across all schools by grade level
   - School-specific view filters data to selected school only
   - Attendance rates calculated from actual attendance records
   - Risk tier calculations (Tier 1: >95%, Tier 2: 90-95%, Tier 3: <90%)

**Key Principle**: Frontend pulls all data from Supabase via secure API endpoints, never directly from Aeries API.

### Aeries API Integration
- **Base URL**: `https://romolandapi.aeries.net/admin/api/v5`
- **Authentication**: Certificate-based (`AERIES-CERT` header)
- **Sync Schedule**: Daily automated sync for attendance data
- **Data Coverage**: SY2024-2025 (Aug 15, 2024 - Jun 12, 2025)

#### Enhanced Attendance Sync Features
- **Date Range Processing**: Breaks large date ranges into manageable chunks (default: 30-day chunks)
- **Batch Processing**: Configurable batch sizes (default: 500 records) with enhanced metadata
- **Resume Capability**: Can resume from specific batch number after interruption
- **Error Handling**: Circuit breaker pattern with exponential backoff for non-critical errors
- **Progress Checkpointing**: Saves progress every 10 batches for recovery
- **Rate Limiting**: Intelligent delay with exponential backoff based on error frequency
- **Comprehensive Monitoring**: Detailed logging and audit trail for FERPA compliance

### Existing Sync Infrastructure (2025-08-04)

#### Core Components
1. **EnhancedAeriesClient** (`/src/lib/aeries/enhanced-aeries-client.ts`)
   - Production-ready with circuit breaker pattern
   - Certificate-based authentication
   - Exponential backoff retry logic
   - Dead letter queue for failed operations
   - Romoland-specific query building

2. **DataSyncService** (`/src/lib/sync/data-sync-service.ts`)
   - Transaction management with ACID properties
   - Saga pattern for distributed transactions
   - Batch processing with parallel execution
   - Conflict resolution strategies
   - Real-time progress tracking

3. **AeriesSyncService** (`/src/lib/aeries/aeries-sync.ts`)
   - Complete sync orchestration
   - Scheduled sync support (cron)
   - Manual sync capabilities
   - Progress tracking and operation history
   - Batch processing for attendance records

#### Attendance Data Model
- **Period Support**: 7 period columns for middle/high school
- **Correction Window**: 7-day correction period tracking
- **Status Enums**: PRESENT, ABSENT, TARDY, EXCUSED_ABSENT, UNEXCUSED_ABSENT, PARTIAL_DAY, SUSPENDED
- **Sync Metadata**: Operation ID, timestamps, source tracking

#### Security Features
- **FERPA Compliance Framework**: Built-in validation and PII scanning
- **Audit Logging**: Comprehensive operation tracking
- **Row-Level Security**: Implemented in Supabase
- **Certificate Management**: Secure API authentication

#### Performance Optimizations
- **Connection Pooling**: Database connection reuse
- **Parallel Processing**: Multiple school/batch processing
- **Bulk Operations**: Efficient database inserts
- **Progress Checkpointing**: Resume capability

#### Monitoring & Observability
- **Prometheus Metrics**: Performance tracking
- **CloudWatch Integration**: AWS monitoring
- **Dead Letter Queue**: Failed operation tracking
- **Real-time Progress**: WebSocket updates

---

## Data References

The `References/` directory contains sample data files for:
- Student attendance records (CSV files)
- iReady diagnostic results for ELA and Math across multiple years (Current_Year, Current_Year-1, Current_Year-2)
- Conference detail reports

**CRITICAL**: These files contain CONFIDENTIAL student data and should be treated with appropriate security measures. Never commit actual student data to version control.

---

## Coding Standards

| Tool              | Enforcement |
|-------------------|-------------|
| ESLint Airbnb + Prettier   | `pnpm lint` (CI blocking) |
| Commit Messages   | Conventional Commits (`feat:`, `fix:`, etc.) |
| Branch Naming     | `feat/<ticket>`, `fix/<ticket>`, `chore/<scope>` |
| Code Coverage     | â‰¥ 85 % lines, 80 % branches (CI blocking) |
| Docs              | JSDoc on all exported functions |
| Data Validation   | Validate and sanitize all CSV inputs |

---

## Development Commands

### Primary Stack (Node.js/JavaScript)
```bash
pnpm install       # Install dependencies
pnpm dev          # Run in development mode
pnpm start        # Run the application
pnpm test         # Run tests
pnpm lint         # Run linter
pnpm build        # Build for production

# Enhanced Attendance Sync Commands
./scripts/run-enhanced-sync.sh                    # Full school year sync
./scripts/run-enhanced-sync.sh -s 2024-08-15 -e 2024-12-31  # First semester only
./scripts/run-enhanced-sync.sh -S 001             # Specific school
./scripts/run-enhanced-sync.sh -r 150             # Resume from batch 150
./scripts/run-enhanced-sync.sh -d                 # Dry run validation
```

### Fallback Stack (Python)
```bash
pip install -r requirements.txt    # Install dependencies
python main.py                     # Run the application
pytest                             # Run tests
black . --check                   # Check code formatting
flake8                             # Run linter
```

---

## Front-End Workflow Prompt

All UI tasks **must start** with the `/frontend:build-dashboard "<Feature>"` command, which prompts Claude to:
1. Summarize design goal and user persona.
2. List component hierarchy.
3. Explain accessibility and responsive strategies.
4. Generate JSX + Tailwind code.
5. Pause for confirmation before coding.

This ensures **context, goals, and purpose** precede implementation.

---

## Test-Driven Development Guard

A Git hook (`.claude/hooks/pre-edit-tdd.sh`) blocks any *Edit* tool invocation unless a failing test exists in the diff. This enforces the Red-Green-Refactor discipline and prevents big-bang coding.

---

## Anti-Hardcoding Policy

> "Passing tests is the **result** of good engineering, not the goal." â€” Teams must solve the general problem, never return constants to satisfy assertions.

The **code-reviewer** and **qa-tester** agents reject PRs that:
- Return fixed values matching fixtures.
- Check equality against exact fixture objects.
- Implement only the happy path.

---

## GitHub CLI Usage Guide

| Operation                               | Command Example |
|-----------------------------------------|-----------------|
| Open repo info                          | `gh repo view` |
| Create Issue (Architect)                | `gh issue create --title "Epic: Auth" --body "â€¦"` |
| Create Draft PR (Engineer)              | `gh pr create --fill --draft` |
| Watch CI checks (QA)                    | `gh pr checks --watch 123` |
| Review PR (Reviewer)                    | `gh pr review 123 --request-changes` |
| Trigger Deploy (DevOps)                 | `gh workflow run deploy.yml --ref main` |

---

## Claude Max Plan Resilience

1. Agents monitor quota with `/session:status`.
2. Before exhaustion, run `/save-plan "<slug>"` (state stored in project root under `.claude/saved-plans/`).
3. On credit reset (5 h window), resume session: `claude --resume <session-id>` then `/load-plan "<slug>"`.
4. DevOps resumes failed workflows with `gh run rerun <run-id>`.

This ensures work continuity without losing state.

---

## Security & Compliance

- Follow **OWASP ASVS L2** for all new code.
- Disallow `eval`, dynamic `require`, unparameterised SQL.
- Use **CWE** references in reviews.
- Perform monthly dependency scan (`pnpm audit`, CodeQL).
- **Student Data Privacy**: Apply encryption and access controls to `References/` directory.
- **Data Format Security**: Validate and sanitize all CSV data imports.

---

## Architecture Notes

As this project develops, key architectural decisions should be documented here, including:
- Data processing pipeline for attendance and performance data
- Integration points with school information systems
- Security measures for handling confidential student data
- API structure for data access and reporting
- Multi-year data tracking support (Current_Year, Current_Year-1, Current_Year-2)

---

## Documentation

- All endpoints documented in `openapi.yaml`.
- Architectural decisions recorded in ADRs (`docs/adr/NNNN-title.md`).
- Each major feature has an RFC (`docs/rfc/`) describing context, motivation, alternatives, and decisions.

---

## Important Considerations

1. **Data Privacy**: All files in References/ contain confidential student information. Never commit actual student data to version control.
2. **Data Format**: The project works with CSV files for attendance and diagnostic data. Consider data validation and sanitization.
3. **Multi-Year Support**: iReady data spans multiple years (Current_Year, Current_Year-1, Current_Year-2), suggesting the tool needs historical data tracking.
4. **Educational Compliance**: Ensure all data handling meets FERPA and relevant educational privacy regulations.

---

## Glossary of Commands

| Command                        | Purpose |
|--------------------------------|---------|
| `/frontend:build-dashboard`    | Kick-off UI work with context-first prompt |
| `/save-plan <slug>`            | Persist current thinking to disk |
| `/load-plan <slug>`            | Reload thinking after quota reset |
| `/session:status`              | Show remaining credits and reset timer |

---

## Key Values & Culture

1. **Context First** â€” Understand *why* before *how*.
2. **Security by Design** â€” Treat security as a first-class requirement, especially for student data.
3. **Quality over Speed** â€” Shipping maintainable code is better than quick hacks.
4. **Test for Behavior** â€” Tests describe system behavior, not implementation.
5. **Continuous Learning** â€” Reflect on failures and improve prompts/processes.
6. **Educational Focus** â€” Prioritize features that genuinely help educational institutions track and improve student outcomes.
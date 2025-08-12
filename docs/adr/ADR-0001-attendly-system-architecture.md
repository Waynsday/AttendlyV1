# ADR-0001: AttendlyV1 System Architecture for Romoland School District

## Status
**Accepted** - 2025-07-29

## Context

Romoland School District requires a comprehensive attendance recovery platform to comply with California SB 153/176 mandates and reduce chronic absenteeism. The system must handle:

- **Compliance Requirements**: FERPA-compliant student data handling, California AB 2273 privacy standards
- **Performance Requirements**: 1000+ students across multiple schools with real-time updates
- **Integration Requirements**: Aeries SIS, iReady diagnostic system, A2A platform
- **Tier-based Interventions**: 
  - Tier 1: 1-2 days absent (early intervention)
  - Tier 2: 3-9 days absent (targeted support)
  - Tier 3: >10% chronically absent (intensive intervention)

### Technical Constraints
- Educational data privacy (FERPA/COPPA compliance)
- Real-time dashboard requirements with grade-level KPIs
- CSV data ingestion from multiple systems
- Multi-year historical data tracking
- Mobile-responsive interface for educators

## Decision

We will implement a **Clean Hexagonal Architecture** with the following technology stack:

### Core Architecture
- **Domain Layer**: Pure business logic with entities, value objects, and domain services
- **Application Layer**: Use cases and application services coordinating domain operations
- **Infrastructure Layer**: External system adapters (Supabase, CSV processors, SIS integrations)
- **Presentation Layer**: Next.js 14 with React Server Components

### Technology Stack
```typescript
// Frontend Stack
- Next.js 14 with App Router (Server Components + Client Components)
- React 19 with TypeScript 5 (strict mode)
- Tailwind CSS v3 + shadcn-ui components
- Jotai for client-side state management
- SWR for data fetching and caching

// Backend Stack
- Supabase PostgreSQL 15 with Row Level Security (RLS)
- Prisma ORM alternative: Direct Supabase client
- Edge functions for CSV processing
- Real-time subscriptions for dashboard updates

// Security & Compliance
- Supabase RLS policies for FERPA compliance
- Zod schemas for data validation
- JWT-based authentication with role-based access
- Audit logging for all student data access
```

### Database Design Principles
1. **Student Privacy First**: All queries filtered through RLS policies
2. **Performance Optimized**: Proper indexing for 1000+ student queries
3. **Audit Trail**: Complete tracking of data access and modifications
4. **Multi-year Support**: Historical data retention with proper archiving

## Consequences

### Positive
- **Maintainability**: Clean architecture enables independent testing and development
- **Scalability**: Supabase handles concurrent users and real-time updates efficiently
- **Compliance**: Built-in FERPA/COPPA compliance through RLS and audit logging
- **Performance**: Server Components reduce client-side JavaScript, improve loading times
- **Developer Experience**: TypeScript strict mode catches errors early

### Negative
- **Learning Curve**: Team needs training on Clean Architecture principles
- **Initial Complexity**: More abstraction layers require careful documentation
- **Supabase Lock-in**: Database migration complexity if platform change needed
- **Edge Function Limits**: CSV processing constrained by Supabase Edge function timeouts

### Risk Mitigation
- **Architecture Training**: Provide team workshops on hexagonal architecture patterns
- **Documentation**: Comprehensive ADRs and code documentation requirements
- **Data Portability**: Export mechanisms for all student data in standard formats
- **Performance Monitoring**: Real-time metrics for CSV processing and dashboard loading

## Implementation Strategy

### Phase 1: Core Infrastructure (Weeks 1-2)
- Database schema with RLS policies
- Authentication and authorization system
- CSV ingestion pipeline with validation

### Phase 2: Dashboard Foundation (Weeks 3-4)
- Real-time dashboard with basic KPIs
- Student search and filtering
- Attendance data visualization

### Phase 3: Intervention Management (Weeks 5-6)
- Tier-based intervention workflows
- Teacher assignment and notification system
- Outcome tracking and reporting

### Phase 4: Integration & Optimization (Weeks 7-8)
- Aeries SIS integration
- iReady data correlation
- Performance optimization and security audit

## Alternatives Considered

### Alternative 1: Monolithic PHP Application
- **Pros**: Familiar technology, lower learning curve
- **Cons**: Poor scalability, difficult testing, security vulnerabilities
- **Rejected**: Does not meet real-time requirements or modern security standards

### Alternative 2: Microservices with Docker
- **Pros**: Service isolation, technology flexibility
- **Cons**: Operational complexity, network latency, development overhead
- **Rejected**: Over-engineering for single-district deployment

### Alternative 3: Firebase/Firestore
- **Pros**: Real-time capabilities, Google ecosystem
- **Cons**: Vendor lock-in, complex security rules, limited SQL capabilities
- **Rejected**: Inferior querying capabilities for educational data analysis

## Security Architecture

### FERPA Compliance Framework
```sql
-- Example RLS Policy for Student Data Access
CREATE POLICY student_access_policy ON students
FOR ALL TO authenticated
USING (
  -- Teachers can only access students in their assigned grade levels
  EXISTS (
    SELECT 1 FROM teacher_assignments ta
    WHERE ta.teacher_id = auth.uid()
    AND ta.grade_level = students.grade_level
    AND ta.is_active = true
  )
  OR
  -- Administrators have broader access
  EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.id = auth.uid()
    AND t.role IN ('ADMINISTRATOR', 'ASSISTANT_PRINCIPAL')
    AND t.is_active = true
  )
);
```

### Data Classification
- **Highly Sensitive**: Student names, IDs, attendance records, iReady scores
- **Sensitive**: Teacher information, intervention details
- **Internal**: Aggregated statistics, grade-level summaries
- **Public**: System status, general school information

### Access Control Matrix
| Role | Student Data | Attendance Records | iReady Scores | Interventions | System Admin |
|------|-------------|-------------------|---------------|---------------|--------------|
| Teacher | Grade-level only | Grade-level only | Grade-level only | Create/View | No |
| Assistant Principal | School-wide | School-wide | School-wide | All operations | Limited |
| Administrator | District-wide | District-wide | District-wide | All operations | Yes |

## Performance Requirements

### Response Time Targets
- Dashboard load: < 2 seconds
- Student search: < 500ms
- CSV import (1000 records): < 30 seconds
- Real-time updates: < 100ms latency

### Scalability Targets
- Concurrent users: 50+ simultaneously
- Student records: 10,000+ with room for growth
- Daily attendance records: 70,000+ (7 periods × 10,000 students)
- Historical data: 3+ years retention

### Monitoring Points
- Database query performance
- CSV processing success rates
- Dashboard component loading times
- Real-time subscription connection health

## Integration Architecture

### Data Flow Patterns
1. **Batch Processing**: Nightly CSV imports from Aeries SIS
2. **Real-time Updates**: Teacher attendance entries via web interface
3. **Event-Driven**: Intervention triggers based on attendance thresholds
4. **Periodic Sync**: Weekly iReady diagnostic data correlation

### API Design Principles
- RESTful endpoints with OpenAPI 3.0 documentation
- Consistent error responses with proper HTTP status codes
- Rate limiting to prevent abuse
- Comprehensive request/response logging

## Compliance Checkpoints

### FERPA Requirements ✓
- [ ] Explicit consent tracking for data disclosure
- [ ] Audit logs for all student data access
- [ ] Data minimization in API responses
- [ ] Secure data transmission (HTTPS/TLS 1.3)

### California AB 2273 Requirements ✓
- [ ] Age-appropriate privacy controls
- [ ] Data retention policies with automatic purging
- [ ] Opt-out mechanisms for non-essential features
- [ ] Privacy impact assessments documented

### Accessibility (WCAG 2.1 AA) ✓
- [ ] Keyboard navigation support
- [ ] Screen reader compatibility
- [ ] High contrast mode
- [ ] Responsive design for mobile devices

## Next Steps

1. **Team Training**: Schedule Clean Architecture workshop
2. **Database Setup**: Implement enhanced schema with iReady table
3. **Security Review**: External FERPA compliance audit
4. **Performance Baseline**: Establish monitoring and alerting
5. **Documentation**: Create developer onboarding guide

---

**Authors**: Senior Software Architect  
**Reviewers**: Technical Lead, Security Officer, Privacy Officer  
**Approval Date**: 2025-07-29  
**Next Review**: 2025-10-29 (Quarterly)
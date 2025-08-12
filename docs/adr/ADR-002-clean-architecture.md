# ADR-002: Clean Hexagonal Architecture Pattern

## Status
Accepted

## Context
The AP Tool must integrate with multiple external systems (Aeries SIS, i-Ready, School Status Attend) while maintaining clean separation of concerns and testability. The system needs to be maintainable as it scales to support multiple districts and evolving compliance requirements.

## Decision
We will implement Clean Hexagonal Architecture with the following layers:

1. **Domain Layer** (Core)
   - Entities (Student, Teacher, Program)
   - Value Objects (AttendanceRate, Grade)
   - Domain Services (RankingService, ComplianceService)
   - Repository Interfaces (Ports)

2. **Application Layer**
   - Use Cases (IdentifyChronicAbsentees, AssignStudentsToTeacher)
   - Application Services (orchestration)
   - DTOs and Mappers

3. **Infrastructure Layer**
   - Database Adapters (Prisma implementations)
   - External API Adapters (Aeries, i-Ready)
   - File Processing (CSV handlers)

4. **Presentation Layer**
   - Next.js API routes
   - React components
   - Controllers and middleware

## Implementation Structure

```
src/
├── core/
│   ├── domain/
│   │   ├── entities/
│   │   ├── value-objects/
│   │   ├── services/
│   │   └── repositories/ (interfaces)
│   └── application/
│       ├── use-cases/
│       ├── services/
│       └── dtos/
├── adapters/
│   ├── database/
│   ├── external-apis/
│   └── file-processors/
├── app/ (Next.js app directory)
│   ├── api/
│   ├── components/
│   └── pages/
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

## SOLID Principles Application

### Single Responsibility Principle (SRP)
- Each use case handles one specific business operation
- Separate adapters for each external system
- Components have single, well-defined purposes

### Open/Closed Principle (OCP)
- New external systems can be added via new adapters
- Business rules can be extended without modifying existing code
- Plugin-based architecture for different district requirements

### Liskov Substitution Principle (LSP)
- Repository implementations are interchangeable
- Mock adapters can replace real ones in tests
- Different attendance providers follow same interface

### Interface Segregation Principle (ISP)
- Separate interfaces for different data access patterns
- Role-specific service interfaces
- Minimal, focused API contracts

### Dependency Inversion Principle (DIP)
- High-level modules don't depend on low-level modules
- Both depend on abstractions (interfaces)
- Dependency injection throughout the application

## Consequences

### Positive
1. **Testability**: Core business logic isolated and easy to test
2. **Maintainability**: Changes to external systems don't affect business logic
3. **Flexibility**: Easy to swap implementations or add new integrations
4. **Compliance**: Clear audit trail through use case boundaries
5. **Team Productivity**: Developers can work on different layers independently

### Negative
1. **Complexity**: More files and abstractions to manage
2. **Learning Curve**: Team needs to understand architectural patterns
3. **Initial Overhead**: More setup required than simple MVC approach

### Mitigation Strategies
1. **Documentation**: Comprehensive architecture documentation and examples
2. **Code Templates**: Generators for common patterns (use cases, adapters)
3. **Team Training**: Architecture workshops and pair programming
4. **Gradual Migration**: Start with core features and expand architecture

## Testing Strategy

### Unit Tests (Domain Layer)
```typescript
// Example: Testing business logic without dependencies
describe('StudentRankingService', () => {
  it('should rank students by absence percentage', () => {
    const students = [
      new Student({ absenceRate: 0.15 }),
      new Student({ absenceRate: 0.08 }),
      new Student({ absenceRate: 0.22 })
    ];
    
    const ranked = rankingService.rankByAbsenceRate(students);
    
    expect(ranked[0].absenceRate).toBe(0.22);
    expect(ranked[2].absenceRate).toBe(0.08);
  });
});
```

### Integration Tests (Use Cases)
```typescript
// Example: Testing use cases with mocked repositories
describe('IdentifyChronicAbsenteesUseCase', () => {
  it('should return students with >10% absence rate', async () => {
    const mockRepo = new MockStudentRepository();
    const useCase = new IdentifyChronicAbsenteesUseCase(mockRepo);
    
    const result = await useCase.execute({ threshold: 0.1 });
    
    expect(result.students).toHaveLength(5);
    expect(result.students.every(s => s.absenceRate > 0.1)).toBe(true);
  });
});
```

### End-to-End Tests (Full System)
```typescript
// Example: Testing complete user workflows
describe('AP Dashboard Workflow', () => {
  it('should allow AP to assign students to recovery program', async () => {
    await loginAsAP();
    await navigateToDashboard();
    await selectChronicAbsentees(5);
    await assignToTeacher('john.doe@school.edu');
    
    expect(await getSuccessMessage()).toContain('5 students assigned');
  });
});
```

## Alternatives Considered

### Alternative 1: Traditional MVC
- **Pros**: Simpler, familiar pattern
- **Cons**: Tight coupling, harder to test, monolithic

### Alternative 2: Microservices
- **Pros**: Ultimate separation, scalable
- **Cons**: Complexity, network overhead, eventual consistency

### Alternative 3: Event-Driven Architecture
- **Pros**: Loose coupling, scalable
- **Cons**: Complexity, debugging challenges, learning curve

## References
- [Clean Architecture by Robert Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)

## Decision Makers
- Wayne (Senior Software Architect)
- Development Team
- QA Team

## Date
2025-07-28
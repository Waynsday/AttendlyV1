/**
 * @file csv-import-dashboard.test.tsx
 * @description Integration tests for CSV import to dashboard flow
 * Tests complete data processing pipeline from CSV upload to dashboard display
 * Tests are designed to FAIL initially to enable TDD implementation
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server, csvImportHandlers } from '../mocks/server';
import { rest } from 'msw';
import CSVImportPage from '../../app/import/page';
import DashboardPage from '../../app/dashboard/page';

// Mock Next.js components
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock file reading capabilities
Object.defineProperty(global, 'FileReader', {
  writable: true,
  value: class MockFileReader {
    readAsText = jest.fn(function(this: any) {
      // Simulate CSV content from References/ directory
      const csvContent = `Student ID,First Name,Last Name,Grade,Teacher,Attendance Rate,Total Absences,Chronic Absences,Tier
STU001,John,Doe,K,Ms. Smith,94.5,8,2,1
STU002,Jane,Smith,K,Ms. Smith,92.1,12,4,2
STU003,Bob,Johnson,K,Ms. Smith,85.3,22,18,3
STU004,Alice,Brown,1,Mr. Jones,96.2,5,0,1
STU005,Charlie,Wilson,1,Mr. Jones,88.7,16,12,3`;
      
      setTimeout(() => {
        this.onload?.({ target: { result: csvContent } });
      }, 10);
    });
  },
});

// Mock iReady CSV data
const mockIReadyCSVContent = `Student ID,Grade,ELA Diagnostic 1,ELA Diagnostic 2,Math Diagnostic 1,Math Diagnostic 2,Year
STU001,K,456,485,423,456,Current
STU002,K,445,468,401,434,Current
STU003,K,401,425,378,398,Current
STU001,K,425,456,398,423,Previous
STU002,K,420,445,380,401,Previous`;

describe('CSV Import to Dashboard Integration', () => {
  beforeEach(() => {
    server.resetHandlers();
    // Add CSV import handlers
    server.use(...csvImportHandlers);
  });

  describe('Complete attendance CSV import flow', () => {
    it('should successfully import attendance CSV and reflect changes in dashboard', async () => {
      // This test will FAIL initially - no CSV import implementation exists
      const user = userEvent.setup();
      
      // Start with CSV import page
      render(<CSVImportPage />);

      // Should show import interface
      expect(screen.getByText('CSV Data Import')).toBeInTheDocument();
      expect(screen.getByText('Attendance Data')).toBeInTheDocument();

      // Upload attendance CSV file
      const attendanceFile = new File(['mock csv content'], 'attendance.csv', { type: 'text/csv' });
      const fileInput = screen.getByLabelText(/upload attendance csv/i);
      await user.upload(fileInput, attendanceFile);

      // Should show file preview
      await waitFor(() => {
        expect(screen.getByText('File Preview')).toBeInTheDocument();
      });

      const previewTable = screen.getByTestId('csv-preview-table');
      expect(within(previewTable).getByText('John')).toBeInTheDocument();
      expect(within(previewTable).getByText('Doe')).toBeInTheDocument();
      expect(within(previewTable).getByText('94.5')).toBeInTheDocument();

      // Validate data mapping
      expect(screen.getByTestId('field-mapping')).toBeInTheDocument();
      expect(screen.getByText('Student ID → Student ID')).toBeInTheDocument();
      expect(screen.getByText('Attendance Rate → Attendance Rate')).toBeInTheDocument();

      // Process import
      const importButton = screen.getByRole('button', { name: /import data/i });
      await user.click(importButton);

      // Should show processing indicator
      expect(screen.getByRole('status', { name: /processing/i })).toBeInTheDocument();

      // Wait for import to complete
      await waitFor(() => {
        expect(screen.getByText('Import Successful')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Should show import summary
      const summary = screen.getByTestId('import-summary');
      expect(within(summary).getByText('1,250 records processed')).toBeInTheDocument();
      expect(within(summary).getByText('25 new students')).toBeInTheDocument();
      expect(within(summary).getByText('1,225 updated records')).toBeInTheDocument();

      // Navigate to dashboard
      const dashboardLink = screen.getByRole('link', { name: /view dashboard/i });
      await user.click(dashboardLink);

      // Dashboard should reflect imported data
      await waitFor(() => {
        expect(screen.getByText('School Overview')).toBeInTheDocument();
      });

      // Verify updated metrics
      expect(screen.getByText('1,250')).toBeInTheDocument(); // Total students from import
      expect(screen.getByText('94.2%')).toBeInTheDocument(); // Overall attendance rate
      expect(screen.getByText('125')).toBeInTheDocument(); // Chronic absentees (Tier 3)
    });

    it('should handle CSV validation errors and prevent bad data import', async () => {
      // This test will FAIL - requires validation implementation
      const user = userEvent.setup();

      server.use(
        rest.post('/api/import/attendance', (req, res, ctx) => {
          return res(ctx.json({
            success: false,
            errors: [
              { row: 2, field: 'Attendance Rate', error: 'Invalid percentage: 150%' },
              { row: 5, field: 'Student ID', error: 'Duplicate student ID: STU001' },
              { row: 8, field: 'Grade', error: 'Invalid grade: Grade 15' }
            ],
            summary: {
              totalRows: 100,
              validRows: 97,
              errorRows: 3
            }
          }));
        })
      );

      render(<CSVImportPage />);

      // Upload invalid CSV
      const invalidFile = new File(['invalid csv'], 'invalid.csv', { type: 'text/csv' });
      const fileInput = screen.getByLabelText(/upload attendance csv/i);
      await user.upload(fileInput, invalidFile);

      const importButton = screen.getByRole('button', { name: /import data/i });
      await user.click(importButton);

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText('Validation Errors Found')).toBeInTheDocument();
      });

      const errorList = screen.getByTestId('validation-errors');
      expect(within(errorList).getByText('Row 2: Invalid percentage: 150%')).toBeInTheDocument();
      expect(within(errorList).getByText('Row 5: Duplicate student ID: STU001')).toBeInTheDocument();
      expect(within(errorList).getByText('Row 8: Invalid grade: Grade 15')).toBeInTheDocument();

      // Should offer to fix errors
      expect(screen.getByRole('button', { name: /fix errors/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /import valid rows only/i })).toBeInTheDocument();
    });

    it('should preserve existing data during partial imports', async () => {
      // This test will FAIL - requires data preservation logic
      const user = userEvent.setup();

      // Mock existing dashboard data
      server.use(
        rest.get('/api/dashboard', (req, res, ctx) => {
          return res(ctx.json({
            schoolMetrics: {
              totalStudents: 1000, // Existing data
              overallAttendanceRate: 93.8,
              chronicAbsentees: 100,
              lastUpdated: '2025-01-14T15:00:00Z'
            }
          }));
        })
      );

      // First, check existing dashboard
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('1,000')).toBeInTheDocument(); // Original count
      });

      // Now import additional data
      render(<CSVImportPage />);

      const partialFile = new File(['partial update'], 'partial.csv', { type: 'text/csv' });
      const fileInput = screen.getByLabelText(/upload attendance csv/i);
      await user.upload(fileInput, partialFile);

      const importButton = screen.getByRole('button', { name: /import data/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Import Successful')).toBeInTheDocument();
      });

      // Should show merge strategy was applied
      const mergeInfo = screen.getByTestId('merge-strategy');
      expect(within(mergeInfo).getByText('Merge Strategy: Update existing, add new')).toBeInTheDocument();
      expect(within(mergeInfo).getByText('Existing records preserved: 1,000')).toBeInTheDocument();
      expect(within(mergeInfo).getByText('New records added: 250')).toBeInTheDocument();
    });
  });

  describe('iReady scores CSV integration', () => {
    it('should import iReady scores and display trends in dashboard', async () => {
      // This test will FAIL - requires iReady import implementation
      const user = userEvent.setup();

      render(<CSVImportPage />);

      // Switch to iReady import tab
      const iReadyTab = screen.getByRole('tab', { name: /iready scores/i });
      await user.click(iReadyTab);

      expect(screen.getByText('iReady Diagnostic Results')).toBeInTheDocument();

      // Upload iReady CSV
      const iReadyFile = new File([mockIReadyCSVContent], 'iready.csv', { type: 'text/csv' });
      const fileInput = screen.getByLabelText(/upload iready csv/i);
      await user.upload(fileInput, iReadyFile);

      // Should show year selection
      await waitFor(() => {
        expect(screen.getByText('Academic Year')).toBeInTheDocument();
      });

      const yearSelect = screen.getByRole('combobox', { name: /academic year/i });
      await user.selectOptions(yearSelect, 'Current');

      // Process import
      const importButton = screen.getByRole('button', { name: /import iready data/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('iReady Import Successful')).toBeInTheDocument();
      });

      // Should show score summary
      const scoreSummary = screen.getByTestId('score-summary');
      expect(within(scoreSummary).getByText('ELA Scores: 600')).toBeInTheDocument();
      expect(within(scoreSummary).getByText('Math Scores: 600')).toBeInTheDocument();

      // Navigate to dashboard
      const dashboardLink = screen.getByRole('link', { name: /view dashboard/i });
      await user.click(dashboardLink);

      // Dashboard should show academic performance section
      await waitFor(() => {
        expect(screen.getByText('Academic Performance')).toBeInTheDocument();
      });

      expect(screen.getByTestId('iready-overview')).toBeInTheDocument();
      expect(screen.getByText('Current Year Diagnostics Complete')).toBeInTheDocument();
    });

    it('should handle multi-year iReady data imports correctly', async () => {
      // This test will FAIL - requires multi-year data handling
      const user = userEvent.setup();

      // Mock multi-year CSV content
      const multiYearCSV = `Student ID,Grade,ELA Score,Math Score,Year
STU001,K,485,456,Current
STU001,K,456,423,Previous
STU001,K,425,398,Two-Years-Ago
STU002,K,468,434,Current
STU002,K,445,401,Previous`;

      Object.defineProperty(FileReader.prototype, 'readAsText', {
        value: function() {
          setTimeout(() => {
            this.onload?.({ target: { result: multiYearCSV } });
          }, 10);
        }
      });

      render(<CSVImportPage />);

      const iReadyTab = screen.getByRole('tab', { name: /iready scores/i });
      await user.click(iReadyTab);

      const multiYearFile = new File([multiYearCSV], 'multi-year.csv', { type: 'text/csv' });
      const fileInput = screen.getByLabelText(/upload iready csv/i);
      await user.upload(fileInput, multiYearFile);

      // Should detect multi-year data
      await waitFor(() => {
        expect(screen.getByText('Multi-year data detected')).toBeInTheDocument();
      });

      // Should show year distribution
      const yearBreakdown = screen.getByTestId('year-breakdown');
      expect(within(yearBreakdown).getByText('Current: 2 students')).toBeInTheDocument();
      expect(within(yearBreakdown).getByText('Previous: 2 students')).toBeInTheDocument();
      expect(within(yearBreakdown).getByText('Two-Years-Ago: 1 student')).toBeInTheDocument();

      const importButton = screen.getByRole('button', { name: /import all years/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Multi-year Import Complete')).toBeInTheDocument();
      });

      // Navigate to dashboard and check trends
      const dashboardLink = screen.getByRole('link', { name: /view dashboard/i });
      await user.click(dashboardLink);

      await waitFor(() => {
        expect(screen.getByTestId('growth-trends')).toBeInTheDocument();
      });

      // Should show year-over-year growth calculations
      expect(screen.getByText('Year-over-Year Growth')).toBeInTheDocument();
      expect(screen.getByTestId('ela-growth-trend')).toBeInTheDocument();
      expect(screen.getByTestId('math-growth-trend')).toBeInTheDocument();
    });
  });

  describe('Data processing and tier calculations', () => {
    it('should correctly calculate attendance tiers after import', async () => {
      // This test will FAIL - requires tier calculation implementation
      const user = userEvent.setup();

      const tierTestCSV = `Student ID,First Name,Last Name,Grade,Total Absences,School Days
STU001,John,Doe,K,2,100
STU002,Jane,Smith,K,5,100
STU003,Bob,Johnson,K,15,100
STU004,Alice,Brown,K,25,100`;

      Object.defineProperty(FileReader.prototype, 'readAsText', {
        value: function() {
          setTimeout(() => {
            this.onload?.({ target: { result: tierTestCSV } });
          }, 10);
        }
      });

      render(<CSVImportPage />);

      const tierFile = new File([tierTestCSV], 'tier-test.csv', { type: 'text/csv' });
      const fileInput = screen.getByLabelText(/upload attendance csv/i);
      await user.upload(fileInput, tierFile);

      const importButton = screen.getByRole('button', { name: /import data/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Import Successful')).toBeInTheDocument();
      });

      // Should show calculated tier distribution
      const tierSummary = screen.getByTestId('tier-summary');
      expect(within(tierSummary).getByText('Tier 1 (1-2 absences): 1 student')).toBeInTheDocument();
      expect(within(tierSummary).getByText('Tier 2 (3-9 absences): 1 student')).toBeInTheDocument();
      expect(within(tierSummary).getByText('Tier 3 (10+ absences): 2 students')).toBeInTheDocument();

      // Business rule validation
      expect(within(tierSummary).getByText('Chronic absentees (>10%): 2 students')).toBeInTheDocument();
    });

    it('should validate business rules during import', async () => {
      // This test will FAIL - requires business rule validation
      const user = userEvent.setup();

      server.use(
        rest.post('/api/import/attendance', (req, res, ctx) => {
          return res(ctx.json({
            success: false,
            businessRuleViolations: [
              {
                rule: 'attendance_rate_calculation',
                message: 'Attendance rate does not match calculated value',
                affectedRows: [3, 7, 12],
                expected: '94.5%',
                actual: '95.0%'
              },
              {
                rule: 'tier_assignment',
                message: 'Tier assignment inconsistent with absence count',
                affectedRows: [15],
                studentId: 'STU015',
                absences: 8,
                assignedTier: 1,
                expectedTier: 2
              }
            ]
          }));
        })
      );

      render(<CSVImportPage />);

      const invalidFile = new File(['invalid business rules'], 'invalid.csv', { type: 'text/csv' });
      const fileInput = screen.getByLabelText(/upload attendance csv/i);
      await user.upload(fileInput, invalidFile);

      const importButton = screen.getByRole('button', { name: /import data/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Business Rule Violations')).toBeInTheDocument();
      });

      const violations = screen.getByTestId('business-rule-violations');
      expect(within(violations).getByText('Attendance rate calculation error')).toBeInTheDocument();
      expect(within(violations).getByText('Tier assignment inconsistent')).toBeInTheDocument();

      // Should offer auto-correction
      expect(screen.getByRole('button', { name: /auto-correct violations/i })).toBeInTheDocument();
    });

    it('should handle conference data import and link to students', async () => {
      // This test will FAIL - requires conference data integration
      const user = userEvent.setup();

      render(<CSVImportPage />);

      // Switch to conference data tab
      const conferenceTab = screen.getByRole('tab', { name: /conference data/i });
      await user.click(conferenceTab);

      const conferenceCSV = `Student ID,Conference Date,Type,Attendees,Notes,Follow-up Required
STU001,2024-12-15,parent-teacher,"Parent: Jane Doe, Teacher: Ms. Smith",Discussed attendance concerns,Yes
STU002,2024-12-16,parent-teacher-admin,"Parent: John Smith, Teacher: Ms. Smith, Principal: Dr. Johnson",Attendance intervention plan,Yes`;

      Object.defineProperty(FileReader.prototype, 'readAsText', {
        value: function() {
          setTimeout(() => {
            this.onload?.({ target: { result: conferenceCSV } });
          }, 10);
        }
      });

      const conferenceFile = new File([conferenceCSV], 'conferences.csv', { type: 'text/csv' });
      const fileInput = screen.getByLabelText(/upload conference csv/i);
      await user.upload(fileInput, conferenceFile);

      const importButton = screen.getByRole('button', { name: /import conferences/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Conference Import Successful')).toBeInTheDocument();
      });

      // Should link conferences to existing students
      const linkingSummary = screen.getByTestId('linking-summary');
      expect(within(linkingSummary).getByText('Conferences linked: 2')).toBeInTheDocument();
      expect(within(linkingSummary).getByText('Students affected: 2')).toBeInTheDocument();
      expect(within(linkingSummary).getByText('Follow-ups required: 2')).toBeInTheDocument();
    });
  });

  describe('Real-time dashboard updates', () => {
    it('should update dashboard in real-time during import process', async () => {
      // This test will FAIL - requires real-time updates implementation
      const user = userEvent.setup();

      // Mock progressive import updates
      let importProgress = 0;
      server.use(
        rest.post('/api/import/attendance', (req, res, ctx) => {
          return res(
            ctx.delay(2000),
            ctx.json({
              success: true,
              processed: 1250,
              progress: 100
            })
          );
        }),
        rest.get('/api/import/progress', (req, res, ctx) => {
          importProgress += 25;
          return res(ctx.json({
            progress: Math.min(importProgress, 100),
            currentRecord: Math.min(importProgress * 12.5, 1250),
            totalRecords: 1250,
            estimatedTimeRemaining: Math.max(0, (100 - importProgress) * 0.5)
          }));
        })
      );

      // Start import
      render(<CSVImportPage />);

      const file = new File(['test'], 'test.csv', { type: 'text/csv' });
      const fileInput = screen.getByLabelText(/upload attendance csv/i);
      await user.upload(fileInput, file);

      const importButton = screen.getByRole('button', { name: /import data/i });
      await user.click(importButton);

      // Should show real-time progress
      await waitFor(() => {
        expect(screen.getByTestId('import-progress')).toBeInTheDocument();
      });

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();

      // Progress should update in real-time
      await waitFor(() => {
        expect(screen.getByText(/processing record \d+ of 1,250/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Import Complete')).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should allow dashboard viewing during import with live updates', async () => {
      // This test will FAIL - requires concurrent dashboard updates
      const user = userEvent.setup();

      // Start long-running import
      render(<CSVImportPage />);

      const file = new File(['large file'], 'large.csv', { type: 'text/csv' });
      const fileInput = screen.getByLabelText(/upload attendance csv/i);
      await user.upload(fileInput, file);

      const importButton = screen.getByRole('button', { name: /import data/i });
      await user.click(importButton);

      // Should allow navigation to dashboard during import
      const viewDashboardButton = screen.getByRole('button', { name: /view dashboard while importing/i });
      await user.click(viewDashboardButton);

      // Dashboard should show import status
      await waitFor(() => {
        expect(screen.getByText('School Overview')).toBeInTheDocument();
      });

      const importStatus = screen.getByTestId('import-status-banner');
      expect(importStatus).toBeInTheDocument();
      expect(within(importStatus).getByText('Import in progress')).toBeInTheDocument();
      expect(within(importStatus).getByRole('progressbar')).toBeInTheDocument();

      // Metrics should update as import progresses
      await waitFor(() => {
        expect(screen.getByTestId('updating-metrics')).toHaveClass('animate-pulse');
      });
    });
  });

  describe('Error recovery and rollback', () => {
    it('should rollback changes if import fails partway through', async () => {
      // This test will FAIL - requires rollback implementation
      const user = userEvent.setup();

      server.use(
        rest.post('/api/import/attendance', (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json({
              success: false,
              error: 'Database connection lost during import',
              processedRecords: 850,
              totalRecords: 1250,
              rollbackRequired: true
            })
          );
        })
      );

      render(<CSVImportPage />);

      const file = new File(['test'], 'test.csv', { type: 'text/csv' });
      const fileInput = screen.getByLabelText(/upload attendance csv/i);
      await user.upload(fileInput, file);

      const importButton = screen.getByRole('button', { name: /import data/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Import Failed')).toBeInTheDocument();
      });

      // Should show rollback option
      const rollbackSection = screen.getByTestId('rollback-section');
      expect(within(rollbackSection).getByText('850 records were imported before failure')).toBeInTheDocument();
      expect(within(rollbackSection).getByRole('button', { name: /rollback changes/i })).toBeInTheDocument();

      // Execute rollback
      const rollbackButton = screen.getByRole('button', { name: /rollback changes/i });
      await user.click(rollbackButton);

      await waitFor(() => {
        expect(screen.getByText('Rollback Complete')).toBeInTheDocument();
      });

      expect(screen.getByText('All imported data has been removed')).toBeInTheDocument();
    });

    it('should preserve data integrity during concurrent imports', async () => {
      // This test will FAIL - requires concurrency handling
      const user = userEvent.setup();

      server.use(
        rest.post('/api/import/attendance', (req, res, ctx) => {
          return res(
            ctx.status(409),
            ctx.json({
              success: false,
              error: 'Another import is currently in progress',
              conflictType: 'concurrent_import',
              activeImportId: 'IMPORT_123',
              estimatedCompletion: '2025-01-15T11:45:00Z'
            })
          );
        })
      );

      render(<CSVImportPage />);

      const file = new File(['test'], 'test.csv', { type: 'text/csv' });
      const fileInput = screen.getByLabelText(/upload attendance csv/i);
      await user.upload(fileInput, file);

      const importButton = screen.getByRole('button', { name: /import data/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Import Conflict')).toBeInTheDocument();
      });

      const conflictDialog = screen.getByTestId('import-conflict-dialog');
      expect(within(conflictDialog).getByText('Another import is in progress')).toBeInTheDocument();
      expect(within(conflictDialog).getByText('Estimated completion: 11:45 AM')).toBeInTheDocument();

      // Should offer queue or cancel options
      expect(within(conflictDialog).getByRole('button', { name: /queue import/i })).toBeInTheDocument();
      expect(within(conflictDialog).getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });
  });

  describe('FERPA compliance during import', () => {
    it('should audit all data access during import process', async () => {
      // This test will FAIL - requires audit trail implementation
      const user = userEvent.setup();

      render(<CSVImportPage />);

      const file = new File(['sensitive data'], 'sensitive.csv', { type: 'text/csv' });
      const fileInput = screen.getByLabelText(/upload attendance csv/i);
      await user.upload(fileInput, file);

      // Should show FERPA compliance notice
      await waitFor(() => {
        expect(screen.getByTestId('ferpa-notice')).toBeInTheDocument();
      });

      const ferpaNotice = screen.getByTestId('ferpa-notice');
      expect(within(ferpaNotice).getByText('FERPA Compliance')).toBeInTheDocument();
      expect(within(ferpaNotice).getByText('All data access is logged and audited')).toBeInTheDocument();

      // Must acknowledge before proceeding
      const acknowledgeCheckbox = screen.getByRole('checkbox', { name: /i acknowledge FERPA requirements/i });
      await user.click(acknowledgeCheckbox);

      const importButton = screen.getByRole('button', { name: /import data/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Import Successful')).toBeInTheDocument();
      });

      // Should show audit trail information
      const auditInfo = screen.getByTestId('audit-info');
      expect(within(auditInfo).getByText('Import logged: ID #')).toBeInTheDocument();
      expect(within(auditInfo).getByText('User: Test Teacher')).toBeInTheDocument();
      expect(within(auditInfo).getByText('Records accessed: 1,250')).toBeInTheDocument();
    });

    it('should redact sensitive data from error messages', async () => {
      // This test will FAIL - requires data redaction implementation
      const user = userEvent.setup();

      server.use(
        rest.post('/api/import/attendance', (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({
              success: false,
              sanitizedErrors: [
                { row: 5, error: 'Invalid data format in student record' },
                { row: 12, error: 'Missing required field: attendance rate' }
              ],
              // Actual errors would contain sensitive data but should be redacted
            })
          );
        })
      );

      render(<CSVImportPage />);

      const file = new File(['sensitive'], 'test.csv', { type: 'text/csv' });
      const fileInput = screen.getByLabelText(/upload attendance csv/i);
      await user.upload(fileInput, file);

      const importButton = screen.getByRole('button', { name: /import data/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Import Errors')).toBeInTheDocument();
      });

      const errorList = screen.getAllByTestId(/error-message-/);
      errorList.forEach(error => {
        // Should not contain student names, SSNs, or other sensitive data
        expect(error.textContent).not.toMatch(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/); // Names
        expect(error.textContent).not.toMatch(/\d{3}-\d{2}-\d{4}/); // SSNs
        expect(error.textContent).not.toMatch(/STU\d{3}/); // Student IDs should be redacted
      });
    });
  });
});
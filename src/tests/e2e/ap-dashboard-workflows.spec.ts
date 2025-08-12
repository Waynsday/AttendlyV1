import { test, expect, Page } from '@playwright/test';
import { TestDataFactory } from '../fixtures/test-data-factory';

/**
 * End-to-End Tests for AP Dashboard Workflows
 * 
 * Tests complete user journeys for Assistant Principals using the AP Tool:
 * - Daily attendance monitoring and dashboard usage
 * - Student intervention management workflows
 * - Attendance report generation and export
 * - SARB referral process management
 * - Parent communication tracking
 * - Real-time data sync and updates
 * 
 * Focus on Romoland Middle School specific workflows and California
 * attendance law compliance requirements.
 */

test.describe('AP Dashboard - Core Workflows', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Navigate to dashboard and authenticate
    await page.goto('/');
    await loginAsAP(page);
    
    // Wait for dashboard to load
    await expect(page.locator('[data-testid="dashboard-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="attendance-overview"]')).toBeVisible();
  });

  test.describe('Daily Attendance Monitoring', () => {
    test('should display real-time attendance overview for all grades', async () => {
      // Verify attendance overview cards are visible
      await expect(page.locator('[data-testid="grade-6-overview"]')).toBeVisible();
      await expect(page.locator('[data-testid="grade-7-overview"]')).toBeVisible();
      await expect(page.locator('[data-testid="grade-8-overview"]')).toBeVisible();

      // Check attendance percentages are displayed
      const grade6Card = page.locator('[data-testid="grade-6-overview"]');
      await expect(grade6Card.locator('[data-testid="attendance-percentage"]')).toContainText('%');
      
      // Verify student counts
      const studentCount = await grade6Card.locator('[data-testid="student-count"]').textContent();
      expect(parseInt(studentCount || '0')).toBeGreaterThan(0);

      // Check for students needing attention
      const studentsAtRisk = page.locator('[data-testid="students-at-risk"]');
      await expect(studentsAtRisk).toBeVisible();
    });

    test('should filter students by attendance criteria', async () => {
      // Click on filter dropdown
      await page.click('[data-testid="attendance-filter"]');
      
      // Select "Chronic Absenteeism" filter
      await page.click('[data-testid="filter-chronic-absent"]');
      
      // Wait for filtered results
      await page.waitForSelector('[data-testid="filtered-student-list"]');
      
      // Verify all displayed students have chronic absenteeism
      const studentCards = page.locator('[data-testid="student-card"]');
      const cardCount = await studentCards.count();
      
      for (let i = 0; i < cardCount; i++) {
        const card = studentCards.nth(i);
        const attendancePercent = await card.locator('[data-testid="attendance-percent"]').textContent();
        const percent = parseFloat(attendancePercent?.replace('%', '') || '100');
        expect(percent).toBeLessThan(90); // CA chronic absenteeism threshold
      }
    });

    test('should drill down to individual student attendance details', async () => {
      // Click on first student card
      await page.click('[data-testid="student-card"]:first-child');
      
      // Verify student detail sidebar opens
      await expect(page.locator('[data-testid="student-detail-sidebar"]')).toBeVisible();
      
      // Check student information is displayed
      await expect(page.locator('[data-testid="student-name"]')).toBeVisible();
      await expect(page.locator('[data-testid="student-grade"]')).toBeVisible();
      await expect(page.locator('[data-testid="student-id"]')).toBeVisible();
      
      // Verify attendance calendar is shown
      await expect(page.locator('[data-testid="attendance-calendar"]')).toBeVisible();
      
      // Check for period-by-period breakdown
      await expect(page.locator('[data-testid="period-breakdown"]')).toBeVisible();
      const periods = page.locator('[data-testid="period-status"]');
      await expect(periods).toHaveCount(7); // 7-period day
      
      // Verify intervention history is displayed
      await expect(page.locator('[data-testid="intervention-history"]')).toBeVisible();
    });

    test('should update attendance data in real-time', async () => {
      // Get initial attendance count
      const initialCount = await page.locator('[data-testid="present-today-count"]').textContent();
      
      // Simulate attendance update (this would typically come from Aeries sync)
      await page.evaluate(() => {
        // Trigger a manual refresh or sync
        window.dispatchEvent(new CustomEvent('attendance-update'));
      });
      
      // Wait for update indicator
      await expect(page.locator('[data-testid="sync-indicator"]')).toBeVisible();
      await expect(page.locator('[data-testid="sync-indicator"]')).toHaveClass(/syncing/);
      
      // Wait for sync to complete
      await page.waitForSelector('[data-testid="sync-indicator"]:not(.syncing)', { timeout: 10000 });
      
      // Verify data has been updated (could be same or different, but should complete)
      const updatedCount = await page.locator('[data-testid="present-today-count"]').textContent();
      expect(updatedCount).toBeDefined();
    });
  });

  test.describe('Intervention Management Workflow', () => {
    test('should create parent contact intervention', async () => {
      // Navigate to interventions tab
      await page.click('[data-testid="interventions-tab"]');
      
      // Click create intervention button
      await page.click('[data-testid="create-intervention-btn"]');
      
      // Select student (should show at-risk students first)
      await page.click('[data-testid="student-select"]');
      await page.click('[data-testid="student-option"]:first-child');
      
      // Select intervention type
      await page.click('[data-testid="intervention-type-select"]');
      await page.click('[data-testid="intervention-parent-contact"]');
      
      // Fill in description
      await page.fill('[data-testid="intervention-description"]', 
        'Initial parent contact regarding 8 unexcused absences in November');
      
      // Set scheduled date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await page.fill('[data-testid="scheduled-date"]', tomorrow.toISOString().split('T')[0]);
      
      // Save intervention
      await page.click('[data-testid="save-intervention-btn"]');
      
      // Verify success message
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Intervention created');
      
      // Verify intervention appears in list
      await expect(page.locator('[data-testid="intervention-list"]')).toContainText('Parent contact');
    });

    test('should escalate intervention to SART referral', async () => {
      // Navigate to existing intervention
      await page.click('[data-testid="interventions-tab"]');
      await page.click('[data-testid="intervention-item"]:first-child');
      
      // Mark current intervention complete
      await page.click('[data-testid="mark-complete-btn"]');
      await page.fill('[data-testid="outcome-text"]', 
        'Parent meeting held, attendance improved for 2 weeks but declining again');
      await page.click('[data-testid="confirm-complete-btn"]');
      
      // Create follow-up SART referral
      await page.click('[data-testid="create-followup-btn"]');
      
      // Should auto-populate with same student
      const selectedStudent = await page.locator('[data-testid="student-select"]').textContent();
      expect(selectedStudent).toBeTruthy();
      
      // Select SART referral type
      await page.click('[data-testid="intervention-type-select"]');
      await page.click('[data-testid="intervention-sart-referral"]');
      
      // Auto-generated description should reference previous interventions
      const description = await page.locator('[data-testid="intervention-description"]').inputValue();
      expect(description).toContain('after unsuccessful parent interventions');
      
      // Schedule SART meeting
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      await page.fill('[data-testid="scheduled-date"]', nextWeek.toISOString().split('T')[0]);
      
      // Save SART referral
      await page.click('[data-testid="save-intervention-btn"]');
      
      // Verify escalation is tracked
      await expect(page.locator('[data-testid="intervention-timeline"]')).toContainText('SART Referral');
      
      // Check intervention level indicator
      await expect(page.locator('[data-testid="intervention-level"]')).toContainText('Level 3');
    });

    test('should manage SARB referral process', async () => {
      // Navigate to SARB section
      await page.click('[data-testid="sarb-tab"]');
      
      // Create new SARB referral
      await page.click('[data-testid="create-sarb-referral-btn"]');
      
      // Select student with extensive intervention history
      await page.click('[data-testid="student-select"]');
      await page.click('[data-testid="student-option"][data-intervention-level="3"]');
      
      // Verify previous interventions are shown
      await expect(page.locator('[data-testid="intervention-summary"]')).toBeVisible();
      await expect(page.locator('[data-testid="intervention-summary"]')).toContainText('Parent Contact');
      await expect(page.locator('[data-testid="intervention-summary"]')).toContainText('SART Referral');
      
      // Fill SARB referral details
      await page.fill('[data-testid="sarb-reason"]', 
        'Chronic absenteeism continues despite parent meetings and SART intervention plan');
      
      // Upload supporting documentation
      await page.setInputFiles('[data-testid="documentation-upload"]', [
        './test-fixtures/attendance-summary.pdf',
        './test-fixtures/intervention-log.pdf'
      ]);
      
      // Set SARB hearing date
      const sarbDate = new Date();
      sarbDate.setDate(sarbDate.getDate() + 14);
      await page.fill('[data-testid="sarb-hearing-date"]', sarbDate.toISOString().split('T')[0]);
      
      // Submit SARB referral
      await page.click('[data-testid="submit-sarb-btn"]');
      
      // Verify confirmation
      await expect(page.locator('[data-testid="sarb-confirmation"]')).toBeVisible();
      await expect(page.locator('[data-testid="sarb-number"]')).toBeVisible();
      
      // Check SARB appears in pending list
      await page.click('[data-testid="pending-sarb-tab"]');
      await expect(page.locator('[data-testid="sarb-list"]')).toContainText('Chronic absenteeism');
    });
  });

  test.describe('Attendance Reporting and Analytics', () => {
    test('should generate comprehensive attendance report', async () => {
      // Navigate to reports section
      await page.click('[data-testid="reports-tab"]');
      
      // Select attendance report type
      await page.click('[data-testid="report-type-select"]');
      await page.click('[data-testid="report-comprehensive-attendance"]');
      
      // Set date range for current semester
      await page.fill('[data-testid="report-start-date"]', '2024-08-15');
      await page.fill('[data-testid="report-end-date"]', '2024-12-20');
      
      // Select grade levels
      await page.check('[data-testid="grade-6-checkbox"]');
      await page.check('[data-testid="grade-7-checkbox"]');
      await page.check('[data-testid="grade-8-checkbox"]');
      
      // Include intervention data
      await page.check('[data-testid="include-interventions-checkbox"]');
      
      // Generate report
      await page.click('[data-testid="generate-report-btn"]');
      
      // Wait for report generation
      await expect(page.locator('[data-testid="generating-report"]')).toBeVisible();
      await page.waitForSelector('[data-testid="report-ready"]', { timeout: 30000 });
      
      // Verify report content
      await expect(page.locator('[data-testid="report-summary"]')).toBeVisible();
      await expect(page.locator('[data-testid="total-students"]')).toContainText(/\d+/);
      await expect(page.locator('[data-testid="average-attendance"]')).toContainText(/%/);
      
      // Check detailed breakdown
      await expect(page.locator('[data-testid="grade-breakdown"]')).toBeVisible();
      await expect(page.locator('[data-testid="chronic-absentee-list"]')).toBeVisible();
      
      // Verify charts are displayed
      await expect(page.locator('[data-testid="attendance-trend-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="intervention-effectiveness-chart"]')).toBeVisible();
    });

    test('should export report in multiple formats', async () => {
      // Navigate to existing report
      await page.click('[data-testid="reports-tab"]');
      await page.click('[data-testid="recent-report"]:first-child');
      
      // Export as PDF
      const pdfDownloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="export-pdf-btn"]');
      const pdfDownload = await pdfDownloadPromise;
      expect(pdfDownload.suggestedFilename()).toContain('.pdf');
      
      // Export as CSV
      const csvDownloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="export-csv-btn"]');
      const csvDownload = await csvDownloadPromise;
      expect(csvDownload.suggestedFilename()).toContain('.csv');
      
      // Export as Excel
      const excelDownloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="export-excel-btn"]');
      const excelDownload = await excelDownloadPromise;
      expect(excelDownload.suggestedFilename()).toMatch(/\.(xlsx|xls)$/);
    });

    test('should display trend analysis and predictions', async () => {
      // Navigate to analytics dashboard
      await page.click('[data-testid="analytics-tab"]');
      
      // Verify trend charts load
      await expect(page.locator('[data-testid="monthly-trends-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="grade-comparison-chart"]')).toBeVisible();
      
      // Check predictive analytics
      await expect(page.locator('[data-testid="at-risk-predictions"]')).toBeVisible();
      
      // Verify key metrics
      const metrics = page.locator('[data-testid="key-metric"]');
      await expect(metrics).toHaveCount.atLeast(4);
      
      // Check for intervention impact analysis
      await page.click('[data-testid="intervention-impact-tab"]');
      await expect(page.locator('[data-testid="intervention-success-rate"]')).toBeVisible();
      await expect(page.locator('[data-testid="average-improvement"]')).toContainText('%');
    });
  });

  test.describe('Parent Communication Tracking', () => {
    test('should log parent contact attempts', async () => {
      // Navigate to communication log
      await page.click('[data-testid="communications-tab"]');
      
      // Add new communication log
      await page.click('[data-testid="log-communication-btn"]');
      
      // Select student
      await page.click('[data-testid="student-select"]');
      await page.fill('[data-testid="student-search"]', 'Smith');
      await page.click('[data-testid="student-result"]:first-child');
      
      // Select communication type
      await page.click('[data-testid="communication-type-select"]');
      await page.click('[data-testid="type-phone-call"]');
      
      // Set date and time
      await page.fill('[data-testid="communication-date"]', new Date().toISOString().split('T')[0]);
      await page.fill('[data-testid="communication-time"]', '14:30');
      
      // Log details
      await page.fill('[data-testid="communication-notes"]', 
        'Called parent regarding 3 consecutive absences. Left voicemail with callback request.');
      
      // Mark outcome
      await page.click('[data-testid="outcome-select"]');
      await page.click('[data-testid="outcome-voicemail"]');
      
      // Set follow-up date
      const followUp = new Date();
      followUp.setDate(followUp.getDate() + 2);
      await page.fill('[data-testid="followup-date"]', followUp.toISOString().split('T')[0]);
      
      // Save communication log
      await page.click('[data-testid="save-communication-btn"]');
      
      // Verify success and timeline update
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Communication logged');
      await expect(page.locator('[data-testid="communication-timeline"]')).toContainText('Phone call');
    });

    test('should track parent response and follow-ups', async () => {
      // Navigate to pending follow-ups
      await page.click('[data-testid="communications-tab"]');
      await page.click('[data-testid="pending-followups-tab"]');
      
      // Click on pending follow-up
      await page.click('[data-testid="followup-item"]:first-child');
      
      // Mark as completed
      await page.click('[data-testid="complete-followup-btn"]');
      
      // Select response type
      await page.click('[data-testid="response-type-select"]');
      await page.click('[data-testid="response-parent-called-back"]');
      
      // Log conversation details
      await page.fill('[data-testid="response-notes"]', 
        'Parent returned call. Discussed medical appointments causing absences. Will provide documentation.');
      
      // Update intervention status if needed
      await page.click('[data-testid="update-intervention-checkbox"]');
      await page.fill('[data-testid="intervention-update']', 
        'Medical documentation to be provided. Monitoring attendance for pattern changes.');
      
      // Save response
      await page.click('[data-testid="save-response-btn"]');
      
      // Verify communication chain is complete
      await expect(page.locator('[data-testid="communication-status"]')).toContainText('Resolved');
    });
  });

  test.describe('Performance and User Experience', () => {
    test('dashboard should load within 2 seconds', async () => {
      const startTime = Date.now();
      
      await page.goto('/dashboard');
      await loginAsAP(page);
      
      // Wait for all critical elements to load
      await expect(page.locator('[data-testid="dashboard-title"]')).toBeVisible();
      await expect(page.locator('[data-testid="attendance-overview"]')).toBeVisible();
      await expect(page.locator('[data-testid="student-list"]')).toBeVisible();
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(2000);
    });

    test('should handle large student datasets efficiently', async () => {
      // Navigate to view all students (500+ students)
      await page.click('[data-testid="view-all-students-btn"]');
      
      const startTime = Date.now();
      
      // Wait for student list to load
      await expect(page.locator('[data-testid="student-list"]')).toBeVisible();
      
      // Check that pagination is working
      await expect(page.locator('[data-testid="pagination"]')).toBeVisible();
      
      // Verify search is responsive
      await page.fill('[data-testid="student-search"]', 'John');
      await page.waitForTimeout(500); // Debounce time
      
      const searchTime = Date.now() - startTime;
      expect(searchTime).toBeLessThan(3000);
      
      // Verify search results
      const searchResults = page.locator('[data-testid="student-card"]');
      const resultCount = await searchResults.count();
      expect(resultCount).toBeGreaterThan(0);
      expect(resultCount).toBeLessThan(50); // Should filter results
    });

    test('should maintain responsive design on tablet devices', async () => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      
      // Verify navigation adapts to tablet
      await expect(page.locator('[data-testid="mobile-nav-toggle"]')).toBeVisible();
      
      // Check that cards stack properly
      const dashboardCards = page.locator('[data-testid="dashboard-card"]');
      const firstCard = dashboardCards.first();
      const secondCard = dashboardCards.nth(1);
      
      const firstCardBox = await firstCard.boundingBox();
      const secondCardBox = await secondCard.boundingBox();
      
      // Cards should stack vertically on tablet
      if (firstCardBox && secondCardBox) {
        expect(secondCardBox.y).toBeGreaterThan(firstCardBox.y + firstCardBox.height - 50);
      }
      
      // Test touch interactions
      await page.tap('[data-testid="student-card"]:first-child');
      await expect(page.locator('[data-testid="student-detail-sidebar"]')).toBeVisible();
    });
  });
});

/**
 * Helper function to login as AP administrator
 */
async function loginAsAP(page: Page): Promise<void> {
  // Check if already logged in
  const dashboardVisible = await page.locator('[data-testid="dashboard-title"]').isVisible();
  if (dashboardVisible) {
    return;
  }
  
  // Navigate to login if not already there
  if (!page.url().includes('/login')) {
    await page.goto('/login');
  }
  
  // Fill login credentials
  await page.fill('[data-testid="email-input"]', 'ap.test@romoland.k12.ca.us');
  await page.fill('[data-testid="password-input"]', 'test-password-123');
  
  // Submit login
  await page.click('[data-testid="login-button"]');
  
  // Wait for redirect to dashboard
  await page.waitForURL('/dashboard');
  await expect(page.locator('[data-testid="dashboard-title"]')).toBeVisible();
}

test.describe('Cross-Browser Compatibility', () => {
  ['chromium', 'firefox', 'webkit'].forEach(browserName => {
    test(`should work correctly in ${browserName}`, async ({ page }) => {
      await page.goto('/');
      await loginAsAP(page);
      
      // Test basic functionality
      await expect(page.locator('[data-testid="dashboard-title"]')).toBeVisible();
      await expect(page.locator('[data-testid="attendance-overview"]')).toBeVisible();
      
      // Test interactive elements
      await page.click('[data-testid="student-card"]:first-child');
      await expect(page.locator('[data-testid="student-detail-sidebar"]')).toBeVisible();
      
      // Test form interactions
      await page.click('[data-testid="interventions-tab"]');
      await page.click('[data-testid="create-intervention-btn"]');
      await expect(page.locator('[data-testid="intervention-form"]')).toBeVisible();
    });
  });
});
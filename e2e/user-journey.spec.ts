/**
 * @file user-journey.spec.ts
 * @description End-to-end tests for complete user journey from login to intervention assignment
 * Tests critical workflows that teachers and administrators use daily
 * Tests are designed to FAIL initially to enable TDD implementation
 */

import { test, expect, Page } from '@playwright/test';

// Test data constants
const TEACHER_CREDENTIALS = {
  email: 'teacher@romoland.edu',
  password: 'test123',
  name: 'Ms. Smith'
};

const ADMIN_CREDENTIALS = {
  email: 'admin@romoland.edu',
  password: 'admin123',
  name: 'Dr. Johnson'
};

const STUDENT_DATA = {
  id: 'STU001',
  name: 'John Doe',
  grade: 'K',
  attendanceRate: 85.3,
  tier: 3
};

// Helper functions
async function loginAsTeacher(page: Page) {
  await page.goto('/login');
  await page.fill('[data-testid=email-input]', TEACHER_CREDENTIALS.email);
  await page.fill('[data-testid=password-input]', TEACHER_CREDENTIALS.password);
  await page.click('[data-testid=login-button]');
  await expect(page.locator('[data-testid=dashboard-header]')).toBeVisible();
}

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.fill('[data-testid=email-input]', ADMIN_CREDENTIALS.email);
  await page.fill('[data-testid=password-input]', ADMIN_CREDENTIALS.password);
  await page.click('[data-testid=login-button]');
  await expect(page.locator('[data-testid=admin-dashboard]')).toBeVisible();
}

test.describe('Teacher User Journey', () => {
  test.beforeEach(async ({ page }) => {
    // This will FAIL initially - no login system implemented
    await loginAsTeacher(page);
  });

  test('complete workflow: identify at-risk student and assign intervention', async ({ page }) => {
    // This test will FAIL - no implementation exists yet
    
    // Step 1: Teacher reviews dashboard and identifies concerning trends
    await expect(page.locator('[data-testid=school-overview]')).toContainText('School Overview');
    
    // Should see grade-level attendance cards
    const gradeCards = page.locator('[data-testid^=grade-card-]');
    await expect(gradeCards).toHaveCount(6); // K-5 grades
    
    // Find high-risk grade (Grade K in this case)
    const gradeKCard = page.locator('[data-testid=grade-card-K]');
    await expect(gradeKCard).toBeVisible();
    
    // Should show concerning metrics
    await expect(gradeKCard).toContainText('85.3%'); // Below 90% threshold
    await expect(gradeKCard).toHaveClass(/.*border-red-.*/) // High risk styling
    
    // Click on Grade K card to drill down
    await gradeKCard.click();
    
    // Step 2: Navigate to attendance page filtered by grade
    await expect(page).toHaveURL('/attendance?grade=K');
    await expect(page.locator('[data-testid=page-title]')).toContainText('Grade K Attendance');
    
    // Should see filtered student list
    const studentTable = page.locator('[data-testid=student-table]');
    await expect(studentTable).toBeVisible();
    
    // Filter by Tier 3 (chronic absentees)
    await page.selectOption('[data-testid=tier-filter]', '3');
    await expect(page.locator('[data-testid=filter-results]')).toContainText('Showing Tier 3 students');
    
    // Step 3: Identify specific at-risk student (John Doe)
    const johnDoeRow = page.locator('[data-testid=student-row]').filter({ hasText: 'John Doe' });
    await expect(johnDoeRow).toBeVisible();
    
    // Verify tier 3 badge is visible
    await expect(johnDoeRow.locator('[data-testid=tier-badge-3]')).toBeVisible();
    await expect(johnDoeRow.locator('[data-testid=attendance-rate]')).toContainText('85.3%');
    
    // Click on student row to open details side panel
    await johnDoeRow.click();
    
    // Step 4: Review detailed student information
    const sidePanel = page.locator('[data-testid=student-side-panel]');
    await expect(sidePanel).toBeVisible();
    await expect(sidePanel).toContainText('John Doe');
    await expect(sidePanel).toContainText('Grade K');
    
    // Review attendance history
    const attendanceHistory = sidePanel.locator('[data-testid=attendance-history]');
    await expect(attendanceHistory).toBeVisible();
    await expect(attendanceHistory).toContainText('Recent Attendance');
    
    // Should show concerning attendance pattern
    await expect(attendanceHistory.locator('[data-testid=status-absent]')).toHaveCount(3); // Multiple recent absences
    
    // Review iReady scores for academic impact
    const iReadyScores = sidePanel.locator('[data-testid=iready-scores]');
    await expect(iReadyScores).toBeVisible();
    await expect(iReadyScores).toContainText('Below Grade Level'); // Academic impact visible
    
    // Step 5: Assign intervention
    const interventionSection = sidePanel.locator('[data-testid=interventions-section]');
    await expect(interventionSection).toBeVisible();
    
    // Click "Add Intervention" button
    await interventionSection.locator('[data-testid=add-intervention-button]').click();
    
    // Intervention assignment modal should open
    const interventionModal = page.locator('[data-testid=intervention-modal]');
    await expect(interventionModal).toBeVisible();
    await expect(interventionModal).toContainText('Assign Intervention');
    
    // Select intervention type
    await page.selectOption('[data-testid=intervention-type]', 'daily-checkin');
    
    // Add description
    await page.fill('[data-testid=intervention-description]', 'Daily morning check-in with counselor to discuss attendance barriers');
    
    // Set start date
    await page.fill('[data-testid=start-date]', '2025-01-16');
    
    // Assign to counselor
    await page.selectOption('[data-testid=assigned-to]', 'counselor-jones');
    
    // Submit intervention
    await page.click('[data-testid=assign-intervention-button]');
    
    // Should show success message
    await expect(page.locator('[data-testid=success-toast]')).toContainText('Intervention assigned successfully');
    
    // Modal should close
    await expect(interventionModal).not.toBeVisible();
    
    // Step 6: Verify intervention appears in student record
    const activeInterventions = sidePanel.locator('[data-testid=active-interventions]');
    await expect(activeInterventions).toContainText('Daily Check-in');
    await expect(activeInterventions).toContainText('Assigned to: Counselor Jones');
    await expect(activeInterventions).toContainText('Status: Active');
    
    // Step 7: Document parent contact
    const parentContactSection = sidePanel.locator('[data-testid=parent-contact-section]');
    await parentContactSection.locator('[data-testid=add-contact-button]').click();
    
    const contactModal = page.locator('[data-testid=contact-modal]');
    await expect(contactModal).toBeVisible();
    
    // Fill contact details
    await page.selectOption('[data-testid=contact-method]', 'phone');
    await page.fill('[data-testid=contact-notes]', 'Discussed attendance concerns with parent. Parent committed to improving morning routine.');
    await page.selectOption('[data-testid=contact-outcome]', 'positive');
    
    await page.click('[data-testid=save-contact-button]');
    
    // Should appear in contact history
    await expect(parentContactSection).toContainText('Phone contact');
    await expect(parentContactSection).toContainText('morning routine');
    
    // Step 8: Schedule follow-up conference
    const conferenceSection = sidePanel.locator('[data-testid=conference-section]');
    await conferenceSection.locator('[data-testid=schedule-conference-button]').click();
    
    const conferenceModal = page.locator('[data-testid=conference-modal]');
    await expect(conferenceModal).toBeVisible();
    
    // Schedule for next week
    await page.fill('[data-testid=conference-date]', '2025-01-23');
    await page.fill('[data-testid=conference-time]', '3:30 PM');
    await page.selectOption('[data-testid=conference-type]', 'parent-teacher');
    
    // Add attendees
    await page.check('[data-testid=attendee-parent]');
    await page.check('[data-testid=attendee-teacher]');
    await page.check('[data-testid=attendee-counselor]');
    
    // Set agenda
    await page.fill('[data-testid=conference-agenda]', 'Review attendance intervention progress and academic support needs');
    
    await page.click('[data-testid=schedule-conference-button]');
    
    // Should show in upcoming conferences
    await expect(conferenceSection).toContainText('Upcoming Conference');
    await expect(conferenceSection).toContainText('January 23, 2025');
    
    // Step 9: Return to dashboard to verify changes
    await page.click('[data-testid=close-side-panel]');
    await page.click('[data-testid=dashboard-link]');
    
    await expect(page).toHaveURL('/dashboard');
    
    // Should see intervention activity in recent activity feed
    const recentActivity = page.locator('[data-testid=recent-activity]');
    await expect(recentActivity).toContainText('Intervention assigned: John Doe');
    await expect(recentActivity).toContainText('Daily Check-in');
    
    // Grade K card should reflect intervention assignment
    await expect(gradeKCard.locator('[data-testid=active-interventions-count]')).toContainText('1');
  });

  test('should handle student search and quick intervention assignment', async ({ page }) => {
    // This test will FAIL - requires search implementation
    
    // Navigate to attendance page
    await page.click('[data-testid=attendance-nav-link]');
    await expect(page).toHaveURL('/attendance');
    
    // Use search to find specific student
    await page.fill('[data-testid=student-search]', 'Sarah Johnson');
    
    // Should filter results in real-time
    await expect(page.locator('[data-testid=search-results]')).toContainText('1 student found');
    
    const studentRow = page.locator('[data-testid=student-row]').first();
    await expect(studentRow).toContainText('Sarah Johnson');
    
    // Quick action: assign intervention directly from row
    const quickActionsMenu = studentRow.locator('[data-testid=quick-actions-menu]');
    await quickActionsMenu.click();
    
    await page.click('[data-testid=quick-assign-intervention]');
    
    // Quick intervention modal
    const quickModal = page.locator('[data-testid=quick-intervention-modal]');
    await expect(quickModal).toBeVisible();
    
    // Pre-selected common intervention
    await page.click('[data-testid=preset-parent-contact]');
    
    await page.click('[data-testid=assign-quickly]');
    
    // Should show confirmation
    await expect(page.locator('[data-testid=success-toast]')).toContainText('Parent contact scheduled');
    
    // Student should now show intervention indicator
    await expect(studentRow.locator('[data-testid=intervention-indicator]')).toBeVisible();
  });

  test('should support bulk operations for multiple students', async ({ page }) => {
    // This test will FAIL - requires bulk operations implementation
    
    await page.click('[data-testid=attendance-nav-link]');
    
    // Filter to show Tier 3 students
    await page.selectOption('[data-testid=tier-filter]', '3');
    
    // Select multiple students using checkboxes
    const checkboxes = page.locator('[data-testid^=student-checkbox-]');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await checkboxes.nth(2).check();
    
    // Bulk actions toolbar should appear
    const bulkToolbar = page.locator('[data-testid=bulk-actions-toolbar]');
    await expect(bulkToolbar).toBeVisible();
    await expect(bulkToolbar).toContainText('3 students selected');
    
    // Assign bulk intervention
    await page.click('[data-testid=bulk-assign-intervention]');
    
    const bulkModal = page.locator('[data-testid=bulk-intervention-modal]');
    await expect(bulkModal).toBeVisible();
    
    // Configure intervention for all selected students
    await page.selectOption('[data-testid=intervention-type]', 'parent-contact');
    await page.fill('[data-testid=bulk-notes]', 'Tier 3 attendance concern - parent contact required');
    
    await page.click('[data-testid=assign-to-all]');
    
    // Should show progress for bulk assignment
    const progressBar = page.locator('[data-testid=bulk-progress]');
    await expect(progressBar).toBeVisible();
    
    await expect(page.locator('[data-testid=bulk-success]')).toContainText('Interventions assigned to 3 students');
    
    // All selected students should show intervention indicators
    const selectedRows = page.locator('[data-testid=student-row]').filter({ has: page.locator('[data-testid^=student-checkbox-]:checked') });
    await expect(selectedRows.locator('[data-testid=intervention-indicator]')).toHaveCount(3);
  });
});

test.describe('Administrator User Journey', () => {
  test.beforeEach(async ({ page }) => {
    // This will FAIL initially - no admin login implemented
    await loginAsAdmin(page);
  });

  test('admin reviews school-wide trends and creates district report', async ({ page }) => {
    // This test will FAIL - no admin dashboard implemented
    
    // Admin dashboard should show school-wide overview
    await expect(page.locator('[data-testid=admin-dashboard]')).toBeVisible();
    await expect(page.locator('[data-testid=district-overview]')).toContainText('District Overview');
    
    // Should see multiple schools if district admin
    const schoolCards = page.locator('[data-testid^=school-card-]');
    await expect(schoolCards).toHaveCount(3); // Romoland Elementary, Middle, High
    
    // Click on concerning school
    const elementaryCard = page.locator('[data-testid=school-card-elementary]');
    await expect(elementaryCard).toHaveClass(/.*border-yellow-.*/) // Medium risk
    await elementaryCard.click();
    
    // Drill down to school-specific dashboard
    await expect(page).toHaveURL('/admin/schools/elementary/dashboard');
    
    // Review grade-level trends
    await expect(page.locator('[data-testid=grade-trends]')).toBeVisible();
    
    // Identify systemic issues
    const trendAnalysis = page.locator('[data-testid=trend-analysis]');
    await expect(trendAnalysis).toContainText('Declining attendance in grades 3-5');
    await expect(trendAnalysis).toContainText('Correlation with academic performance decline');
    
    // Generate district report
    await page.click('[data-testid=generate-report-button]');
    
    const reportModal = page.locator('[data-testid=report-modal]');
    await expect(reportModal).toBeVisible();
    
    // Configure report parameters
    await page.selectOption('[data-testid=report-type]', 'monthly-summary');
    await page.selectOption('[data-testid=report-audience]', 'district-office');
    await page.check('[data-testid=include-interventions]');
    await page.check('[data-testid=include-academic-correlation]');
    
    await page.click('[data-testid=generate-report]');
    
    // Should show report generation progress
    await expect(page.locator('[data-testid=report-progress]')).toBeVisible();
    
    // Report should be ready for download
    await expect(page.locator('[data-testid=report-ready]')).toContainText('Report generated successfully');
    
    const downloadLink = page.locator('[data-testid=download-report]');
    await expect(downloadLink).toBeVisible();
    await expect(downloadLink).toHaveAttribute('href', /.*\.pdf$/);
  });

  test('admin manages teacher permissions and access', async ({ page }) => {
    // This test will FAIL - no user management implemented
    
    await page.click('[data-testid=admin-settings]');
    await page.click('[data-testid=user-management]');
    
    await expect(page).toHaveURL('/admin/users');
    
    // Should see list of teachers
    const teacherList = page.locator('[data-testid=teacher-list]');
    await expect(teacherList).toBeVisible();
    
    // Find specific teacher
    const teacherRow = page.locator('[data-testid=user-row]').filter({ hasText: 'Ms. Smith' });
    await expect(teacherRow).toBeVisible();
    
    // Edit permissions
    await teacherRow.locator('[data-testid=edit-permissions]').click();
    
    const permissionsModal = page.locator('[data-testid=permissions-modal]');
    await expect(permissionsModal).toBeVisible();
    
    // Grant additional permissions
    await page.check('[data-testid=permission-view-all-grades]');
    await page.check('[data-testid=permission-assign-interventions]');
    await page.uncheck('[data-testid=permission-export-data]'); // Restrict sensitive operation
    
    await page.click('[data-testid=save-permissions]');
    
    // Should show confirmation
    await expect(page.locator('[data-testid=success-toast]')).toContainText('Permissions updated');
    
    // Changes should be reflected in teacher row
    await expect(teacherRow.locator('[data-testid=permissions-summary]')).toContainText('All Grades, Interventions');
    await expect(teacherRow.locator('[data-testid=permissions-summary]')).not.toContainText('Export');
  });
});

test.describe('Data Import and System Integration', () => {
  test('complete CSV import workflow with validation and dashboard updates', async ({ page }) => {
    // This test will FAIL - no import system implemented
    
    await loginAsAdmin(page);
    
    // Navigate to data import
    await page.click('[data-testid=admin-tools]');
    await page.click('[data-testid=data-import]');
    
    await expect(page).toHaveURL('/admin/import');
    
    // Upload attendance CSV
    const fileChooser = page.locator('[data-testid=file-upload]');
    await fileChooser.setInputFiles({
      name: 'attendance-data.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(`Student ID,First Name,Last Name,Grade,Attendance Rate,Total Absences
STU001,John,Doe,K,94.5,8
STU002,Jane,Smith,1,92.1,12`)
    });
    
    // Should show file preview
    await expect(page.locator('[data-testid=file-preview]')).toBeVisible();
    await expect(page.locator('[data-testid=preview-table]')).toContainText('John');
    
    // Validate data mapping
    await expect(page.locator('[data-testid=field-mapping]')).toBeVisible();
    
    // Start import
    await page.click('[data-testid=start-import]');
    
    // Should show real-time progress
    const progressSection = page.locator('[data-testid=import-progress]');
    await expect(progressSection).toBeVisible();
    
    // Wait for completion
    await expect(page.locator('[data-testid=import-complete]')).toBeVisible({ timeout: 30000 });
    
    // Should show import summary
    await expect(page.locator('[data-testid=import-summary]')).toContainText('2 records processed');
    await expect(page.locator('[data-testid=import-summary]')).toContainText('0 errors');
    
    // Navigate to dashboard to verify updates
    await page.click('[data-testid=view-dashboard]');
    
    // Dashboard should reflect imported data
    await expect(page.locator('[data-testid=last-updated]')).toContainText('just now');
    await expect(page.locator('[data-testid=data-freshness-indicator]')).toHaveClass(/.*text-green-.*/);
  });
});

test.describe('Accessibility and Keyboard Navigation', () => {
  test('complete workflow using only keyboard navigation', async ({ page }) => {
    // This test will FAIL - requires full keyboard accessibility
    
    await page.goto('/login');
    
    // Login using keyboard only
    await page.keyboard.press('Tab'); // Focus email
    await page.keyboard.type(TEACHER_CREDENTIALS.email);
    await page.keyboard.press('Tab'); // Focus password
    await page.keyboard.type(TEACHER_CREDENTIALS.password);
    await page.keyboard.press('Tab'); // Focus login button
    await page.keyboard.press('Enter'); // Submit
    
    // Navigate dashboard with keyboard
    await expect(page.locator('[data-testid=dashboard-header]')).toBeVisible();
    
    // Tab through grade cards
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab'); // Should focus first grade card
    
    // Activate with Enter
    await page.keyboard.press('Enter');
    
    // Should navigate to attendance page
    await expect(page).toHaveURL('/attendance?grade=K');
    
    // Navigate student table with arrow keys
    await page.keyboard.press('Tab'); // Focus search
    await page.keyboard.press('Tab'); // Focus filters
    await page.keyboard.press('Tab'); // Focus table
    
    // Arrow keys should navigate table rows
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    
    // Enter should open student details
    await page.keyboard.press('Enter');
    
    // Side panel should open and be focusable
    await expect(page.locator('[data-testid=student-side-panel]')).toBeVisible();
    
    // Focus should move to side panel
    const activeElement = page.locator(':focus');
    await expect(activeElement).toBeInViewport();
    
    // Escape should close panel
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid=student-side-panel]')).not.toBeVisible();
  });
});

test.describe('Performance and Reliability', () => {
  test('should handle large datasets efficiently', async ({ page }) => {
    // This test will FAIL - requires performance optimization
    
    await loginAsTeacher(page);
    
    // Navigate to attendance page with large dataset
    await page.goto('/attendance?mock_size=5000'); // Mock 5000 students
    
    // Page should load within reasonable time
    const startTime = Date.now();
    await expect(page.locator('[data-testid=student-table]')).toBeVisible({ timeout: 3000 });
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(2000); // Should load in under 2 seconds
    
    // Virtualization should be working
    const visibleRows = page.locator('[data-testid^=student-row-]');
    const visibleCount = await visibleRows.count();
    expect(visibleCount).toBeLessThan(100); // Only visible rows rendered
    
    // Scrolling should be smooth
    await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(100);
    
    // New rows should appear
    const newVisibleRows = page.locator('[data-testid^=student-row-]');
    const newCount = await newVisibleRows.count();
    expect(newCount).toBeGreaterThan(0);
    
    // Search should be performant
    const searchStart = Date.now();
    await page.fill('[data-testid=student-search]', 'Student123');
    await expect(page.locator('[data-testid=search-results]')).toContainText('found');
    const searchTime = Date.now() - searchStart;
    
    expect(searchTime).toBeLessThan(500); // Search should be fast
  });

  test('should recover gracefully from network errors', async ({ page }) => {
    // This test will FAIL - requires error recovery implementation
    
    await loginAsTeacher(page);
    
    // Simulate network failure
    await page.route('**/api/**', route => route.abort());
    
    // Try to navigate to attendance page
    await page.click('[data-testid=attendance-nav-link]');
    
    // Should show offline indicator
    await expect(page.locator('[data-testid=offline-indicator]')).toBeVisible();
    await expect(page.locator('[data-testid=error-message]')).toContainText('Connection lost');
    
    // Should offer retry option
    const retryButton = page.locator('[data-testid=retry-button]');
    await expect(retryButton).toBeVisible();
    
    // Restore network and retry
    await page.unroute('**/api/**');
    await retryButton.click();
    
    // Should recover and load data
    await expect(page.locator('[data-testid=student-table]')).toBeVisible();
    await expect(page.locator('[data-testid=offline-indicator]')).not.toBeVisible();
  });
});

test.describe('Security and Data Protection', () => {
  test('should enforce proper authentication and authorization', async ({ page }) => {
    // This test will FAIL - requires security implementation
    
    // Try to access protected route without login
    await page.goto('/attendance');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
    await expect(page.locator('[data-testid=login-required]')).toContainText('Authentication required');
    
    // Login as teacher
    await loginAsTeacher(page);
    
    // Try to access admin-only route
    await page.goto('/admin/users');
    
    // Should show access denied
    await expect(page.locator('[data-testid=access-denied]')).toBeVisible();
    await expect(page.locator('[data-testid=error-message]')).toContainText('Insufficient permissions');
    
    // Should redirect back to appropriate page
    await expect(page).toHaveURL('/dashboard');
  });

  test('should protect sensitive student data in URLs and logs', async ({ page }) => {
    // This test will FAIL - requires data protection implementation
    
    await loginAsTeacher(page);
    
    // Navigate to student details
    await page.goto('/attendance');
    const studentRow = page.locator('[data-testid=student-row]').first();
    await studentRow.click();
    
    // Student side panel should open without exposing sensitive data in URL
    await expect(page.locator('[data-testid=student-side-panel]')).toBeVisible();
    
    // URL should not contain student names or sensitive identifiers
    const currentUrl = page.url();
    expect(currentUrl).not.toMatch(/John|Doe|SSN|DOB/i);
    
    // Check that error messages don't expose sensitive data
    await page.route('**/api/students/**', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ 
          error: 'Database error for student John Doe (SSN: 123-45-6789)' 
        })
      });
    });
    
    // Trigger an error
    await page.reload();
    
    // Error message should be sanitized
    const errorMessage = page.locator('[data-testid=error-message]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).not.toContainText('John Doe');
    await expect(errorMessage).not.toContainText('123-45-6789');
    await expect(errorMessage).toContainText('Unable to load student data');
  });
});

test.afterAll(async () => {
  // Cleanup any test data or reset state
  console.log('E2E tests completed. All tests designed to fail initially for TDD implementation.');
});
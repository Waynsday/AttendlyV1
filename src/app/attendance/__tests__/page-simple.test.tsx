/**
 * @file page-simple.test.tsx (Attendance)
 * @description Simple Attendance page test to enable TDD implementation
 */

import { render, screen } from '@testing-library/react';
import AttendancePage from '../page';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/attendance',
  useSearchParams: () => new URLSearchParams(),
}));

describe('Attendance Page', () => {
  it('should display student attendance table', () => {
    render(<AttendancePage />);
    
    // This should fail because we haven't implemented the table yet
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Student Name')).toBeInTheDocument();
    expect(screen.getByText('Attendance %')).toBeInTheDocument();
  });
  
  it('should display tier badges', () => {
    render(<AttendancePage />);
    
    // This should fail - looking for tier badge elements
    expect(screen.getByText('Tier 1', { selector: '.tier-badge' })).toBeInTheDocument();
  });
  
  it('should have sortable columns', () => {
    render(<AttendancePage />);
    
    // This should fail - looking for sortable column headers
    const nameHeader = screen.getByRole('columnheader', { name: /student name/i });
    expect(nameHeader).toHaveAttribute('aria-sort');
  });
});
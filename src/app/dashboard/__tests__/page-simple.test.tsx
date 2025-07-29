/**
 * @file page-simple.test.tsx (Dashboard)
 * @description Simple Dashboard page test to enable TDD implementation
 */

import { render, screen } from '@testing-library/react';
import DashboardPage from '../page';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

describe('Dashboard Page', () => {
  it('should display grade-level attendance cards', () => {
    render(<DashboardPage />);
    
    // This should fail because we haven't implemented grade-level cards yet
    expect(screen.getByText('Kindergarten')).toBeInTheDocument();
    expect(screen.getByText('Grade 1')).toBeInTheDocument();
    expect(screen.getByText('Grade 2')).toBeInTheDocument();
  });
  
  it('should display tier distribution', () => {
    render(<DashboardPage />);
    
    // This should pass - looking for tier badges (should have multiple instances)
    expect(screen.getAllByText('Tier 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tier 2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tier 3').length).toBeGreaterThan(0);
  });
});
/**
 * @fileoverview Failing tests for DashboardLayout.tsx component
 * Following TDD red-green-refactor cycle - these tests should FAIL initially
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { DashboardLayout } from '../../../../presentation/components/dashboard-layout';

// Extend Jest matchers for accessibility testing
expect.extend(toHaveNoViolations);

// Mock the Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/dashboard',
}));

// Component doesn't exist yet - this test will fail in red phase

describe('DashboardLayout Component', () => {
  const mockUser = {
    id: 'user-123',
    name: 'John Teacher',
    email: 'john.teacher@romoland.edu',
    role: 'teacher',
    school: 'AP Romoland Elementary'
  };

  const mockChildren = <div data-testid="dashboard-content">Dashboard Content</div>;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('Header Rendering', () => {
    test('should render header with school name', async () => {
      render(
        <DashboardLayout user={mockUser}>
          {mockChildren}
        </DashboardLayout>
      );

      expect(screen.getByText('AP Romoland Elementary')).toBeInTheDocument();
      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    test('should display user information in header', async () => {
      render(
        <DashboardLayout user={mockUser}>
          {mockChildren}
        </DashboardLayout>
      );

      expect(screen.getByText('John Teacher')).toBeInTheDocument();
      expect(screen.getByText('john.teacher@romoland.edu')).toBeInTheDocument();
    });

    test('should show user avatar or initials', async () => {
      render(
        <DashboardLayout user={mockUser}>
          {mockChildren}
        </DashboardLayout>
      );

      // Should show either avatar image or initials
      const avatar = screen.getByTestId('user-avatar');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('alt', expect.stringContaining('John Teacher'));
    });

    test('should include logout functionality', async () => {
      const mockLogout = jest.fn();
      
      render(
        <DashboardLayout user={mockUser} onLogout={mockLogout}>
          {mockChildren}
        </DashboardLayout>
      );

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      expect(logoutButton).toBeInTheDocument();
      
      fireEvent.click(logoutButton);
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('Navigation Menu', () => {
    test('should render navigation menu with proper role-based access', async () => {
      render(
        <DashboardLayout user={mockUser}>
          {mockChildren}
        </DashboardLayout>
      );

      const nav = screen.getByRole('navigation');
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveAttribute('aria-label', 'Main navigation');
    });

    test('should show teacher-specific navigation items', async () => {
      render(
        <DashboardLayout user={mockUser}>
          {mockChildren}
        </DashboardLayout>
      );

      expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /students/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /attendance/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /interventions/i })).toBeInTheDocument();
    });

    test('should show admin-specific navigation items for admin users', async () => {
      const adminUser = { ...mockUser, role: 'admin' };
      
      render(
        <DashboardLayout user={adminUser}>
          {mockChildren}
        </DashboardLayout>
      );

      expect(screen.getByRole('link', { name: /reports/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /users/i })).toBeInTheDocument();
    });

    test('should hide admin features for teacher users', async () => {
      render(
        <DashboardLayout user={mockUser}>
          {mockChildren}
        </DashboardLayout>
      );

      expect(screen.queryByRole('link', { name: /settings/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /users/i })).not.toBeInTheDocument();
    });

    test('should highlight active navigation item', async () => {
      render(
        <DashboardLayout user={mockUser} currentPath="/dashboard/students">
          {mockChildren}
        </DashboardLayout>
      );

      const studentsLink = screen.getByRole('link', { name: /students/i });
      expect(studentsLink).toHaveAttribute('aria-current', 'page');
      expect(studentsLink).toHaveClass('active');
    });
  });

  describe('Real-time Data Refresh', () => {
    test('should display data refresh indicator', async () => {
      render(
        <DashboardLayout user={mockUser}>
          {mockChildren}
        </DashboardLayout>
      );

      const refreshIndicator = screen.getByTestId('refresh-indicator');
      expect(refreshIndicator).toBeInTheDocument();
      expect(refreshIndicator).toHaveAttribute('aria-label', 'Data refresh status');
    });

    test('should show last updated timestamp', async () => {
      const lastUpdated = new Date('2024-01-15T10:30:00Z');
      
      render(
        <DashboardLayout user={mockUser} lastUpdated={lastUpdated}>
          {mockChildren}
        </DashboardLayout>
      );

      expect(screen.getByText(/last updated/i)).toBeInTheDocument();
      expect(screen.getByText(/10:30 AM/)).toBeInTheDocument();
    });

    test('should allow manual refresh trigger', async () => {
      const mockRefresh = jest.fn();
      
      render(
        <DashboardLayout user={mockUser} onRefresh={mockRefresh}>
          {mockChildren}
        </DashboardLayout>
      );

      const refreshButton = screen.getByRole('button', { name: /refresh data/i });
      fireEvent.click(refreshButton);
      
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    test('should show loading state during refresh', async () => {
      render(
        <DashboardLayout user={mockUser} isRefreshing={true}>
          {mockChildren}
        </DashboardLayout>
      );

      const loadingIndicator = screen.getByTestId('loading-spinner');
      expect(loadingIndicator).toBeInTheDocument();
      expect(loadingIndicator).toHaveAttribute('aria-label', 'Refreshing data');
    });
  });

  describe('Responsive Layout', () => {
    test('should render mobile navigation drawer', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      render(
        <DashboardLayout user={mockUser}>
          {mockChildren}
        </DashboardLayout>
      );

      const mobileMenuButton = screen.getByRole('button', { name: /open menu/i });
      expect(mobileMenuButton).toBeInTheDocument();
      
      fireEvent.click(mobileMenuButton);
      
      const mobileNav = screen.getByTestId('mobile-navigation');
      expect(mobileNav).toBeInTheDocument();
      expect(mobileNav).toHaveAttribute('aria-expanded', 'true');
    });

    test('should close mobile menu on outside click', async () => {
      render(
        <DashboardLayout user={mockUser}>
          {mockChildren}
        </DashboardLayout>
      );

      const mobileMenuButton = screen.getByRole('button', { name: /open menu/i });
      fireEvent.click(mobileMenuButton);

      const overlay = screen.getByTestId('mobile-menu-overlay');
      fireEvent.click(overlay);

      await waitFor(() => {
        const mobileNav = screen.getByTestId('mobile-navigation');
        expect(mobileNav).toHaveAttribute('aria-expanded', 'false');
      });
    });

    test('should hide desktop navigation on mobile', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 640,
      });

      render(
        <DashboardLayout user={mockUser}>
          {mockChildren}
        </DashboardLayout>
      );

      const desktopNav = screen.getByTestId('desktop-navigation');
      expect(desktopNav).toHaveClass('hidden', 'md:block');
    });
  });

  describe('Loading and Error States', () => {
    test('should handle loading state', async () => {
      render(
        <DashboardLayout user={mockUser} isLoading={true}>
          {mockChildren}
        </DashboardLayout>
      );

      expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument();
      expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument();
    });

    test('should display error state with retry option', async () => {
      const mockRetry = jest.fn();
      
      render(
        <DashboardLayout 
          user={mockUser} 
          error="Failed to load dashboard data"
          onRetry={mockRetry}
        >
          {mockChildren}
        </DashboardLayout>
      );

      expect(screen.getByText(/failed to load dashboard data/i)).toBeInTheDocument();
      
      const retryButton = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(retryButton);
      
      expect(mockRetry).toHaveBeenCalledTimes(1);
    });

    test('should show network status indicator', async () => {
      render(
        <DashboardLayout user={mockUser} isOffline={true}>
          {mockChildren}
        </DashboardLayout>
      );

      const offlineIndicator = screen.getByTestId('offline-indicator');
      expect(offlineIndicator).toBeInTheDocument();
      expect(offlineIndicator).toHaveTextContent(/offline/i);
    });
  });

  describe('FERPA Compliance', () => {
    test('should implement proper data access controls', async () => {
      render(
        <DashboardLayout user={mockUser}>
          {mockChildren}
        </DashboardLayout>
      );

      // Check for security headers
      const secureElement = screen.getByTestId('secure-container');
      expect(secureElement).toHaveAttribute('data-secure', 'true');
    });

    test('should show data privacy notice', async () => {
      render(
        <DashboardLayout user={mockUser}>
          {mockChildren}
        </DashboardLayout>
      );

      expect(screen.getByText(/confidential student data/i)).toBeInTheDocument();
    });

    test('should implement session timeout warning', async () => {
      jest.useFakeTimers();
      
      render(
        <DashboardLayout user={mockUser} sessionTimeout={1800}>
          {mockChildren}
        </DashboardLayout>
      );

      // Fast-forward time to trigger warning
      jest.advanceTimersByTime(1500000); // 25 minutes

      await waitFor(() => {
        expect(screen.getByText(/session will expire/i)).toBeInTheDocument();
      });

      jest.useRealTimers();
    });
  });

  describe('Performance Requirements', () => {
    test('should load in under 2 seconds', async () => {
      const startTime = performance.now();
      
      render(
        <DashboardLayout user={mockUser}>
          {mockChildren}
        </DashboardLayout>
      );

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const loadTime = endTime - startTime;
      
      expect(loadTime).toBeLessThan(2000);
    });

    test('should implement lazy loading for non-critical components', async () => {
      render(
        <DashboardLayout user={mockUser}>
          {mockChildren}
        </DashboardLayout>
      );

      // Check that non-critical components are lazy loaded
      const lazyComponent = screen.queryByTestId('secondary-panel');
      expect(lazyComponent).not.toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    test('should support keyboard navigation', async () => {
      render(
        <DashboardLayout user={mockUser}>
          {mockChildren}
        </DashboardLayout>
      );

      const firstNavItem = screen.getByRole('link', { name: /dashboard/i });
      firstNavItem.focus();

      fireEvent.keyDown(firstNavItem, { key: 'Tab' });
      
      const secondNavItem = screen.getByRole('link', { name: /students/i });
      expect(secondNavItem).toHaveFocus();
    });

    test('should provide skip links for accessibility', async () => {
      render(
        <DashboardLayout user={mockUser}>
          {mockChildren}
        </DashboardLayout>
      );

      const skipLink = screen.getByRole('link', { name: /skip to main content/i });
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute('href', '#main-content');
    });
  });

  describe('Accessibility', () => {
    test('should have no accessibility violations', async () => {
      const { container } = render(
        <DashboardLayout user={mockUser}>
          {mockChildren}
        </DashboardLayout>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should provide proper ARIA labels', async () => {
      render(
        <DashboardLayout user={mockUser}>
          {mockChildren}
        </DashboardLayout>
      );

      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Dashboard content');
      expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Main navigation');
      expect(screen.getByRole('banner')).toHaveAttribute('aria-label', 'Site header');
    });

    test('should support screen readers', async () => {
      render(
        <DashboardLayout user={mockUser}>
          {mockChildren}
        </DashboardLayout>
      );

      const announcements = screen.getByRole('status', { name: /live announcements/i });
      expect(announcements).toBeInTheDocument();
      expect(announcements).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Content Rendering', () => {
    test('should render children components', async () => {
      render(
        <DashboardLayout user={mockUser}>
          {mockChildren}
        </DashboardLayout>
      );

      expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
    });

    test('should provide proper main content area', async () => {
      render(
        <DashboardLayout user={mockUser}>
          {mockChildren}
        </DashboardLayout>
      );

      const mainContent = screen.getByRole('main');
      expect(mainContent).toHaveAttribute('id', 'main-content');
      expect(mainContent).toBeInTheDocument();
    });
  });
});
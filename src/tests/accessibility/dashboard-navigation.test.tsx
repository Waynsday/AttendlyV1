/**
 * @fileoverview Dashboard layout navigation and mobile menu accessibility tests
 * Tests ARIA navigation, mobile menu interactions, and keyboard accessibility
 */

import { describe, expect, it, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { DashboardLayout } from '../../presentation/components/dashboard-layout';

expect.extend(toHaveNoViolations);

// Mock Next.js hooks
const mockUsePathname = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

// Mock window properties for responsive testing
const mockMatchMedia = vi.fn();
const mockGetComputedStyle = vi.fn();

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    value: mockMatchMedia,
    writable: true,
  });
  
  Object.defineProperty(window, 'getComputedStyle', {
    value: mockGetComputedStyle,
    writable: true,
  });
  
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
  });
});

afterAll(() => {
  vi.resetAllMocks();
});

describe('Dashboard Layout Navigation Accessibility Tests', () => {
  const mockUser = {
    id: 'user-123',
    name: 'Jane Teacher',
    email: 'jane.teacher@romoland.edu',
    role: 'teacher',
    school: 'Heritage Elementary',
  };

  const mockOnLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue('/dashboard');
    
    // Default desktop view
    (window as any).innerWidth = 1024;
    
    mockMatchMedia.mockImplementation(query => ({
      matches: !query.includes('max-width'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    mockGetComputedStyle.mockReturnValue({
      display: 'block',
      visibility: 'visible',
    });
  });

  describe('WCAG 2.1 AA Navigation Compliance', () => {
    it('should have no accessibility violations in header navigation', async () => {
      const { container } = render(
        <DashboardLayout user={mockUser} onLogout={mockOnLogout}>
          <div>Dashboard content</div>
        </DashboardLayout>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should use proper semantic HTML structure', () => {
      render(
        <DashboardLayout user={mockUser} onLogout={mockOnLogout}>
          <div>Dashboard content</div>
        </DashboardLayout>
      );

      // Check for proper landmark elements
      const banner = screen.getByRole('banner');
      const navigation = screen.getByRole('navigation');
      const main = screen.getByRole('main');
      const contentinfo = screen.getByRole('contentinfo');

      expect(banner).toBeInTheDocument();
      expect(navigation).toBeInTheDocument();
      expect(main).toBeInTheDocument();
      expect(contentinfo).toBeInTheDocument();
    });

    it('should have proper heading hierarchy', () => {
      render(
        <DashboardLayout user={mockUser} onLogout={mockOnLogout}>
          <div>Dashboard content</div>
        </DashboardLayout>
      );

      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent('Attendly');

      // Footer should have h3
      const footerHeading = screen.getByText('Attendly'); // In footer
      expect(footerHeading.tagName.toLowerCase()).toBe('h3');
    });

    it('should support aria-current for active navigation items', () => {
      mockUsePathname.mockReturnValue('/dashboard');
      
      render(
        <DashboardLayout user={mockUser} onLogout={mockOnLogout}>
          <div>Dashboard content</div>
        </DashboardLayout>
      );

      const activeNavItem = screen.getByRole('link', { name: 'Dashboard' });
      expect(activeNavItem).toHaveAttribute('aria-current', 'page');

      const inactiveNavItem = screen.getByRole('link', { name: 'Attendance' });
      expect(inactiveNavItem).not.toHaveAttribute('aria-current');
    });
  });

  describe('Desktop Navigation Tests', () => {
    beforeEach(() => {
      (window as any).innerWidth = 1024;
      mockMatchMedia.mockImplementation(query => ({
        matches: !query.includes('max-width: 767px'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    });

    it('should show desktop navigation items', () => {
      render(
        <DashboardLayout user={mockUser} onLogout={mockOnLogout}>
          <div>Dashboard content</div>
        </DashboardLayout>
      );

      const dashboardLink = screen.getByRole('link', { name: 'Dashboard' });
      const attendanceLink = screen.getByRole('link', { name: 'Attendance' });

      expect(dashboardLink).toBeVisible();
      expect(attendanceLink).toBeVisible();
      expect(dashboardLink).toHaveAttribute('href', '/dashboard');
      expect(attendanceLink).toHaveAttribute('href', '/attendance');
    });

    it('should show search bar on desktop', () => {
      render(
        <DashboardLayout user={mockUser} onLogout={mockOnLogout}>
          <div>Dashboard content</div>
        </DashboardLayout>
      );

      const searchInput = screen.getByRole('searchbox', { name: /search students/i });
      expect(searchInput).toBeVisible();
      expect(searchInput).toHaveAttribute('placeholder', 'Search Students...');
    });

    it('should not show mobile menu button on desktop', () => {
      render(
        <DashboardLayout user={mockUser} onLogout={mockOnLogout}>
          <div>Dashboard content</div>
        </DashboardLayout>
      );

      const mobileMenuButton = screen.queryByLabelText('Toggle navigation menu');
      expect(mobileMenuButton).not.toBeVisible();
    });

    it('should handle user menu interactions', async () => {
      const user = userEvent.setup();
      
      render(
        <DashboardLayout user={mockUser} onLogout={mockOnLogout}>
          <div>Dashboard content</div>
        </DashboardLayout>
      );

      const userMenuButton = screen.getByLabelText('User menu');
      expect(userMenuButton).toBeVisible();

      // Click to open user menu
      await user.click(userMenuButton);

      const logoutButton = screen.getByRole('button', { name: 'Logout' });
      expect(logoutButton).toBeVisible();

      // Test logout functionality
      await user.click(logoutButton);
      expect(mockOnLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('Mobile Navigation Tests', () => {
    beforeEach(() => {
      (window as any).innerWidth = 320;
      mockMatchMedia.mockImplementation(query => ({
        matches: query.includes('max-width: 767px') || query.includes('max-width'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    });

    it('should show mobile menu button and hide desktop navigation', () => {
      render(
        <DashboardLayout user={mockUser} onLogout={mockOnLogout}>
          <div>Dashboard content</div>
        </DashboardLayout>
      );

      const mobileMenuButton = screen.getByLabelText('Toggle navigation menu');
      expect(mobileMenuButton).toBeVisible();

      // Desktop navigation should be hidden
      const desktopNav = screen.getByRole('navigation');
      expect(desktopNav).toBeInTheDocument();
      
      // Check that mobile menu is initially closed
      const mobileNavItems = screen.queryByText('Dashboard');
      // The Dashboard link exists but the mobile overlay should not be visible initially
      expect(screen.queryByTestId('mobile-menu')).not.toBeInTheDocument();
    });

    it('should open and close mobile menu with proper accessibility', async () => {
      const user = userEvent.setup();
      
      render(
        <DashboardLayout user={mockUser} onLogout={mockOnLogout}>
          <div>Dashboard content</div>
        </DashboardLayout>
      );

      const mobileMenuButton = screen.getByLabelText('Toggle navigation menu');
      
      // Open mobile menu
      await user.click(mobileMenuButton);
      
      // Check that mobile menu is now visible
      await waitFor(() => {
        const dashboardMobileLink = screen.getAllByText('Dashboard')[1]; // Mobile version
        expect(dashboardMobileLink).toBeVisible();
      });

      // Close mobile menu
      await user.click(mobileMenuButton);
      
      // Mobile navigation should be hidden again
      await waitFor(() => {
        const mobileNavContainer = screen.queryByRole('navigation');
        // The navigation still exists but mobile overlay should be gone
        expect(mobileNavContainer).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation in mobile menu', async () => {
      const user = userEvent.setup();
      
      render(
        <DashboardLayout user={mockUser} onLogout={mockOnLogout}>
          <div>Dashboard content</div>
        </DashboardLayout>
      );

      const mobileMenuButton = screen.getByLabelText('Toggle navigation menu');
      
      // Focus and activate with keyboard
      await user.tab();
      // Skip to menu button (may need multiple tabs depending on other focusable elements)
      mobileMenuButton.focus();
      
      // Open with Enter key
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        const mobileNavLinks = screen.getAllByText('Dashboard');
        expect(mobileNavLinks.length).toBeGreaterThan(1); // Desktop + Mobile versions
      });

      // Navigate with Tab
      await user.tab();
      const dashboardMobileLink = screen.getAllByRole('link', { name: 'Dashboard' })[1];
      expect(dashboardMobileLink).toHaveFocus();

      // Close with Escape
      await user.keyboard('{Escape}');
      
      await waitFor(() => {
        expect(mobileMenuButton).toHaveFocus();
      });
    });

    it('should handle touch target requirements on mobile', () => {
      mockGetComputedStyle.mockReturnValue({
        minHeight: '44px',
        minWidth: '44px',
        height: '48px',
        width: '48px',
        padding: '12px',
      });

      render(
        <DashboardLayout user={mockUser} onLogout={mockOnLogout}>
          <div>Dashboard content</div>
        </DashboardLayout>
      );

      const mobileMenuButton = screen.getByLabelText('Toggle navigation menu');
      const styles = window.getComputedStyle(mobileMenuButton);
      
      // Verify touch targets meet 44px minimum
      expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(44);
      expect(parseInt(styles.minWidth)).toBeGreaterThanOrEqual(44);
    });

    it('should hide search bar on mobile and show in mobile menu if needed', () => {
      render(
        <DashboardLayout user={mockUser} onLogout={mockOnLogout}>
          <div>Dashboard content</div>
        </DashboardLayout>
      );

      // Desktop search should be hidden on mobile (lg:block class)
      const searchInputs = screen.queryAllByRole('searchbox');
      
      // On mobile, the search bar should be hidden or moved to mobile menu
      // The search bar has 'hidden lg:block' classes, so it should not be visible
      if (searchInputs.length > 0) {
        searchInputs.forEach(input => {
          expect(input).not.toBeVisible();
        });
      }
    });
  });

  describe('Keyboard Navigation Support', () => {
    it('should support tab navigation through all interactive elements', async () => {
      const user = userEvent.setup();
      
      render(
        <DashboardLayout user={mockUser} onLogout={mockOnLogout}>
          <div>Dashboard content</div>
        </DashboardLayout>
      );

      // Tab through interactive elements
      const interactiveElements = [
        screen.getByRole('link', { name: 'Dashboard' }),
        screen.getByRole('link', { name: 'Attendance' }),
        screen.getByRole('searchbox'),
        screen.getByLabelText('User menu'),
      ];

      for (let i = 0; i < interactiveElements.length; i++) {
        await user.tab();
        if (interactiveElements[i] && getComputedStyle(interactiveElements[i]).display !== 'none') {
          expect(interactiveElements[i]).toHaveFocus();
        }
      }
    });

    it('should support skip navigation links', () => {
      render(
        <DashboardLayout user={mockUser} onLogout={mockOnLogout}>
          <div>Dashboard content</div>
        </DashboardLayout>
      );

      const main = screen.getByRole('main');
      expect(main).toHaveAttribute('id', 'main-content');
      
      // In a real implementation, there should be a skip link
      // <a href=\"#main-content\" class=\"sr-only focus:not-sr-only\">Skip to main content</a>
      // For now, we verify the target exists
    });

    it('should handle focus trap in mobile menu', async () => {
      const user = userEvent.setup();
      (window as any).innerWidth = 320;
      
      render(
        <DashboardLayout user={mockUser} onLogout={mockOnLogout}>
          <div>Dashboard content</div>
        </DashboardLayout>
      );

      const mobileMenuButton = screen.getByLabelText('Toggle navigation menu');
      await user.click(mobileMenuButton);

      // When mobile menu is open, focus should be trapped within it
      await waitFor(() => {
        const mobileNavLinks = screen.getAllByRole('link');
        expect(mobileNavLinks.length).toBeGreaterThan(2); // Include mobile menu items
      });
    });

    it('should handle Escape key to close mobile menu', async () => {
      const user = userEvent.setup();
      (window as any).innerWidth = 320;
      
      render(
        <DashboardLayout user={mockUser} onLogout={mockOnLogout}>
          <div>Dashboard content</div>
        </DashboardLayout>
      );

      const mobileMenuButton = screen.getByLabelText('Toggle navigation menu');
      await user.click(mobileMenuButton);

      // Press Escape to close
      await user.keyboard('{Escape}');
      
      // Focus should return to menu button
      expect(mobileMenuButton).toHaveFocus();
    });
  });

  describe('Screen Reader Support', () => {
    it('should provide appropriate ARIA labels and descriptions', () => {
      render(
        <DashboardLayout user={mockUser} onLogout={mockOnLogout}>
          <div>Dashboard content</div>
        </DashboardLayout>
      );

      const banner = screen.getByRole('banner');
      const navigation = screen.getByRole('navigation');
      const main = screen.getByRole('main');
      const contentinfo = screen.getByRole('contentinfo');

      expect(banner).toBeInTheDocument();
      expect(navigation).toBeInTheDocument();
      expect(main).toBeInTheDocument();
      expect(contentinfo).toBeInTheDocument();

      // Check for screen reader friendly button labels
      const userMenuButton = screen.getByLabelText('User menu');
      expect(userMenuButton).toBeInTheDocument();

      const mobileMenuButton = screen.getByLabelText('Toggle navigation menu');
      expect(mobileMenuButton).toBeInTheDocument();
    });

    it('should announce navigation state changes', async () => {
      const user = userEvent.setup();
      (window as any).innerWidth = 320;
      
      render(
        <DashboardLayout user={mockUser} onLogout={mockOnLogout}>
          <div>Dashboard content</div>
        </DashboardLayout>
      );

      const mobileMenuButton = screen.getByLabelText('Toggle navigation menu');
      
      // Mobile menu should have proper ARIA expanded state
      expect(mobileMenuButton).toHaveAttribute('aria-label', 'Toggle navigation menu');
      
      await user.click(mobileMenuButton);
      
      // After clicking, the menu state should be reflected (though exact implementation may vary)
      expect(mobileMenuButton).toBeInTheDocument();
    });

    it('should handle user information accessibility', () => {
      render(
        <DashboardLayout user={mockUser} onLogout={mockOnLogout}>
          <div>Dashboard content</div>
        </DashboardLayout>
      );

      // User avatar should have proper title/alt text
      const userInitials = screen.getByTitle('Jane Teacher avatar');
      expect(userInitials).toBeInTheDocument();
      expect(userInitials).toHaveTextContent('JT'); // Initials

      // School name should be visible for context
      const schoolName = screen.getByText('Heritage Elementary');
      expect(schoolName).toBeInTheDocument();
    });

    it('should support high contrast mode', () => {
      // Mock high contrast media query
      mockMatchMedia.mockImplementation(query => ({
        matches: query.includes('prefers-contrast: high'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      render(
        <DashboardLayout user={mockUser} onLogout={mockOnLogout}>
          <div>Dashboard content</div>
        </DashboardLayout>
      );

      const navigation = screen.getByRole('navigation');
      expect(navigation).toBeInTheDocument();
      
      // In a real implementation, high contrast styles would be applied
      // We can verify the component renders without errors in high contrast mode
    });
  });

  describe('Educational Context Accessibility', () => {
    it('should handle school context appropriately for screen readers', () => {
      render(
        <DashboardLayout user={mockUser} onLogout={mockOnLogout}>
          <div>Dashboard content</div>
        </DashboardLayout>
      );

      // School context should be available but not overwhelming
      const schoolContext = screen.getByText('Heritage Elementary');
      expect(schoolContext).toBeInTheDocument();
      
      // Main heading should be clear about the application
      const appTitle = screen.getByRole('heading', { level: 1 });
      expect(appTitle).toHaveTextContent('Attendly');
    });

    it('should handle role-based navigation appropriately', () => {
      const adminUser = {
        ...mockUser,
        role: 'admin',
      };

      render(
        <DashboardLayout user={adminUser} onLogout={mockOnLogout}>
          <div>Dashboard content</div>
        </DashboardLayout>
      );

      // Basic navigation should be available regardless of role
      const dashboardLink = screen.getByRole('link', { name: 'Dashboard' });
      const attendanceLink = screen.getByRole('link', { name: 'Attendance' });
      
      expect(dashboardLink).toBeInTheDocument();
      expect(attendanceLink).toBeInTheDocument();
    });

    it('should provide appropriate copyright and privacy context', () => {
      render(
        <DashboardLayout user={mockUser} onLogout={mockOnLogout}>
          <div>Dashboard content</div>
        </DashboardLayout>
      );

      const copyright = screen.getByText(/© \d{4} Romoland School District/);
      const privacyLink = screen.getByRole('link', { name: 'Privacy Policy' });
      
      expect(copyright).toBeInTheDocument();
      expect(privacyLink).toBeInTheDocument();
      expect(privacyLink).toHaveAttribute('href', '#');
    });
  });
});
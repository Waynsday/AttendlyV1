'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { 
  User, 
  LogOut, 
  Home, 
  ClipboardList, 
  Menu,
  X,
  Search
} from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../utils/cn';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  school: string;
}

interface DashboardLayoutProps {
  user: User;
  children: React.ReactNode;
  onLogout?: () => void;
}

export function DashboardLayout({ 
  user, 
  children, 
  onLogout,
}: DashboardLayoutProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [showUserMenu, setShowUserMenu] = React.useState(false);

  const navigationItems = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Attendance', href: '/attendance', icon: ClipboardList },
  ];

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n.charAt(0))
      .join('')
      .toUpperCase();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header role="banner" className="bg-primary text-primary-foreground shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              {/* Logo and School Name */}
              <div className="flex-shrink-0">
                <h1 className="text-xl font-heading">Attendly</h1>
              </div>
              <div className="hidden md:block">
                <span className="text-lg text-primary-foreground/80">{user.school}</span>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Desktop Navigation */}
              <nav className="hidden md:flex space-x-4">
                {navigationItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <a
                      key={item.name}
                      href={item.href}
                      className={cn(
                        'px-3 py-2 rounded-md text-sm font-medium text-primary-foreground/80 transition-colors',
                        isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-primary-foreground/10 hover:text-primary-foreground'
                      )}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {item.name}
                    </a>
                  );
                })}
              </nav>

              {/* Search Bar */}
              <div className="hidden lg:block relative">
                <input 
                  type="search"
                  placeholder="Search Students..."
                  className="bg-primary-foreground/10 text-primary-foreground placeholder-primary-foreground/60 rounded-md py-1.5 pl-10 pr-4 w-56"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary-foreground/60" />
              </div>

              {/* User Menu */}
              <div className="relative">
                <Button
                  variant="ghost"
                  className="flex items-center space-x-2 text-primary-foreground hover:bg-accent/80 p-2 rounded-full"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  aria-label="User menu"
                >
                  <div 
                    className="w-8 h-8 bg-accent text-accent-foreground rounded-full flex items-center justify-center text-sm font-medium"
                    title={`${user.name} avatar`}
                  >
                    {getUserInitials(user.name)}
                  </div>
                </Button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-background text-foreground rounded-md shadow-lg z-50 ring-1 ring-black ring-opacity-5">
                    <div className="p-2">
                      <div className="px-2 py-1.5 text-sm font-medium">{user.name}</div>
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">{user.email}</div>
                    </div>
                    <hr className="border-border" />
                    <button
                      role="button"
                      className="w-full flex items-center px-4 py-2 text-sm hover:bg-muted"
                      onClick={onLogout}
                      aria-label="Logout"
                    >
                      <LogOut className="mr-2 h-4 w-4 text-secondary" />
                      Logout
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile menu button */}
              <div className="md:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary-foreground hover:bg-accent/80"
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  aria-label="Toggle navigation menu"
                >
                  {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-primary/95 backdrop-blur-sm">
            <nav className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navigationItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <a
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center space-x-3 px-3 py-2 rounded-md text-base font-medium text-primary-foreground/80',
                      isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-primary-foreground/10 hover:text-primary-foreground'
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <item.icon className="h-6 w-6" />
                    <span>{item.name}</span>
                  </a>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main role="main" id="main-content" className="flex-1 w-full">
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer role="contentinfo" className="bg-primary text-primary-foreground/80 mt-auto">
        <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-center md:text-left mb-4 md:mb-0">
              <p>&copy; {new Date().getFullYear()} Romoland School District. All Rights Reserved.</p>
              <p className="text-sm">Powered by Attendly</p>
            </div>
            <div className="flex space-x-4">
              <a href="#" className="hover:text-primary-foreground">Privacy Policy</a>
              <a href="#" className="hover:text-primary-foreground">Terms of Service</a>
              <a href="#" className="hover:text-primary-foreground">Contact Us</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
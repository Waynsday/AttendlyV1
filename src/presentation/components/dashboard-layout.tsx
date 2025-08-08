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
    <div className="min-h-screen flex flex-col bg-primary-50">
      {/* Header - Clean Attendly Style */}
      <header role="banner" className="bg-white border-b border-neutral-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-6">
              {/* Attendly Logo and Branding */}
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-medium text-primary-900">Attendly</h1>
              </div>
              <div className="hidden md:block">
                <span className="text-base text-primary-700">{user.school}</span>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              {/* Desktop Navigation - Attendly Style */}
              <nav className="hidden md:flex space-x-8">
                {navigationItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <a
                      key={item.name}
                      href={item.href}
                      className={cn(
                        'text-base font-normal transition-colors duration-200',
                        isActive 
                          ? 'text-primary-900 border-b-2 border-accent-400' 
                          : 'text-primary-700 hover:text-primary-900'
                      )}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {item.name}
                    </a>
                  );
                })}
              </nav>

              {/* Search Bar - Attendly Style */}
              <div className="hidden lg:block relative">
                <input 
                  type="search"
                  placeholder="Search Students..."
                  className="bg-neutral-100 text-primary-900 placeholder-primary-500 rounded-lg py-2.5 pl-10 pr-4 w-64 border border-transparent focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-all duration-200"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary-500" />
              </div>

              {/* User Menu - Attendly Style */}
              <div className="relative">
                <Button
                  variant="ghost"
                  className="flex items-center space-x-2 text-primary-700 hover:bg-neutral-100 p-2 rounded-lg"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  aria-label="User menu"
                >
                  <div 
                    className="w-9 h-9 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-medium"
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

      {/* Main Content - Attendly Style */}
      <main role="main" id="main-content" className="flex-1 w-full">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>

      {/* Footer - Attendly Dark Style */}
      <footer role="contentinfo" className="bg-primary-900 text-white mt-auto">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-center md:text-left mb-4 md:mb-0">
              <div className="flex items-center space-x-3 mb-2">
                <h3 className="text-xl font-medium text-white">Attendly</h3>
              </div>
              <p className="text-sm text-neutral-300">&copy; {new Date().getFullYear()} Romoland School District. All Rights Reserved.</p>
              <p className="text-sm text-neutral-400">Powered by Attendly</p>
            </div>
            <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-6">
              <a href="#" className="text-neutral-300 hover:text-white transition-colors duration-200">Privacy Policy</a>
              <a href="#" className="text-neutral-300 hover:text-white transition-colors duration-200">Terms of Service</a>
              <a href="#" className="text-neutral-300 hover:text-white transition-colors duration-200">Contact Us</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
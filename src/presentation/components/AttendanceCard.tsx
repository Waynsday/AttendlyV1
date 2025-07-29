/**
 * @fileoverview AttendanceCard component for displaying grade-level attendance metrics
 * Shows tier distribution, trend indicators, and provides interactive navigation
 * Follows TDD requirements from AttendanceCard.test.tsx
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { cn } from '../utils/cn';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';

// Types based on test data structure
interface GradeData {
  grade: string;
  totalStudents: number;
  attendanceRate: number;
  chronicAbsentees: number;
  tier1: number; // 1-2 absences
  tier2: number; // 3-9 absences  
  tier3: number; // >10% chronic
  trend: 'stable' | 'declining' | 'up' | 'down';
  riskLevel: 'low' | 'medium' | 'high';
  lastUpdated: string;
  monthlyTrend: Array<{ month: string; rate: number }>;
}

interface AttendanceCardProps {
  gradeData: GradeData;
  onCardClick?: (data: GradeData) => void;
  isLoading?: boolean;
  getTrendData?: () => Array<{ month: string; rate: number }>;
  onTooltipShow?: () => void;
}

// Tier colors based on Tailwind config
const TIER_COLORS = {
  1: '#16a34a', // Green - Good attendance
  2: '#eab308', // Yellow - At-risk  
  3: '#dc2626', // Red - Chronic absenteeism
};

// Risk level styling
const RISK_STYLES = {
  low: {
    border: 'border-green-200',
    badge: 'bg-green-100 text-green-800',
    contrast: 'high-contrast-green',
  },
  medium: {
    border: 'border-yellow-200', 
    badge: 'bg-yellow-100 text-yellow-800',
    contrast: 'high-contrast-yellow',
  },
  high: {
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-800', 
    contrast: 'high-contrast-red',
  },
};

/**
 * AttendanceCard component for displaying grade-level attendance metrics
 */
const AttendanceCardComponent = ({
  gradeData,
  onCardClick,
  isLoading = false,
  getTrendData,
  onTooltipShow,
}: AttendanceCardProps) => {
  const router = useRouter();
  const [showTooltip, setShowTooltip] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Memoize expensive calculations
  const pieData = useMemo(() => {
    if (!gradeData || gradeData.totalStudents === 0) return [];
    
    return [
      { 
        tier: 1, 
        value: gradeData.tier1 || 0, 
        name: 'Tier 1',
        description: '1-2 absences'
      },
      { 
        tier: 2, 
        value: gradeData.tier2 || 0, 
        name: 'Tier 2',
        description: '3-9 absences'
      },
      { 
        tier: 3, 
        value: gradeData.tier3 || 0, 
        name: 'Tier 3', 
        description: '10+ absences'
      },
    ];
  }, [gradeData]);

  // Lazy load trend data when needed
  const [trendData, setTrendData] = useState<Array<{ month: string; rate: number }> | null>(
    getTrendData ? null : gradeData.monthlyTrend
  );
  
  // Handle hover with debouncing
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    const timer = setTimeout(() => {
      setShowTooltip(true);
      onTooltipShow?.();
      
      // Lazy load trend data if not already loaded
      if (getTrendData && !trendData) {
        setTrendData(getTrendData());
      }
    }, 200);
    
    return () => clearTimeout(timer);
  }, [onTooltipShow, getTrendData, trendData]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setShowTooltip(false);
  }, []);

  // Handle navigation
  const handleClick = useCallback((event: React.MouseEvent) => {
    // Prevent navigation during loading
    if (isLoading) return;
    
    // Prevent navigation if clicking on interactive elements
    const target = event.target as HTMLElement;
    if (target.closest('[data-testid="pie-chart"]')) {
      event.stopPropagation();
      return;
    }

    if (onCardClick) {
      onCardClick(gradeData);
    } else {
      router.push(`/attendance?grade=${encodeURIComponent(gradeData.grade)}`);
    }
  }, [gradeData, onCardClick, router, isLoading]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (isLoading) return;
    
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (onCardClick) {
        onCardClick(gradeData);
      } else {
        router.push(`/attendance?grade=${encodeURIComponent(gradeData.grade)}`);
      }
    }
  }, [gradeData, onCardClick, router, isLoading]);

  // Format last updated date
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit', 
        year: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  };

  // Safe value display with fallbacks
  const safeValue = (value: any, fallback = 0) => {
    if (value === null || value === undefined || isNaN(Number(value)) || typeof value === 'string' || Number(value) < 0) {
      return fallback;
    }
    return Number(value);
  };

  // Check for high contrast mode
  const prefersHighContrast = typeof window !== 'undefined' && 
    window.matchMedia('(prefers-contrast: high)').matches;

  // Check for reduced motion
  const prefersReducedMotion = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Check for mobile layout using window size
  const [isMobile, setIsMobile] = useState(false);
  
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle invalid or empty data
  if (!gradeData) {
    return (
      <Card 
        className={cn(
          'p-4 text-center',
          'animate-fade-in',
          prefersHighContrast && 'high-contrast'
        )}
        data-testid="attendance-card"
      >
        <CardContent>
          <p>No data available</p>
        </CardContent>
      </Card>
    );
  }

  // Handle zero students case - only if totalStudents is explicitly 0, not null/invalid
  if (gradeData.totalStudents === 0) {
    return (
      <Card 
        className={cn(
          'p-4 text-center',
          'animate-fade-in',
          prefersHighContrast && 'high-contrast'
        )}
        data-testid="attendance-card"
      >
        <CardContent>
          <p>No students enrolled</p>
        </CardContent>
      </Card>
    );
  }

  const riskStyle = RISK_STYLES[gradeData.riskLevel] || RISK_STYLES.low;

  return (
    <Card
      className={cn(
        // Base styling with Romoland theme
        'cursor-pointer transition-all duration-200',
        'animate-fade-in',
        'bg-white border-2 border-romoland-primary shadow-card',
        
        // Hover effects
        isHovered && !prefersReducedMotion && 'shadow-lg transform scale-105 border-romoland-accent',
        prefersReducedMotion && 'motion-reduce:transform-none',
        
        // High contrast mode
        prefersHighContrast && 'high-contrast border-4',
        
        // Layout variants
        isMobile ? 'mobile-layout' : 'desktop-layout',
        
        // Loading state
        isLoading && 'opacity-50 cursor-not-allowed'
      )}
      data-testid="attendance-card"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Grade ${gradeData.grade} attendance summary. ${safeValue(gradeData.attendanceRate)}% attendance rate, ${safeValue(gradeData.chronicAbsentees)} chronic absentees. Click for details.`}
      aria-disabled={isLoading}
    >
      {/* Card Header */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle 
            className="text-lg font-heading truncate"
            data-testid="grade-title"
            title={gradeData.grade}
          >
            {gradeData.grade.includes('Grade') || gradeData.grade === 'Kindergarten' 
              ? gradeData.grade 
              : `Grade ${gradeData.grade}`}
          </CardTitle>
          
          {/* Risk Badge */}
          <div
            className={cn(
              'px-2 py-1 rounded-full text-xs font-medium',
              riskStyle.badge,
              prefersHighContrast && riskStyle.contrast
            )}
            data-testid="risk-badge"
            role="status"
            aria-label={`${gradeData.riskLevel === 'high' ? 'High risk grade requiring attention' : `${gradeData.riskLevel} risk grade`}`}
          >
            {gradeData.riskLevel === 'low' ? 'Low Risk' : 
             gradeData.riskLevel === 'medium' ? 'Medium Risk' : 'High Risk'}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div data-testid="total-students-metric">
            <div className="text-2xl font-bold text-romoland-primary">
              {safeValue(gradeData.totalStudents)}
            </div>
            <div className="text-xs text-romoland-text">Total Students</div>
          </div>
          
          <div data-testid="attendance-rate-metric">
            <div className="text-2xl font-bold text-romoland-primary">
              {gradeData.attendanceRate !== undefined && gradeData.attendanceRate !== null && !isNaN(gradeData.attendanceRate) 
                ? `${gradeData.attendanceRate.toFixed(1)}%` 
                : 'Data unavailable'}
            </div>
            <div className="text-xs text-romoland-text">Attendance Rate</div>
          </div>
          
          <div data-testid="chronic-absentees-metric">
            <div className="text-2xl font-bold text-romoland-primary">
              {safeValue(gradeData.chronicAbsentees)}
            </div>
            <div className="text-xs text-romoland-text">Chronic Absentees</div>
          </div>
        </div>

        {/* Trend Indicator */}
        <div 
          className={cn(
            "flex items-center justify-center space-x-2",
            gradeData.trend === 'declining' && "text-tier-3",
            gradeData.trend === 'down' && "text-tier-3"
          )} 
          data-testid="trend-indicator"
        >
          {gradeData.trend === 'stable' && (
            <>
              <div data-testid="trend-stable" className="w-3 h-3 bg-romoland-secondary rounded-full"></div>
              <span className="text-sm text-romoland-text">Stable</span>
            </>
          )}
          {gradeData.trend === 'declining' && (
            <>
              <div data-testid="trend-down" className="w-0 h-0 border-l-2 border-r-2 border-b-3 border-transparent border-b-tier-3"></div>
              <span className="text-sm">Declining</span>
            </>
          )}
          {gradeData.trend === 'up' && (
            <>
              <div data-testid="trend-up" className="w-0 h-0 border-l-2 border-r-2 border-t-3 border-transparent border-t-tier-1"></div>
              <span className="text-sm text-tier-1">Improving</span>
            </>
          )}
          {gradeData.trend === 'down' && (
            <>
              <div data-testid="trend-down" className="w-0 h-0 border-l-2 border-r-2 border-b-3 border-transparent border-b-tier-3"></div>
              <span className="text-sm text-tier-3">Declining</span>
            </>
          )}
        </div>

        {/* Tier Distribution */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-romoland-text text-center">
            Tier Distribution
          </h4>
          
          {/* Pie Chart */}
          <div className="flex justify-center">
            <ResponsiveContainer width="100%" height={isMobile ? 128 : 160}>
              <PieChart
                className={cn(isMobile ? 'h-32' : 'h-40')}
                role="img"
                aria-label={`Pie chart showing tier distribution: Tier 1: ${safeValue(gradeData.tier1)} students, Tier 2: ${safeValue(gradeData.tier2)} students, Tier 3: ${safeValue(gradeData.tier3)} students`}
              >
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={20}
                  outerRadius={isMobile ? 50 : 60}
                  dataKey="value"
                >
                  {pieData.map((entry) => (
                    <Cell 
                      key={`cell-${entry.tier}`} 
                      fill={TIER_COLORS[entry.tier as keyof typeof TIER_COLORS]} 
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Tier Numbers */}
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div data-testid="tier1-count">
              <div className="font-semibold text-romoland-primary">{safeValue(gradeData.tier1)}</div>
              <div className="text-xs text-romoland-text">Tier 1</div>
            </div>
            <div data-testid="tier2-count">
              <div className="font-semibold text-romoland-primary">{safeValue(gradeData.tier2)}</div>
              <div className="text-xs text-romoland-text">Tier 2</div>
            </div>
            <div data-testid="tier3-count">
              <div className="font-semibold text-romoland-primary">{safeValue(gradeData.tier3)}</div>
              <div className="text-xs text-romoland-text">Tier 3</div>
            </div>
          </div>

          {/* Accessible Data Table (hidden but available to screen readers) */}
          <table className="sr-only" data-testid="chart-data-table" aria-hidden="false">
            <caption>Tier distribution data</caption>
            <tbody>
              <tr>
                <td>Tier 1: {safeValue(gradeData.tier1)}</td>
              </tr>
              <tr>
                <td>Tier 2: {safeValue(gradeData.tier2)}</td>
              </tr>
              <tr>
                <td>Tier 3: {safeValue(gradeData.tier3)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Desktop-only detailed metrics */}
        {!isMobile && (
          <div data-testid="detailed-metrics" className="pt-2 border-t border-romoland-primary/20">
            <div className="text-xs text-romoland-text text-center">
              Last updated: {formatDate(gradeData.lastUpdated)}
            </div>
          </div>
        )}
      </CardContent>

      {/* Hover Tooltip */}
      {showTooltip && (
        <div 
          className="absolute z-50 p-3 bg-popover text-popover-foreground rounded-md shadow-lg border max-w-sm"
          style={{
            top: '-10px',
            left: '100%',
            marginLeft: '10px'
          }}
          role="tooltip"
        >
          <div className="space-y-2">
            <h4 className="font-semibold">Detailed Breakdown</h4>
            
            <div className="space-y-1 text-sm">
              <div>Tier 1 (1-2 absences): {safeValue(gradeData.tier1)} students</div>
              <div>Tier 2 (3-9 absences): {safeValue(gradeData.tier2)} students</div>
              <div>Tier 3 (10+ absences): {safeValue(gradeData.tier3)} students</div>
            </div>
            
            <div className="pt-2 border-t">
              <div className="text-xs text-muted-foreground">
                <strong>Last Updated:</strong> {formatDate(gradeData.lastUpdated)}
              </div>
            </div>

            {/* Monthly Trend */}
            {trendData && trendData.length > 0 && (
              <div className="pt-2 border-t">
                <div className="text-sm font-medium mb-1">Monthly Trend</div>
                <div data-testid="trend-chart" className="text-xs space-y-1">
                  {trendData.map((month) => (
                    <div key={month.month} className="flex justify-between">
                      <span>{month.month}:</span>
                      <span>{month.rate}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

// Memoized export for performance optimization
export const AttendanceCard = React.memo(AttendanceCardComponent);
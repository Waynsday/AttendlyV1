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
// Import recharts directly for better debugging
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

// Types based on test data structure
interface GradeData {
  grade: string;
  totalStudents: number;
  attendanceRate: number;
  chronicAbsentees: number;
  tier1: number;
  tier2: number;
  tier3: number;
  trend: 'stable' | 'declining' | 'up' | 'down';
  riskLevel: 'low' | 'medium' | 'high';
  lastUpdated: string;
  monthlyTrend: Array<{ month: string; rate: number }>;
}

interface AttendanceCardProps {
  gradeData: GradeData;
  isLoading?: boolean;
  viewMode?: 'grid' | 'compact';
}

// Attendly Brand Tier Colors
const TIER_COLORS = {
  1: '#10B981', // Success green - matching Attendly success color
  2: '#F59E0B', // Warning yellow - matching Attendly warning color  
  3: '#EF4444', // Error red - matching Attendly error color
};

// Attendly Brand Risk Level Styling
const RISK_STYLES = {
  low: {
    backgroundColor: '#ECFDF5', // success-50
    color: '#059669',           // success-600
    borderColor: '#A7F3D0',     // success-200
  },
  medium: {
    backgroundColor: '#FFFBEB', // warning-50
    color: '#D97706',           // warning-600
    borderColor: '#FDE68A',     // warning-200
  },
  high: {
    backgroundColor: '#FEF2F2', // error-50
    color: '#DC2626',           // error-600
    borderColor: '#FECACA',     // error-200
  },
};

/**
 * AttendanceCard component for displaying grade-level attendance metrics
 */
const AttendanceCardComponent = ({
  gradeData,
  isLoading = false,
  viewMode = 'grid',
}: AttendanceCardProps) => {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Handle client-side mounting
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const pieData = useMemo(() => {
    if (!gradeData || gradeData.totalStudents === 0) return [];
    
    const data = [
      { tier: 1, value: gradeData.tier1 || 0, name: 'Tier 1' },
      { tier: 2, value: gradeData.tier2 || 0, name: 'Tier 2' },
      { tier: 3, value: gradeData.tier3 || 0, name: 'Tier 3' },
    ].filter(item => item.value > 0); // Only show tiers with students
    
    return data;
  }, [gradeData]);

  const handleClick = useCallback(() => {
    if (isLoading) return;
    router.push(`/attendance?grade=${encodeURIComponent(gradeData.grade)}`);
  }, [gradeData.grade, isLoading, router]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (isLoading) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  }, [handleClick, isLoading]);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
      });
    } catch {
      return 'Invalid date';
    }
  };

  const safeValue = (value: any, fallback = 0) => {
    return (value === null || value === undefined || isNaN(Number(value))) ? fallback : Number(value);
  };

  const prefersReducedMotion = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!gradeData) {
    return (
      <Card className="p-4 text-center">
        <CardContent><p>No data available</p></CardContent>
      </Card>
    );
  }

  if (gradeData.totalStudents === 0) {
    return (
      <Card className="p-4 text-center">
        <CardContent><p>No students enrolled</p></CardContent>
      </Card>
    );
  }

  const riskStyle = RISK_STYLES[gradeData.riskLevel] || RISK_STYLES.low;

  return (
    <Card
      className={cn(
        'bg-white text-card-foreground rounded-xl shadow-card cursor-pointer transition-all duration-200',
        'border border-neutral-200 hover:shadow-card-hover',
        isHovered && !prefersReducedMotion && 'shadow-brand-lg -translate-y-0.5 border-primary-300',
        isLoading && 'opacity-50 cursor-not-allowed'
      )}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Grade ${gradeData.grade} summary`}
      aria-disabled={isLoading}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-medium text-primary-900">
            Grade {gradeData.grade}
          </CardTitle>
          <div 
            className="px-3 py-1.5 rounded-lg text-sm font-normal"
            style={{
              backgroundColor: riskStyle.backgroundColor,
              color: riskStyle.color,
              borderColor: riskStyle.borderColor,
              borderWidth: '1px',
              borderStyle: 'solid',
            }}
          >
            {gradeData.riskLevel.charAt(0).toUpperCase() + gradeData.riskLevel.slice(1)} Risk
          </div>
        </div>
      </CardHeader>

      <CardContent className={viewMode === 'compact' ? 'py-4' : 'space-y-4'}>
        {viewMode === 'compact' ? (
          // Compact horizontal layout
          <div className="flex items-center justify-between gap-6">
            {/* Left side - Main metrics */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-medium text-primary-900">{safeValue(gradeData.totalStudents)}</div>
                <div className="text-sm text-primary-700">Students</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-medium text-primary-900">{`${safeValue(gradeData.attendanceRate, 0).toFixed(1)}%`}</div>
                <div className="text-sm text-primary-700">Attendance</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-medium text-primary-900">{safeValue(gradeData.chronicAbsentees)}</div>
                <div className="text-sm text-primary-700">Chronic</div>
              </div>
            </div>

            {/* Center - Chart */}
            <div className="flex-shrink-0">
              {isMounted && pieData.length > 0 ? (
                <div className="w-[100px] h-[80px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={pieData} 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={20} 
                        outerRadius={35} 
                        dataKey="value" 
                        paddingAngle={2}
                      >
                        {pieData.map((entry) => (
                          <Cell 
                            key={`cell-${entry.tier}`} 
                            fill={TIER_COLORS[entry.tier as keyof typeof TIER_COLORS]} 
                            stroke={TIER_COLORS[entry.tier as keyof typeof TIER_COLORS]} 
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          fontSize: '12px'
                        }} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="w-[100px] h-[80px] flex items-center justify-center bg-muted rounded">
                  <div className="text-xs text-muted-foreground">
                    {!isMounted ? 'Loading...' : 'No data'}
                  </div>
                </div>
              )}
            </div>

            {/* Right side - Tier breakdown */}
            <div className="flex items-center gap-4 text-sm">
              <div className="text-center">
                <div className="font-semibold" style={{color: TIER_COLORS[1]}}>{safeValue(gradeData.tier1)}</div>
                <div className="text-xs text-muted-foreground">T1</div>
              </div>
              <div className="text-center">
                <div className="font-semibold" style={{color: TIER_COLORS[2]}}>{safeValue(gradeData.tier2)}</div>
                <div className="text-xs text-muted-foreground">T2</div>
              </div>
              <div className="text-center">
                <div className="font-semibold" style={{color: TIER_COLORS[3]}}>{safeValue(gradeData.tier3)}</div>
                <div className="text-xs text-muted-foreground">T3</div>
              </div>
            </div>
          </div>
        ) : (
          // Grid vertical layout (original)
          <>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-3xl font-medium text-primary-900">{safeValue(gradeData.totalStudents)}</div>
                <div className="text-sm text-primary-700">Students</div>
              </div>
              <div>
                <div className="text-3xl font-medium text-primary-900">{`${safeValue(gradeData.attendanceRate, 0).toFixed(1)}%`}</div>
                <div className="text-sm text-primary-700">Attendance</div>
              </div>
              <div>
                <div className="text-3xl font-medium text-primary-900">{safeValue(gradeData.chronicAbsentees)}</div>
                <div className="text-sm text-primary-700">Chronic</div>
              </div>
            </div>

            <div className="flex justify-center pt-2">
              {isMounted && pieData.length > 0 ? (
                <div className="w-full h-[120px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={pieData} 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={30} 
                        outerRadius={50} 
                        dataKey="value" 
                        paddingAngle={5}
                      >
                        {pieData.map((entry) => (
                          <Cell 
                            key={`cell-${entry.tier}`} 
                            fill={TIER_COLORS[entry.tier as keyof typeof TIER_COLORS]} 
                            stroke={TIER_COLORS[entry.tier as keyof typeof TIER_COLORS]} 
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))' 
                        }} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="w-full h-[120px] flex items-center justify-center bg-muted rounded">
                  <div className="text-sm text-muted-foreground">
                    {!isMounted ? 'Loading chart...' : 'No chart data'}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 text-center text-base pt-3">
              <div>
                <div className="font-medium text-lg" style={{color: TIER_COLORS[1]}}>{safeValue(gradeData.tier1)}</div>
                <div className="text-sm text-primary-700">Tier 1</div>
              </div>
              <div>
                <div className="font-medium text-lg" style={{color: TIER_COLORS[2]}}>{safeValue(gradeData.tier2)}</div>
                <div className="text-sm text-primary-700">Tier 2</div>
              </div>
              <div>
                <div className="font-medium text-lg" style={{color: TIER_COLORS[3]}}>{safeValue(gradeData.tier3)}</div>
                <div className="text-sm text-primary-700">Tier 3</div>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-200">
              <div className="text-sm text-primary-600 text-center">
                Last updated: {formatDate(gradeData.lastUpdated)}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export const AttendanceCard = React.memo(AttendanceCardComponent);

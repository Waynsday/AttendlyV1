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
import dynamic from 'next/dynamic';

// Dynamically import recharts to avoid SSR issues
const ResponsiveContainer = dynamic(
  () => import('recharts').then((mod) => mod.ResponsiveContainer),
  { ssr: false }
);
const PieChart = dynamic(
  () => import('recharts').then((mod) => mod.PieChart),
  { ssr: false }
);
const Pie = dynamic(
  () => import('recharts').then((mod) => mod.Pie),
  { ssr: false }
);
const Cell = dynamic(
  () => import('recharts').then((mod) => mod.Cell),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import('recharts').then((mod) => mod.Tooltip),
  { ssr: false }
);

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
}

// Tier colors using standard Tailwind classes
const TIER_COLORS = {
  1: '#16a34a', // green-600 
  2: '#eab308', // yellow-500 
  3: '#dc2626', // red-600 
};

// Risk level styling using direct hex values for inline styles
const RISK_STYLES = {
  low: {
    backgroundColor: '#dcfce7', // green-100
    color: '#16a34a',     // green-600
    borderColor: '#bbf7d0',   // green-200
  },
  medium: {
    backgroundColor: '#fef9c3', // yellow-100
    color: '#eab308',     // yellow-600
    borderColor: '#fde68a',   // yellow-200
  },
  high: {
    backgroundColor: '#fee2e2', // red-100
    color: '#dc2626',     // red-600
    borderColor: '#fca5a5',   // red-200
  },
};

/**
 * AttendanceCard component for displaying grade-level attendance metrics
 */
const AttendanceCardComponent = ({
  gradeData,
  isLoading = false,
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
    return [
      { tier: 1, value: gradeData.tier1 || 0, name: 'Tier 1' },
      { tier: 2, value: gradeData.tier2 || 0, name: 'Tier 2' },
      { tier: 3, value: gradeData.tier3 || 0, name: 'Tier 3' },
    ];
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
        'bg-white text-card-foreground rounded-lg shadow-lg cursor-pointer transition-all duration-200',
        'border-2 border-primary',
        isHovered && !prefersReducedMotion && 'shadow-xl transform -translate-y-1 border-accent',
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
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-heading text-primary truncate">
            {gradeData.grade}
          </CardTitle>
          <div 
            className="px-2 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: riskStyle.backgroundColor,
              color: riskStyle.textColor,
              borderColor: riskStyle.borderColor,
              borderWidth: '1px',
              borderStyle: 'solid',
            }}
          >
            {gradeData.riskLevel.charAt(0).toUpperCase() + gradeData.riskLevel.slice(1)} Risk
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-foreground">{safeValue(gradeData.totalStudents)}</div>
            <div className="text-xs text-muted-foreground">Students</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">{`${safeValue(gradeData.attendanceRate, 0).toFixed(1)}%`}</div>
            <div className="text-xs text-muted-foreground">Attendance</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">{safeValue(gradeData.chronicAbsentees)}</div>
            <div className="text-xs text-muted-foreground">Chronic</div>
          </div>
        </div>

        <div className="flex justify-center pt-2">
          {isMounted ? (
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" paddingAngle={5}>
                  {pieData.map((entry) => (
                    <Cell key={`cell-${entry.tier}`} fill={TIER_COLORS[entry.tier as keyof typeof TIER_COLORS]} stroke={TIER_COLORS[entry.tier as keyof typeof TIER_COLORS]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-[120px] flex items-center justify-center bg-muted rounded">
              <div className="text-sm text-muted-foreground">Loading chart...</div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-sm pt-2">
          <div>
            <div className="font-semibold" style={{color: TIER_COLORS[1]}}>{safeValue(gradeData.tier1)}</div>
            <div className="text-xs text-muted-foreground">Tier 1</div>
          </div>
          <div>
            <div className="font-semibold" style={{color: TIER_COLORS[2]}}>{safeValue(gradeData.tier2)}</div>
            <div className="text-xs text-muted-foreground">Tier 2</div>
          </div>
          <div>
            <div className="font-semibold" style={{color: TIER_COLORS[3]}}>{safeValue(gradeData.tier3)}</div>
            <div className="text-xs text-muted-foreground">Tier 3</div>
          </div>
        </div>

        <div className="pt-3 border-t border-border/50">
          <div className="text-xs text-muted-foreground text-center">
            Last updated: {formatDate(gradeData.lastUpdated)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const AttendanceCard = React.memo(AttendanceCardComponent);

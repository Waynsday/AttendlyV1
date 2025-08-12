/**
 * @fileoverview TimelineCard component for displaying cumulative attendance timeline
 * Replaces pie charts with line chart showing absences over time per grade level
 * Filterable by school or district-wide view
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn } from '../utils/cn';
import { Calendar, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
// Import recharts for line chart visualization
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ReferenceLine
} from 'recharts';

// Timeline data structure from API
export interface TimelineDataPoint {
  date: string;
  grade: number;
  dailyAbsences: number;
  cumulativeAbsences: number;
  totalStudents: number;
  attendanceRate: number;
  absenceRate: number;
  schoolName?: string;
  schoolCode?: string;
}

export interface TimelineCardProps {
  timelineData: TimelineDataPoint[];
  selectedGrades?: number[];
  schoolName?: string;
  dateRange: { start: string; end: string };
  isLoading?: boolean;
  onGradeFilter?: (grades: number[]) => void;
  onDateRangeChange?: (range: { start: string; end: string }) => void;
  onRefresh?: () => void;
}

// Color palette for different grade levels (consistent with Attendly brand)
const GRADE_COLORS = {
  6: '#10B981',   // Emerald-500 (success green)
  7: '#3B82F6',   // Blue-500 
  8: '#8B5CF6',   // Violet-500
  9: '#F59E0B',   // Amber-500 (warning yellow)
  10: '#EF4444',  // Red-500 (error red)
  11: '#EC4899',  // Pink-500
  12: '#6B7280',  // Gray-500
  'K': '#14B8A6', // Teal-500
  'TK': '#F97316', // Orange-500
} as const;

/**
 * TimelineCard component for attendance timeline visualization
 */
const TimelineCardComponent = ({
  timelineData,
  selectedGrades = [],
  schoolName = 'All Schools',
  dateRange,
  isLoading = false,
  onGradeFilter,
  onDateRangeChange,
  onRefresh
}: TimelineCardProps) => {
  const router = useRouter();
  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '30d' | '90d' | 'ytd'>('30d');
  const [showCumulative, setShowCumulative] = useState(true);
  const [hoveredGrade, setHoveredGrade] = useState<number | null>(null);

  // Process and prepare chart data
  const chartData = useMemo(() => {
    if (!timelineData || timelineData.length === 0) return [];

    // Group data by date
    const dateMap = new Map<string, Record<number, TimelineDataPoint>>();
    
    for (const point of timelineData) {
      if (!dateMap.has(point.date)) {
        dateMap.set(point.date, {});
      }
      dateMap.get(point.date)![point.grade] = point;
    }

    // Convert to chart format
    const chartPoints = Array.from(dateMap.entries()).map(([date, gradeData]) => {
      const point: any = {
        date,
        formattedDate: new Date(date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        })
      };

      // Add data for each grade
      for (const [grade, data] of Object.entries(gradeData)) {
        const gradeNum = parseInt(grade);
        const value = showCumulative ? data.cumulativeAbsences : data.dailyAbsences;
        point[`grade_${grade}`] = value;
        point[`grade_${grade}_rate`] = data.attendanceRate;
        point[`grade_${grade}_students`] = data.totalStudents;
      }

      return point;
    });

    // Sort by date
    return chartPoints.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [timelineData, showCumulative]);

  // Get unique grades from data
  const availableGrades = useMemo(() => {
    const grades = new Set<number>();
    timelineData?.forEach(point => grades.add(point.grade));
    return Array.from(grades).sort();
  }, [timelineData]);

  // Filter grades to show
  const gradesToShow = selectedGrades.length > 0 ? selectedGrades : availableGrades;

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (!timelineData || timelineData.length === 0) {
      return { totalAbsences: 0, avgDailyAbsences: 0, trendDirection: 'stable' as const, totalStudents: 0 };
    }

    const latestData = timelineData.filter(d => d.date === Math.max(...timelineData.map(p => new Date(p.date).getTime())));
    const earliestData = timelineData.filter(d => d.date === Math.min(...timelineData.map(p => new Date(p.date).getTime())));

    const totalAbsences = latestData.reduce((sum, d) => sum + d.cumulativeAbsences, 0);
    const totalStudents = latestData.reduce((sum, d) => sum + d.totalStudents, 0);
    const avgDailyAbsences = totalAbsences / Math.max(1, new Set(timelineData.map(d => d.date)).size);

    // Calculate trend
    const latestTotal = latestData.reduce((sum, d) => sum + d.dailyAbsences, 0);
    const earliestTotal = earliestData.reduce((sum, d) => sum + d.dailyAbsences, 0);
    const trendDirection = latestTotal > earliestTotal ? 'up' : latestTotal < earliestTotal ? 'down' : 'stable';

    return { totalAbsences, avgDailyAbsences, trendDirection, totalStudents };
  }, [timelineData]);

  // Handle click to navigate to detailed view
  const handleClick = useCallback(() => {
    if (isLoading) return;
    const gradeParam = gradesToShow.length === 1 ? gradesToShow[0] : '';
    router.push(`/attendance?grade=${gradeParam}&school=${encodeURIComponent(schoolName)}`);
  }, [gradesToShow, schoolName, isLoading, router]);

  // Handle time range changes
  const handleTimeRangeChange = useCallback((range: string) => {
    setSelectedTimeRange(range as any);
    if (onDateRangeChange) {
      const endDate = new Date();
      let startDate = new Date();
      
      switch (range) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case 'ytd':
          startDate = new Date(endDate.getFullYear(), 7, 15); // Aug 15 school year start
          break;
      }

      onDateRangeChange({
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      });
    }
  }, [onDateRangeChange]);

  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium text-sm text-gray-900">{label}</p>
          {payload.map((entry: any, index: number) => {
            const grade = entry.dataKey.replace('grade_', '');
            const students = entry.payload[`grade_${grade}_students`];
            const rate = entry.payload[`grade_${grade}_rate`];
            
            return (
              <div key={index} className="flex items-center gap-2 text-xs">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-gray-700">
                  Grade {grade}: <strong>{entry.value}</strong> absences
                </span>
                <span className="text-gray-500">
                  ({students} students, {rate?.toFixed(1)}% rate)
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  // Render loading state
  if (isLoading) {
    return (
      <Card className="p-6">
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <RefreshCw className="h-8 w-8 animate-spin text-primary-500 mx-auto" />
            <p className="text-sm text-muted-foreground">Loading timeline data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render empty state
  if (!timelineData || timelineData.length === 0) {
    return (
      <Card className="p-6">
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto" />
            <div>
              <p className="text-sm font-medium text-gray-900">No attendance data available</p>
              <p className="text-xs text-gray-500">Check the selected date range or try refreshing the data</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = () => {
    switch (summaryStats.trendDirection) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <Card
      className={cn(
        'bg-white rounded-xl shadow-card cursor-pointer transition-all duration-200',
        'border border-neutral-200 hover:shadow-card-hover hover:-translate-y-0.5',
        isLoading && 'opacity-50 cursor-not-allowed'
      )}
      onClick={handleClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium text-primary-900">
            Absence Timeline - {schoolName}
          </CardTitle>
          <div className="flex items-center gap-2">
            {getTrendIcon()}
            <span className="text-sm text-muted-foreground">
              {summaryStats.trendDirection === 'stable' ? 'Stable' : 
               summaryStats.trendDirection === 'up' ? 'Increasing' : 'Decreasing'}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 pt-2">
          <Select value={selectedTimeRange} onValueChange={handleTimeRangeChange}>
            <SelectTrigger className="w-24 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setShowCumulative(!showCumulative);
            }}
            className="h-8 text-xs"
          >
            {showCumulative ? 'Cumulative' : 'Daily'}
          </Button>

          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 text-center text-sm">
          <div>
            <div className="text-lg font-medium text-primary-900">
              {summaryStats.totalStudents.toLocaleString()}
            </div>
            <div className="text-xs text-primary-700">Total Students</div>
          </div>
          <div>
            <div className="text-lg font-medium text-primary-900">
              {summaryStats.totalAbsences.toLocaleString()}
            </div>
            <div className="text-xs text-primary-700">Total Absences</div>
          </div>
          <div>
            <div className="text-lg font-medium text-primary-900">
              {summaryStats.avgDailyAbsences.toFixed(1)}
            </div>
            <div className="text-xs text-primary-700">Avg Daily</div>
          </div>
          <div>
            <div className="text-lg font-medium text-primary-900">
              {gradesToShow.length}
            </div>
            <div className="text-xs text-primary-700">Grades Tracked</div>
          </div>
        </div>

        {/* Timeline Chart */}
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="formattedDate" 
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={{ stroke: '#d1d5db' }}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={{ stroke: '#d1d5db' }}
                label={{ 
                  value: showCumulative ? 'Cumulative Absences' : 'Daily Absences', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { fontSize: '11px', fill: '#6b7280' }
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '11px' }}
                iconType="line"
              />

              {/* Render lines for each grade */}
              {gradesToShow.map((grade) => (
                <Line
                  key={grade}
                  type="monotone"
                  dataKey={`grade_${grade}`}
                  stroke={GRADE_COLORS[grade as keyof typeof GRADE_COLORS] || '#6B7280'}
                  strokeWidth={hoveredGrade === grade ? 3 : 2}
                  dot={{ r: hoveredGrade === grade ? 4 : 3 }}
                  activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                  name={`Grade ${grade}`}
                  connectNulls={false}
                  onMouseEnter={() => setHoveredGrade(grade)}
                  onMouseLeave={() => setHoveredGrade(null)}
                />
              ))}

              {/* Add reference line for average if showing cumulative */}
              {showCumulative && summaryStats.avgDailyAbsences > 0 && (
                <ReferenceLine 
                  y={summaryStats.avgDailyAbsences * chartData.length} 
                  stroke="#f59e0b" 
                  strokeDasharray="5 5"
                  label={{ value: "Projected", position: "topRight", fontSize: 10 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Grade Legend */}
        <div className="flex flex-wrap gap-2 justify-center pt-2 border-t border-neutral-200">
          {availableGrades.map((grade) => (
            <div
              key={grade}
              className={cn(
                "flex items-center gap-1 px-2 py-1 text-xs rounded-full cursor-pointer transition-all",
                gradesToShow.includes(grade) 
                  ? "bg-primary-100 text-primary-800 border border-primary-200" 
                  : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
              )}
              onClick={(e) => {
                e.stopPropagation();
                if (onGradeFilter) {
                  const newGrades = gradesToShow.includes(grade)
                    ? gradesToShow.filter(g => g !== grade)
                    : [...gradesToShow, grade];
                  onGradeFilter(newGrades.length > 0 ? newGrades : availableGrades);
                }
              }}
            >
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ 
                  backgroundColor: GRADE_COLORS[grade as keyof typeof GRADE_COLORS] || '#6B7280' 
                }}
              />
              Grade {grade}
            </div>
          ))}
        </div>

        {/* Last Updated */}
        <div className="text-center text-xs text-primary-600 pt-2">
          Data from {new Date(dateRange.start).toLocaleDateString()} to {new Date(dateRange.end).toLocaleDateString()}
        </div>
      </CardContent>
    </Card>
  );
};

export const TimelineCard = React.memo(TimelineCardComponent);
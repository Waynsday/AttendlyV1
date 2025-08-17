'use client';

import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/presentation/components/dashboard-layout';
import { GradeTimelineGrid } from '@/presentation/components/dashboard/GradeTimelineGrid';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/select';
import { useTimelineData } from '@/presentation/hooks/useTimelineData';
import { Button } from '@/presentation/components/ui/button';
import { RefreshCw, Calendar, TrendingUp } from 'lucide-react';

export default function DashboardPage() {
  // School selection and school year state
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('all');
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>('2024-2025');
  const [selectedGrades, setSelectedGrades] = useState<number[]>([]);
  
  // Overall summary state for header
  const [overallSummary, setOverallSummary] = useState<{
    totalStudents: number;
    totalAbsences: number;
    absenceRate: number;
    gradeLevelsCount: number;
  }>({
    totalStudents: 0,
    totalAbsences: 0,
    absenceRate: 0,
    gradeLevelsCount: 0
  });
  
  // Available school years
  const schoolYears = [
    { value: '2024-2025', label: 'SY 2024-2025', description: 'Aug 15, 2024 - Jun 12, 2025' }
  ];

  // Available schools - will be fetched from API
  const [schools, setSchools] = useState<Array<{id: string, name: string}>>([
    { id: 'all', name: 'All Schools' }
  ]);
  
  // Fetch schools and overall summary on mount
  useEffect(() => {
    const fetchSchools = async () => {
      try {
        const response = await fetch('/api/schools');
        if (response.ok) {
          const schoolsData = await response.json();
          if (schoolsData.success && schoolsData.data) {
            setSchools(schoolsData.data.map((school: any) => ({
              id: school.id,
              name: school.name
            })));
          }
        }
      } catch (error) {
        console.error('Failed to fetch schools:', error);
      }
    };
    
    fetchSchools();
  }, []);

  // Fetch overall summary when school selection changes
  useEffect(() => {
    const fetchOverallSummary = async () => {
      try {
        const response = await fetch(`/api/overall-summary?schoolId=${selectedSchoolId}`);
        if (response.ok) {
          const summaryData = await response.json();
          if (summaryData.success && summaryData.data) {
            setOverallSummary({
              totalStudents: summaryData.data.totalStudents,
              totalAbsences: summaryData.data.totalAbsences,
              absenceRate: summaryData.data.absenceRate,
              gradeLevelsCount: summaryData.data.gradeLevelsCount
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch overall summary:', error);
      }
    };
    
    fetchOverallSummary();
  }, [selectedSchoolId]);

  // Use the timeline data hook
  const {
    timelineData,
    rawData,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    dataRange,
    refreshData,
    clearError,
    updateFilters,
    getSummaryStats
  } = useTimelineData({
    schoolId: selectedSchoolId,
    schoolYear: selectedSchoolYear,
    grades: selectedGrades,
    autoRefresh: false
  });

  // Mock user data for development
  const mockUser = {
    id: '1',
    name: 'John Doe',
    email: 'john.doe@romolandschool.edu',
    role: 'teacher',
    school: 'Romoland School District'
  };

  const handleSchoolChange = useCallback((schoolId: string) => {
    setSelectedSchoolId(schoolId);
    updateFilters({ schoolId });
    clearError(); // Clear any previous errors when changing schools
  }, [updateFilters, clearError]);

  const handleSchoolYearChange = useCallback((schoolYear: string) => {
    setSelectedSchoolYear(schoolYear);
    updateFilters({ schoolYear });
    clearError(); // Clear any previous errors when changing school year
  }, [updateFilters, clearError]);

  const handleGradeFilter = useCallback((schoolId: string, grades: number[]) => {
    setSelectedGrades(grades);
    updateFilters({ grades });
  }, [updateFilters]);

  const handleDateRangeChange = useCallback((range: { start: string; end: string }) => {
    updateFilters({ startDate: range.start, endDate: range.end });
  }, [updateFilters]);

  const handleRefresh = useCallback(async () => {
    await refreshData();
  }, [refreshData]);

  // Get summary statistics from timeline data (for timeline grid)
  const summaryStats = getSummaryStats();

  const selectedSchoolName = schools.find(school => school.id === selectedSchoolId)?.name || 'All Schools';

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout user={mockUser}>
        <div className="space-y-6">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <div className="animate-pulse space-y-4">
                <TrendingUp className="h-12 w-12 text-primary-400 mx-auto animate-pulse" />
                <div className="h-8 bg-gray-200 rounded w-64 mx-auto"></div>
                <div className="h-4 bg-gray-200 rounded w-48 mx-auto"></div>
              </div>
              <p className="mt-4 text-muted-foreground">Loading attendance timeline...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={mockUser}>
      <div className="space-y-8">
        {/* Header Section with Controls */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            {/* Title and Stats */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Attendance Timeline Dashboard
              </h1>
              <div className="flex items-center gap-6 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <span className="font-medium">{overallSummary.totalStudents.toLocaleString()}</span>
                  <span>students</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium">{overallSummary.totalAbsences.toLocaleString()}</span>
                  <span>total absences</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium">{overallSummary.absenceRate.toFixed(1)}%</span>
                  <span>absence rate</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium">{overallSummary.gradeLevelsCount}</span>
                  <span>grade level{overallSummary.gradeLevelsCount !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {/* School Selection */}
              <Select value={selectedSchoolId} onValueChange={handleSchoolChange}>
                <SelectTrigger className="w-48" aria-label="Select school">
                  <SelectValue placeholder="Select school..." />
                </SelectTrigger>
                <SelectContent>
                  {schools.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* School Year Selection */}
              <Select value={selectedSchoolYear} onValueChange={handleSchoolYearChange}>
                <SelectTrigger className="w-44" aria-label="Select school year">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Select year..." />
                </SelectTrigger>
                <SelectContent>
                  {schoolYears.map((year) => (
                    <SelectItem key={year.value} value={year.value}>
                      <span className="font-medium">{year.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Refresh Button */}
              <Button 
                variant="outline" 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center justify-between">
                <p className="text-sm text-red-800">{error.message}</p>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={clearError}
                  className="text-red-600 hover:text-red-800"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          {/* Last Updated */}
          {lastUpdated && (
            <div className="mt-3 text-xs text-gray-500">
              Last updated: {lastUpdated.toLocaleString()}
              {dataRange && ` • Data from ${dataRange.start} to ${dataRange.end}`}
            </div>
          )}
        </div>
        
        {/* Grade Timeline Grid */}
        <GradeTimelineGrid
          data={rawData}
          isLoading={isLoading}
          selectedSchoolId={selectedSchoolId}
          schoolName={selectedSchoolName}
        />
      </div>
    </DashboardLayout>
  );
}
'use client';

import React, { useCallback, useState } from 'react';
import { DashboardLayout } from '@/presentation/components/dashboard-layout';
import { AttendanceSummaryGrid } from '@/presentation/components/dashboard/AttendanceSummaryGrid';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/select';
import { useDashboardData } from '@/presentation/hooks/useDashboardData';
import { Button } from '@/presentation/components/ui/button';
import { RefreshCw, Calendar } from 'lucide-react';

export default function DashboardPage() {
  // School year state
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>('2024');
  
  // Available school years
  const schoolYears = [
    { value: '2024', label: 'SY 2024-2025', description: 'Aug 15, 2024 - Jun 12, 2025' }
  ];

  // Use the new dashboard data hook
  const {
    schools,
    selectedSchoolId,
    attendanceData,
    isLoading,
    isLoadingAttendance,
    error,
    lastUpdated,
    setSelectedSchoolId,
    refreshData,
    clearError,
    todayMetrics // Add today's metrics from the hook
  } = useDashboardData('all', selectedSchoolYear);

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
    clearError(); // Clear any previous errors when changing schools
  }, [setSelectedSchoolId, clearError]);

  const handleSchoolYearChange = useCallback((schoolYear: string) => {
    setSelectedSchoolYear(schoolYear);
    clearError(); // Clear any previous errors when changing school year
  }, [clearError]);

  const handleRefresh = useCallback(async () => {
    await refreshData();
  }, [refreshData]);

  const selectedSchoolName = schools.find(school => school.id === selectedSchoolId)?.name || 'All Schools';

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout user={mockUser}>
        <div className="space-y-6">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-gray-200 rounded w-64 mx-auto"></div>
                <div className="h-4 bg-gray-200 rounded w-48 mx-auto"></div>
              </div>
              <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={mockUser}>
      <div className="space-y-8">
        {/* School and School Year Filter Controls */}
        <div className="flex items-center justify-between bg-white rounded-lg border p-4">
          <div className="flex items-center space-x-6">
            {/* School Selection */}
            <div className="flex items-center space-x-2">
              <label htmlFor="school-select" className="text-sm font-medium text-gray-700">
                School:
              </label>
              <Select value={selectedSchoolId} onValueChange={handleSchoolChange}>
                <SelectTrigger className="w-64" aria-label="Select school">
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
            </div>

            {/* School Year Selection */}
            <div className="flex items-center space-x-2">
              <label htmlFor="school-year-select" className="text-sm font-medium text-gray-700">
                School Year:
              </label>
              <Select value={selectedSchoolYear} onValueChange={handleSchoolYearChange}>
                <SelectTrigger className="w-48" aria-label="Select school year">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Select year..." />
                </SelectTrigger>
                <SelectContent>
                  {schoolYears.map((year) => (
                    <SelectItem key={year.value} value={year.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{year.label}</span>
                        <span className="text-xs text-gray-500">{year.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={isLoadingAttendance}
            className="ml-4"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingAttendance ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>
        
        {/* Enhanced Attendance Summary Grid */}
        <AttendanceSummaryGrid
          data={attendanceData}
          isLoading={isLoadingAttendance}
          schoolName={selectedSchoolName}
        />
      </div>
    </DashboardLayout>
  );
}
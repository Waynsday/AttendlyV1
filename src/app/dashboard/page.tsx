'use client';

import React, { useCallback } from 'react';
import { DashboardLayout } from '@/presentation/components/dashboard-layout';
import { AttendanceCard } from '@/presentation/components/AttendanceCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/select';
import { useDashboardData } from '@/presentation/hooks/useDashboardData';
import { Button } from '@/presentation/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';

export default function DashboardPage() {
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
    clearError
  } = useDashboardData('all');

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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-heading text-foreground">
            Attendance Dashboard
          </h1>
          <div className="text-sm text-muted-foreground">
            Romoland School District
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
              <div className="text-sm text-red-700">
                <strong>Error loading data:</strong> {error}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearError}
                className="ml-auto"
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {/* School Filter */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <label htmlFor="school-select" className="text-sm font-medium text-foreground">
              View Data For:
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
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isLoadingAttendance}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingAttendance ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <div className="text-sm text-muted-foreground">
              Showing data for: {selectedSchoolName}
              {lastUpdated && (
                <div className="text-xs text-gray-500">
                  Last updated: {new Date(lastUpdated).toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Attendance Level Cards */}
        {isLoadingAttendance ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-100 rounded-lg p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {attendanceData.map((attendance) => (
              <AttendanceCard
                key={`${attendance.school || 'all'}-${attendance.grade}`}
                gradeData={attendance}
              />
            ))}
          </div>
        )}

        {/* No Data State */}
        {!isLoadingAttendance && attendanceData.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No attendance data available for the selected school.</p>
            <Button variant="outline" onClick={handleRefresh} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Refreshing
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
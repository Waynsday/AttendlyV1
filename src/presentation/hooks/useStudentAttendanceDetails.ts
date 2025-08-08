/**
 * @fileoverview Hook for fetching detailed student attendance records
 */

import { useState, useEffect } from 'react';

interface AttendanceRecord {
  date: string;
  rawDate: string;
  status: 'present' | 'absent';
}

interface StudentAttendanceDetails {
  studentId: string;
  schoolYear: string;
  totalRecords: number;
  presentDays: number;
  absentDays: number;
  attendanceRate: number;
  enrolledDays: number;
  presentDates: AttendanceRecord[];
  absentDates: AttendanceRecord[];
  dateRange: {
    start: string;
    end: string;
  };
}

interface UseStudentAttendanceDetailsState {
  data: StudentAttendanceDetails | null;
  loading: boolean;
  error: string | null;
}

export function useStudentAttendanceDetails(
  studentId: string | null,
  schoolYear: string = '2024'
) {
  const [state, setState] = useState<UseStudentAttendanceDetailsState>({
    data: null,
    loading: false,
    error: null
  });

  useEffect(() => {
    if (!studentId) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    const fetchAttendanceDetails = async () => {
      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        const response = await fetch(
          `/api/students/${studentId}/attendance?schoolYear=${schoolYear}`
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Failed to fetch attendance details`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch attendance details');
        }

        setState({
          data: result.data,
          loading: false,
          error: null
        });

      } catch (error) {
        console.error('Error fetching student attendance details:', error);
        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch attendance details'
        });
      }
    };

    fetchAttendanceDetails();
  }, [studentId, schoolYear]);

  return state;
}
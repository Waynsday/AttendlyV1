'use client';

/**
 * @file StudentSideCard.tsx
 * @description Student details side panel with slide-in animation
 * Displays comprehensive student information including attendance, iReady scores, and interventions
 * Follows WCAG 2.1 AA accessibility standards and FERPA compliance
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronUp, TrendingUp, TrendingDown, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '../utils/cn';
import { IReadyHistoryCard } from './IReadyHistoryCard';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface StudentSideCardProps {
  studentId: string;
  isOpen: boolean;
  onClose: () => void;
  timeout?: number;
}

interface StudentData {
  id: string;
  firstName: string;
  lastName: string;
  grade: string;
  teacherName: string;
  attendanceRate: number;
  totalAbsences: number;
  chronicAbsences: number;
  totalTardies: number;
  tier: 1 | 2 | 3;
  lastAbsenceDate: string;
  
  attendanceHistory: Array<{
    date: string;
    status: 'present' | 'absent' | 'tardy';
    notes: string | null;
  }>;

  iReadyScores: {
    currentYear: {
      ela: { diagnostic1: { score: number; placement: string } };
      math: { diagnostic1: { score: number; placement: string } };
    };
    previousYear: {
      ela: { diagnostic1: { score: number; placement: string } };
      math: { diagnostic1: { score: number; placement: string } };
    };
  } | null;

  interventions: Array<{
    id: string;
    type: string;
    status: string;
    description: string;
  }>;

  conferences: Array<{
    id: string;
    date: string;
    type: string;
    notes: string;
  }>;
}

interface SectionState {
  attendanceHistory: boolean;
  iReadyScores: boolean;
  iReadyHistory: boolean;
  interventions: boolean;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const getTierBadgeColors = (tier: 1 | 2 | 3, highContrast: boolean = false) => {
  const colors = {
    1: highContrast 
      ? 'bg-green-100 text-green-800 high-contrast-green' 
      : 'bg-green-100 text-green-800',
    2: highContrast 
      ? 'bg-yellow-100 text-yellow-800 high-contrast-yellow' 
      : 'bg-yellow-100 text-yellow-800',
    3: highContrast 
      ? 'bg-red-100 text-red-800 high-contrast-red' 
      : 'bg-red-100 text-red-800'
  };
  return colors[tier];
};

const getTierLabel = (tier: 1 | 2 | 3): string => {
  const labels = {
    1: 'Low Risk',
    2: 'Medium Risk', 
    3: 'High Risk'
  };
  return labels[tier];
};

const formatDate = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: '2-digit', 
      day: '2-digit' 
    });
  } catch {
    return dateString;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'present':
      return <div className="w-3 h-3 bg-green-500 rounded-full" data-testid="status-present" />;
    case 'absent':
      return <div className="w-3 h-3 bg-red-500 rounded-full" data-testid="status-absent" />;
    case 'tardy':
      return <div className="w-3 h-3 bg-yellow-500 rounded-full" data-testid="status-tardy" />;
    default:
      return <div className="w-3 h-3 bg-gray-500 rounded-full" />;
  }
};

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

const useStudentData = (studentId: string, timeout: number = 5000) => {
  const [data, setData] = useState<StudentData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!studentId) return;

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    setError(null);

    try {
      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort();
      }, timeout);

      const response = await fetch(`/api/students/${studentId}?_t=${Date.now()}`, {
        signal: abortControllerRef.current.signal,
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Student not found');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Calculate total tardies from attendance history if not provided
      const studentData = result.data;
      if (studentData && !studentData.totalTardies && studentData.attendanceHistory) {
        studentData.totalTardies = studentData.attendanceHistory.filter(
          (record: any) => record.status === 'tardy'
        ).length;
      }
      
      // Debug logging for tardy data
      console.log('🎯 StudentSideCard received data:', {
        name: studentData?.firstName + ' ' + studentData?.lastName,
        totalTardies: studentData?.totalTardies,
        attendanceRate: studentData?.attendanceRate
      });
      
      setData(studentData);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError(err.message || 'Failed to load student data');
      }
    } finally {
      setIsLoading(false);
    }
  }, [studentId, timeout]);

  useEffect(() => {
    fetchData();

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
};

const useKeyboardNavigation = (isOpen: boolean, onClose: () => void) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const sections = document.querySelectorAll('[data-section]');
        const focusedElement = document.activeElement;
        const currentIndex = Array.from(sections).findIndex(section => 
          section === focusedElement || section.contains(focusedElement)
        );

        if (currentIndex !== -1) {
          event.preventDefault();
          const nextIndex = event.key === 'ArrowDown' 
            ? Math.min(currentIndex + 1, sections.length - 1)
            : Math.max(currentIndex - 1, 0);
          
          (sections[nextIndex] as HTMLElement)?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
};

const useMediaQueries = () => {
  const [preferences, setPreferences] = useState({
    reducedMotion: false,
    highContrast: false,
  });

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');

    const updatePreferences = () => {
      setPreferences({
        reducedMotion: reducedMotionQuery.matches,
        highContrast: highContrastQuery.matches,
      });
    };

    updatePreferences();
    
    // Try to add listeners safely for real browsers
    try {
      if (typeof reducedMotionQuery.addEventListener === 'function') {
        reducedMotionQuery.addEventListener('change', updatePreferences);
        highContrastQuery.addEventListener('change', updatePreferences);
      } else if (typeof reducedMotionQuery.addListener === 'function') {
        reducedMotionQuery.addListener(updatePreferences);
        highContrastQuery.addListener(updatePreferences);
      }
    } catch (e) {
      // Ignore errors in test environment
    }

    return () => {
      try {
        if (typeof reducedMotionQuery.removeEventListener === 'function') {
          reducedMotionQuery.removeEventListener('change', updatePreferences);
          highContrastQuery.removeEventListener('change', updatePreferences);
        } else if (typeof reducedMotionQuery.removeListener === 'function') {
          reducedMotionQuery.removeListener(updatePreferences);
          highContrastQuery.removeListener(updatePreferences);
        }
      } catch (e) {
        // Ignore errors in test environment
      }
    };
  }, []);

  return preferences;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const StudentSideCard: React.FC<StudentSideCardProps> = ({
  studentId,
  isOpen,
  onClose,
  timeout = 5000
}) => {
  const { data, isLoading, error, refetch } = useStudentData(studentId, timeout);
  const { reducedMotion, highContrast } = useMediaQueries();
  const [expandedSections, setExpandedSections] = useState<SectionState>({
    attendanceHistory: true,
    iReadyScores: true,
    iReadyHistory: true,
    interventions: false,
  });
  const [announcements, setAnnouncements] = useState<string>('');

  useKeyboardNavigation(isOpen, onClose);

  // Animation variants
  const slideVariants = {
    initial: { x: '100%', opacity: 0 },
    animate: { x: '0%', opacity: 1 },
    exit: { x: '100%', opacity: 0 }
  };

  const transition = reducedMotion 
    ? { duration: 0 }
    : { type: 'spring' as const, damping: 25, stiffness: 200 };

  const toggleSection = (section: keyof SectionState) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
    
    const sectionNames = {
      attendanceHistory: 'Attendance history',
      iReadyScores: 'iReady scores',
      iReadyHistory: 'iReady assessment history',
      interventions: 'Interventions'
    };
    
    const newState = expandedSections[section] ? 'collapsed' : 'expanded';
    setAnnouncements(`${sectionNames[section]} ${newState}`);
  };

  const handleOutsideClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleCardClick = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex justify-end"
          onClick={handleOutsideClick}
          data-testid="overlay"
        >
          <motion.div
            initial={slideVariants.initial}
            animate={slideVariants.animate}
            exit={slideVariants.exit}
            transition={transition}
            className={cn(
              "w-full max-w-2xl bg-white shadow-xl flex flex-col",
              "sm:w-96 md:w-[32rem]",
              highContrast && "high-contrast"
            )}
            onClick={handleCardClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-name-heading"
            data-student-card="true"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex-1">
                {isLoading ? (
                  <div className="animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-32 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                  </div>
                ) : error ? (
                  <div className="text-red-600">
                    <h2 className="text-lg font-semibold">Error</h2>
                    <p className="text-sm">{error}</p>
                  </div>
                ) : data ? (
                  <div>
                    <h2 id="student-name-heading" className="text-lg font-semibold text-gray-900">
                      {data.firstName} {data.lastName}
                    </h2>
                    <p className="text-sm text-gray-600">
                      Grade {data.grade} • {data.teacherName}
                    </p>
                  </div>
                ) : null}
              </div>
              
              <button
                onClick={onClose}
                className="ml-4 p-2 text-gray-400 hover:text-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Close student details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {isLoading && (
                <div className="flex items-center justify-center p-8">
                  <div role="status" aria-label="Loading student data">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="sr-only">Loading...</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-6" role="alert">
                  <div className="flex items-center space-x-2 text-red-600 mb-4">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-medium">{error}</span>
                  </div>
                  <button
                    onClick={refetch}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Retry loading student data"
                  >
                    Retry
                  </button>
                </div>
              )}

              {data && (
                <div className="p-6 space-y-6">
                  {/* Attendance Metrics */}
                  <div
                    className="bg-gray-50 rounded-lg p-4"
                    data-testid="attendance-metrics"
                    data-section
                    tabIndex={0}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-gray-900">Attendance Overview</h3>
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl font-bold text-blue-600">
                          {data.attendanceRate}%
                        </span>
                        <div
                          className={cn(
                            "px-2 py-1 rounded-full text-xs font-medium",
                            getTierBadgeColors(data.tier, highContrast)
                          )}
                          data-testid="tier-badge"
                          aria-label={getTierLabel(data.tier)}
                        >
                          {getTierLabel(data.tier)}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm text-gray-600">
                      <div>Total Absences: {data.totalAbsences}</div>
                      <div>Chronic Absences: {data.chronicAbsences}</div>
                      <div className={data.totalTardies > 5 ? "text-yellow-600 font-medium" : ""}>
                        Total Tardies: <span className="font-bold">{data.totalTardies || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Attendance History */}
                  <div
                    className="bg-white border border-gray-200 rounded-lg"
                    data-testid="attendance-history"
                    data-section
                    tabIndex={0}
                  >
                    <button
                      onClick={() => toggleSection('attendanceHistory')}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-t-lg"
                      aria-label="Toggle attendance history section"
                    >
                      <h3 className="font-medium text-gray-900">Recent Attendance</h3>
                      {expandedSections.attendanceHistory ? (
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                    
                    {expandedSections.attendanceHistory && (
                      <div className="px-4 pb-4">
                        {data.attendanceHistory?.length > 0 ? (
                          <div className="space-y-2">
                            {data.attendanceHistory.slice(0, 5).map((record, index) => (
                              <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                                <span className="text-sm text-gray-900">
                                  {formatDate(record.date)}
                                </span>
                                <div className="flex items-center space-x-2">
                                  {getStatusIcon(record.status)}
                                  <span className="text-sm capitalize text-gray-600">
                                    {record.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">Attendance data unavailable</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* iReady Scores */}
                  <div
                    className="bg-white border border-gray-200 rounded-lg"
                    data-testid="iready-scores"
                    data-section
                    tabIndex={0}
                  >
                    <button
                      onClick={() => toggleSection('iReadyScores')}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-t-lg"
                      aria-label="Toggle iReady scores section"
                    >
                      <h3 className="font-medium text-gray-900">iReady Scores</h3>
                      {expandedSections.iReadyScores ? (
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                    
                    {expandedSections.iReadyScores && (
                      <div className="px-4 pb-4">
                        {data.iReadyScores ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* ELA Score */}
                            <div className="bg-blue-50 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-blue-900">ELA: {data.iReadyScores.currentYear.ela.diagnostic1.score}</span>
                                {data.iReadyScores.currentYear.ela.diagnostic1.score > data.iReadyScores.previousYear.ela.diagnostic1.score ? (
                                  <TrendingUp className="w-4 h-4 text-green-600" data-testid="ela-trend-up" />
                                ) : (
                                  <TrendingDown className="w-4 h-4 text-red-600" data-testid="ela-trend-down" />
                                )}
                              </div>
                              <p className="text-xs text-blue-700">{data.iReadyScores.currentYear.ela.diagnostic1.placement}</p>
                            </div>

                            {/* Math Score */}
                            <div className="bg-green-50 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-green-900">Math: {data.iReadyScores.currentYear.math.diagnostic1.score}</span>
                                {data.iReadyScores.currentYear.math.diagnostic1.score > data.iReadyScores.previousYear.math.diagnostic1.score ? (
                                  <TrendingUp className="w-4 h-4 text-green-600" data-testid="math-trend-up" />
                                ) : (
                                  <TrendingDown className="w-4 h-4 text-red-600" data-testid="math-trend-down" />
                                )}
                              </div>
                              <p className="text-xs text-green-700">{data.iReadyScores.currentYear.math.diagnostic1.placement}</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">iReady scores unavailable</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* iReady Assessment History */}
                  <IReadyHistoryCard 
                    studentId={studentId}
                    className="mt-6"
                  />

                  {/* Interventions */}
                  <div
                    className="bg-white border border-gray-200 rounded-lg"
                    data-testid="interventions"
                    data-section
                    tabIndex={0}
                  >
                    <button
                      onClick={() => toggleSection('interventions')}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-t-lg"
                      aria-label="Toggle interventions section"
                    >
                      <h3 className="font-medium text-gray-900">Interventions</h3>
                      {expandedSections.interventions ? (
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                    
                    {expandedSections.interventions && (
                      <div className="px-4 pb-4">
                        {data.interventions?.length > 0 ? (
                          <div className="space-y-3">
                            {data.interventions.map((intervention) => (
                              <div key={intervention.id} className="bg-yellow-50 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium text-yellow-900 capitalize">
                                    {intervention.type.replace('_', ' ').toLowerCase()}
                                  </span>
                                  <span className={cn(
                                    "px-2 py-1 rounded-full text-xs font-medium",
                                    intervention.status === 'active' 
                                      ? "bg-green-100 text-green-800" 
                                      : "bg-gray-100 text-gray-800"
                                  )}>
                                    {intervention.status}
                                  </span>
                                </div>
                                <p className="text-xs text-yellow-700">{intervention.description}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No interventions recorded</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Live region for screen reader announcements */}
            <div
              role="status"
              aria-live="polite"
              aria-label="Section updates"
              className="sr-only"
            >
              {announcements}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
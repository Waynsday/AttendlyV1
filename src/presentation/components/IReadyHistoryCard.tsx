'use client';

/**
 * @file IReadyHistoryCard.tsx
 * @description Historical iReady assessment results component
 * Displays multi-year ELA and Math diagnostic data with trend indicators
 * Follows WCAG 2.1 AA accessibility standards
 */

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, BookOpen, Calculator, Calendar, Target } from 'lucide-react';
import { cn } from '../utils/cn';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface IReadyRecord {
  id: string;
  score: number;
  placement: string;
  rawPlacement: string;
  date: string;
  academicYear: string;
  createdAt: string;
}

interface IReadyHistoryData {
  hasData: boolean;
  message?: string;
  history: {
    ela: IReadyRecord[];
    math: IReadyRecord[];
  };
  summary: {
    totalAssessments: number;
    latestEla: IReadyRecord | null;
    latestMath: IReadyRecord | null;
    yearRange: string | null;
    trends?: {
      ela: 'improving' | 'declining' | 'stable' | 'insufficient';
      math: 'improving' | 'declining' | 'stable' | 'insufficient';
    };
  };
}

interface IReadyHistoryCardProps {
  studentId: string;
  className?: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const getTrendIcon = (trend: string) => {
  switch (trend) {
    case 'improving':
      return <TrendingUp className="w-4 h-4 text-green-600" aria-label="Improving trend" />;
    case 'declining':
      return <TrendingDown className="w-4 h-4 text-red-600" aria-label="Declining trend" />;
    case 'stable':
      return <Minus className="w-4 h-4 text-blue-600" aria-label="Stable trend" />;
    default:
      return null;
  }
};

const getPlacementColor = (placement: string): string => {
  if (placement.includes('Below')) return 'text-red-600 bg-red-50';
  if (placement.includes('Above')) return 'text-green-600 bg-green-50';
  if (placement.includes('On Grade Level')) return 'text-blue-600 bg-blue-50';
  return 'text-gray-600 bg-gray-50';
};

const formatDate = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const IReadyHistoryCard: React.FC<IReadyHistoryCardProps> = ({
  studentId,
  className
}) => {
  const [data, setData] = useState<IReadyHistoryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullHistory, setShowFullHistory] = useState(false);

  // Fetch iReady history data
  useEffect(() => {
    const fetchData = async () => {
      if (!studentId) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/students/${studentId}/iready-history`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch iReady history: ${response.status}`);
        }

        const result = await response.json();
        setData(result.data);
      } catch (err: any) {
        setError(err.message || 'Failed to load iReady history');
        console.error('Error fetching iReady history:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [studentId]);

  // Render loading state
  if (isLoading) {
    return (
      <div className={cn("bg-white border border-gray-200 rounded-lg p-4", className)}>
        <div className="flex items-center space-x-2 mb-3">
          <Target className="w-5 h-5 text-blue-600" />
          <h3 className="font-medium text-gray-900">iReady Assessment History</h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={cn("bg-white border border-gray-200 rounded-lg p-4", className)}>
        <div className="flex items-center space-x-2 mb-3">
          <Target className="w-5 h-5 text-red-600" />
          <h3 className="font-medium text-gray-900">iReady Assessment History</h3>
        </div>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  // Render no data state
  if (!data || !data.hasData) {
    return (
      <div className={cn("bg-white border border-gray-200 rounded-lg p-4", className)}>
        <div className="flex items-center space-x-2 mb-3">
          <Target className="w-5 h-5 text-gray-600" />
          <h3 className="font-medium text-gray-900">iReady Assessment History</h3>
        </div>
        <p className="text-sm text-gray-500">
          {data?.message || 'No iReady assessment data available'}
        </p>
      </div>
    );
  }

  const { history, summary } = data;
  const maxRecordsToShow = showFullHistory ? undefined : 3;

  return (
    <div className={cn("bg-white border border-gray-200 rounded-lg", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center space-x-2">
          <Target className="w-5 h-5 text-blue-600" />
          <h3 className="font-medium text-gray-900">iReady Assessment History</h3>
        </div>
        <div className="text-xs text-gray-500">
          {summary.totalAssessments} assessment{summary.totalAssessments !== 1 ? 's' : ''}
          {summary.yearRange && ` • ${summary.yearRange}`}
        </div>
      </div>

      {/* Latest Scores Summary */}
      <div className="p-4 border-b border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Latest ELA */}
          {summary.latestEla && (
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Latest ELA</span>
                </div>
                {summary.trends && getTrendIcon(summary.trends.ela)}
              </div>
              <div className="space-y-1">
                <div className="text-lg font-bold text-blue-900">{summary.latestEla.score}</div>
                <div className={cn(
                  "inline-block px-2 py-1 rounded-full text-xs font-medium",
                  getPlacementColor(summary.latestEla.placement)
                )}>
                  {summary.latestEla.placement}
                </div>
                <div className="text-xs text-blue-700 mt-2">
                  {formatDate(summary.latestEla.date)}
                </div>
              </div>
            </div>
          )}

          {/* Latest Math */}
          {summary.latestMath && (
            <div className="bg-green-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Calculator className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Latest Math</span>
                </div>
                {summary.trends && getTrendIcon(summary.trends.math)}
              </div>
              <div className="space-y-1">
                <div className="text-lg font-bold text-green-900">{summary.latestMath.score}</div>
                <div className={cn(
                  "inline-block px-2 py-1 rounded-full text-xs font-medium",
                  getPlacementColor(summary.latestMath.placement)
                )}>
                  {summary.latestMath.placement}
                </div>
                <div className="text-xs text-green-700 mt-2">
                  {formatDate(summary.latestMath.date)}
                </div>
              </div>
            </div>
          )}

          {/* No data placeholders */}
          {!summary.latestEla && (
            <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <BookOpen className="w-6 h-6 mx-auto mb-1 opacity-50" />
                <div className="text-xs">No ELA data</div>
              </div>
            </div>
          )}

          {!summary.latestMath && (
            <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <Calculator className="w-6 h-6 mx-auto mb-1 opacity-50" />
                <div className="text-xs">No Math data</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Historical Data */}
      {(history.ela.length > 0 || history.math.length > 0) && (
        <div className="p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
            <Calendar className="w-4 h-4 mr-2" />
            Assessment Timeline
          </h4>

          {/* ELA History */}
          {history.ela.length > 0 && (
            <div className="mb-4">
              <h5 className="text-xs font-medium text-blue-700 mb-2 flex items-center">
                <BookOpen className="w-3 h-3 mr-1" />
                ELA Reading ({history.ela.length} assessment{history.ela.length !== 1 ? 's' : ''})
              </h5>
              <div className="space-y-2">
                {history.ela.slice(0, maxRecordsToShow).map((record, index) => (
                  <div key={record.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className="font-medium text-gray-900">{record.score}</span>
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          getPlacementColor(record.placement)
                        )}>
                          {record.placement}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatDate(record.date)} • {record.academicYear}
                      </div>
                    </div>
                    {index === 0 && (
                      <div className="text-xs text-blue-600 font-medium">Latest</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Math History */}
          {history.math.length > 0 && (
            <div className="mb-4">
              <h5 className="text-xs font-medium text-green-700 mb-2 flex items-center">
                <Calculator className="w-3 h-3 mr-1" />
                Mathematics ({history.math.length} assessment{history.math.length !== 1 ? 's' : ''})
              </h5>
              <div className="space-y-2">
                {history.math.slice(0, maxRecordsToShow).map((record, index) => (
                  <div key={record.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className="font-medium text-gray-900">{record.score}</span>
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          getPlacementColor(record.placement)
                        )}>
                          {record.placement}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatDate(record.date)} • {record.academicYear}
                      </div>
                    </div>
                    {index === 0 && (
                      <div className="text-xs text-green-600 font-medium">Latest</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Show More/Less Button */}
          {(history.ela.length > 3 || history.math.length > 3) && (
            <button
              onClick={() => setShowFullHistory(!showFullHistory)}
              className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium py-2 border-t border-gray-100 mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              aria-label={showFullHistory ? "Show fewer assessments" : "Show all assessments"}
            >
              {showFullHistory ? 'Show Less' : 'Show All Assessments'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
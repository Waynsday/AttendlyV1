'use client';

/**
 * @fileoverview InterventionsTimelineCard component
 * Displays a comprehensive chronological timeline of student interventions
 * including truancy letters, SARB referrals, conferences, and staff comments
 * 
 * Features:
 * - Chronological timeline with visual indicators
 * - Expandable intervention details
 * - Filtering and search capabilities
 * - Mobile-responsive design
 * - Accessibility compliant (WCAG 2.1 AA)
 * - FERPA-compliant data handling
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn } from '../utils/cn';
import { 
  FileText, 
  MessageSquare, 
  Users, 
  AlertTriangle, 
  Calendar, 
  ChevronDown, 
  ChevronUp,
  Filter,
  RefreshCw,
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Mail,
  Phone
} from 'lucide-react';

import { useInterventionsData, useInterventionStats, type InterventionTimelineItem, type InterventionFilters } from '../hooks/useInterventionsData';

interface InterventionsTimelineCardProps {
  studentId: string;
  className?: string;
  maxInitialItems?: number;
  showFilters?: boolean;
  onInterventionClick?: (intervention: InterventionTimelineItem) => void;
  autoRefresh?: boolean;
}

// Type-specific configuration
const INTERVENTION_CONFIG = {
  TRUANCY_LETTER: {
    icon: FileText,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    label: 'Truancy Letter'
  },
  SARB_REFERRAL: {
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    label: 'SARB Referral'
  },
  STAFF_COMMENT: {
    icon: MessageSquare,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    label: 'Staff Comment'
  },
  CONFERENCE: {
    icon: Users,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    label: 'Conference'
  },
  DOCUMENT: {
    icon: FileText,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    label: 'Document'
  }
} as const;

// Status configuration
const STATUS_CONFIG = {
  PENDING: { icon: Clock, color: 'text-yellow-600', label: 'Pending' },
  SENT: { icon: Mail, color: 'text-blue-600', label: 'Sent' },
  DELIVERED: { icon: CheckCircle, color: 'text-green-600', label: 'Delivered' },
  COMPLETED: { icon: CheckCircle, color: 'text-green-600', label: 'Completed' },
  SCHEDULED: { icon: Calendar, color: 'text-blue-600', label: 'Scheduled' },
  CANCELED: { icon: XCircle, color: 'text-red-600', label: 'Canceled' }
} as const;

// Individual timeline item component
interface TimelineItemProps {
  intervention: InterventionTimelineItem;
  isExpanded: boolean;
  onToggle: () => void;
  onClick?: (intervention: InterventionTimelineItem) => void;
}

const TimelineItem: React.FC<TimelineItemProps> = ({ intervention, isExpanded, onToggle, onClick }) => {
  const config = INTERVENTION_CONFIG[intervention.type];
  const statusConfig = STATUS_CONFIG[intervention.status];
  const IconComponent = config.icon;
  const StatusIcon = statusConfig.icon;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (onClick) {
      onClick(intervention);
    }
  }, [onClick, intervention]);

  return (
    <div 
      className={cn(
        'relative pl-6 pb-6 border-l-2 transition-all duration-200',
        config.borderColor,
        onClick && 'cursor-pointer hover:bg-gray-50'
      )}
      onClick={handleClick}
    >
      {/* Timeline dot */}
      <div className={cn(
        'absolute left-0 transform -translate-x-1/2 w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center',
        config.bgColor
      )}>
        <IconComponent className={cn('h-4 w-4', config.color)} />
      </div>

      {/* Main content */}
      <div className={cn(
        'bg-white rounded-lg border p-4 shadow-sm hover:shadow-md transition-shadow',
        intervention.followUpRequired && 'border-l-4 border-l-orange-400'
      )}>
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-medium text-gray-900 truncate">
                {intervention.title}
              </h4>
              <div className="flex items-center gap-1">
                <StatusIcon className={cn('h-3 w-3', statusConfig.color)} />
                <span className={cn('text-xs font-medium', statusConfig.color)}>
                  {statusConfig.label}
                </span>
              </div>
              {intervention.riskLevel === 'HIGH' && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  High Risk
                </span>
              )}
              {intervention.followUpRequired && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  Follow-up Required
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 mb-1">
              {formatDate(intervention.date)}
            </p>
            <p className="text-sm text-gray-700 line-clamp-2">
              {intervention.description}
            </p>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="ml-2 p-1 h-auto"
            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Creator info */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
          <span>Created by</span>
          <span className="font-medium">{intervention.createdBy.name}</span>
          <span>({intervention.createdBy.role})</span>
        </div>

        {/* Participants */}
        {intervention.participants && intervention.participants.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
            <Users className="h-3 w-3" />
            <span>{intervention.participants.join(', ')}</span>
          </div>
        )}

        {/* Expanded details */}
        {isExpanded && intervention.metadata && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="space-y-2 text-sm text-gray-700">
              {intervention.metadata.notes && (
                <div>
                  <span className="font-medium text-gray-900">Notes: </span>
                  {intervention.metadata.notes}
                </div>
              )}
              {intervention.metadata.outcome && (
                <div>
                  <span className="font-medium text-gray-900">Outcome: </span>
                  {intervention.metadata.outcome}
                </div>
              )}
              {intervention.metadata.followUpDate && (
                <div>
                  <span className="font-medium text-gray-900">Follow-up Date: </span>
                  {new Date(intervention.metadata.followUpDate).toLocaleDateString()}
                </div>
              )}
              {intervention.metadata.scheduledDate && (
                <div>
                  <span className="font-medium text-gray-900">Scheduled: </span>
                  {formatDate(intervention.metadata.scheduledDate)}
                </div>
              )}
              {intervention.metadata.actualDate && intervention.metadata.actualDate !== intervention.date && (
                <div>
                  <span className="font-medium text-gray-900">Actual Date: </span>
                  {formatDate(intervention.metadata.actualDate)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Loading skeleton component
const TimelineSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="space-y-6">
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="relative pl-6 pb-6 border-l-2 border-gray-200">
        <div className="absolute left-0 transform -translate-x-1/2 w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
        <div className="bg-white rounded-lg border p-4 space-y-3">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-full" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

// Main component
export const InterventionsTimelineCard: React.FC<InterventionsTimelineCardProps> = ({
  studentId,
  className,
  maxInitialItems = 10,
  showFilters = true,
  onInterventionClick,
  autoRefresh = false
}) => {
  // State
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  // Data fetching
  const {
    interventions,
    meta,
    isLoading,
    error,
    hasMore,
    filters,
    loadMore,
    refresh,
    setFilters,
    clearError,
    retryFetch
  } = useInterventionsData({
    studentId,
    filters: { searchTerm },
    pageSize: maxInitialItems,
    autoRefresh
  });

  // Statistics
  const stats = useInterventionStats(interventions);

  // Displayed interventions
  const displayedInterventions = useMemo(() => {
    if (showAll) return interventions;
    return interventions.slice(0, maxInitialItems);
  }, [interventions, showAll, maxInitialItems]);

  // Handlers
  const handleToggleExpanded = useCallback((id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const handleFilterChange = useCallback((key: keyof InterventionFilters, value: any) => {
    setFilters({
      ...filters,
      [key]: value
    });
  }, [filters, setFilters]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setFilters({
      ...filters,
      searchTerm: value
    });
  }, [filters, setFilters]);

  // Empty state
  if (!isLoading && interventions.length === 0 && !error) {
    return (
      <Card className={cn('bg-white border-2 border-primary shadow-lg', className)}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-primary">
            <MessageSquare className="h-5 w-5" />
            Interventions & Comments
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center space-y-3">
            <MessageSquare className="h-12 w-12 text-gray-400 mx-auto" />
            <div>
              <p className="text-sm font-medium text-gray-900">No interventions found</p>
              <p className="text-xs text-gray-500">This student has no recorded interventions or comments</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('bg-white border-2 border-primary shadow-lg', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2 text-primary">
            <MessageSquare className="h-5 w-5" />
            Interventions & Comments
            {meta && (
              <span className="text-sm font-normal text-gray-500">
                ({meta.totalCount})
              </span>
            )}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {showFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                className={cn(
                  'h-8',
                  showFiltersPanel && 'bg-primary text-white'
                )}
              >
                <Filter className="h-3 w-3 mr-1" />
                Filter
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              disabled={isLoading}
              className="h-8 w-8 p-0"
              aria-label="Refresh interventions"
            >
              <RefreshCw className={cn('h-3 w-3', isLoading && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* Summary stats */}
        {stats.totalCount > 0 && (
          <div className="flex flex-wrap gap-4 text-xs text-gray-600 pt-2">
            <span>Total: {stats.totalCount}</span>
            {stats.followUpCount > 0 && (
              <span className="text-orange-600 font-medium">
                {stats.followUpCount} follow-ups needed
              </span>
            )}
            {stats.highRiskCount > 0 && (
              <span className="text-red-600 font-medium">
                {stats.highRiskCount} high risk
              </span>
            )}
            {stats.recentActivity > 0 && (
              <span>
                {stats.recentActivity} recent (7 days)
              </span>
            )}
          </div>
        )}

        {/* Filters panel */}
        {showFilters && showFiltersPanel && (
          <div className="pt-3 border-t border-gray-200 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search interventions..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Filter dropdowns */}
            <div className="grid grid-cols-2 gap-3">
              <Select value={filters.type || ''} onValueChange={(value) => handleFilterChange('type', value || undefined)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  <SelectItem value="TRUANCY_LETTER">Truancy Letter</SelectItem>
                  <SelectItem value="SARB_REFERRAL">SARB Referral</SelectItem>
                  <SelectItem value="STAFF_COMMENT">Staff Comment</SelectItem>
                  <SelectItem value="CONFERENCE">Conference</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.status || ''} onValueChange={(value) => handleFilterChange('status', value || undefined)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                  <SelectItem value="SENT">Sent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {/* Error state */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Error loading interventions</p>
                <p className="text-xs text-red-700 mt-1">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={retryFetch}
                className="h-7 text-xs"
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && interventions.length === 0 && (
          <TimelineSkeleton count={3} />
        )}

        {/* Timeline content */}
        {!isLoading && displayedInterventions.length > 0 && (
          <div className="space-y-0">
            {displayedInterventions.map((intervention) => (
              <TimelineItem
                key={intervention.id}
                intervention={intervention}
                isExpanded={expandedItems.has(intervention.id)}
                onToggle={() => handleToggleExpanded(intervention.id)}
                onClick={onInterventionClick}
              />
            ))}

            {/* Show more button */}
            {!showAll && interventions.length > maxInitialItems && (
              <div className="text-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowAll(true)}
                  className="text-sm"
                >
                  Show {interventions.length - maxInitialItems} more
                </Button>
              </div>
            )}

            {/* Load more button */}
            {showAll && hasMore && (
              <div className="text-center pt-4">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={isLoading}
                  className="text-sm"
                >
                  {isLoading ? 'Loading...' : 'Load More'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Last updated info */}
        {meta && (
          <div className="text-center text-xs text-gray-500 pt-4 border-t border-gray-200">
            Data from {new Date(meta.dateRange.start).toLocaleDateString()} to {new Date(meta.dateRange.end).toLocaleDateString()}
            {meta.riskAssessment && (
              <span className={cn(
                'ml-2 px-2 py-0.5 rounded-full text-xs font-medium',
                meta.riskAssessment === 'HIGH' ? 'bg-red-100 text-red-800' :
                meta.riskAssessment === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              )}>
                {meta.riskAssessment.toLowerCase()} risk
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
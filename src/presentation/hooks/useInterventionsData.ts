'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * @fileoverview Custom hook for fetching and managing intervention timeline data
 * Provides comprehensive intervention history with filtering, pagination, and caching
 * 
 * Features:
 * - Automatic data fetching with error handling
 * - Real-time filtering and sorting
 * - Pagination support
 * - Loading states and error management
 * - Cache management with configurable TTL
 */

export interface InterventionTimelineItem {
  id: string;
  date: string;
  type: 'TRUANCY_LETTER' | 'SARB_REFERRAL' | 'STAFF_COMMENT' | 'CONFERENCE' | 'DOCUMENT';
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'COMPLETED' | 'SCHEDULED' | 'CANCELED';
  title: string;
  description: string;
  createdBy: {
    id: string;
    name: string;
    role: string;
  };
  participants?: string[];
  followUpRequired: boolean;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  metadata?: Record<string, any>;
}

export interface InterventionFilters {
  type?: string;
  status?: string;
  dateRange?: { start: string; end: string };
  riskLevel?: string;
  followUpOnly?: boolean;
  searchTerm?: string;
}

export interface InterventionMeta {
  totalCount: number;
  dateRange: { start: string; end: string };
  riskAssessment?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  pagination: {
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
}

interface UseInterventionsDataOptions {
  studentId: string | null;
  filters?: InterventionFilters;
  pageSize?: number;
  autoRefresh?: boolean;
  cacheTTL?: number; // Cache time-to-live in milliseconds
}

interface UseInterventionsDataResult {
  interventions: InterventionTimelineItem[];
  meta: InterventionMeta | null;
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  hasMore: boolean;
  filters: InterventionFilters;
  
  // Actions
  loadMore: () => void;
  refresh: () => void;
  setFilters: (filters: InterventionFilters) => void;
  clearError: () => void;
  retryFetch: () => void;
}

// Cache management
interface CacheEntry {
  data: InterventionTimelineItem[];
  meta: InterventionMeta;
  timestamp: number;
  key: string;
}

const cache = new Map<string, CacheEntry>();

function getCacheKey(studentId: string, filters: InterventionFilters, page: number, pageSize: number): string {
  const filterKey = JSON.stringify(filters);
  return `interventions_${studentId}_${page}_${pageSize}_${btoa(filterKey)}`;
}

function isExpired(entry: CacheEntry, ttl: number): boolean {
  return Date.now() - entry.timestamp > ttl;
}

export function useInterventionsData({
  studentId,
  filters = {},
  pageSize = 20,
  autoRefresh = false,
  cacheTTL = 5 * 60 * 1000 // 5 minutes default
}: UseInterventionsDataOptions): UseInterventionsDataResult {
  // State management
  const [interventions, setInterventions] = useState<InterventionTimelineItem[]>([]);
  const [meta, setMeta] = useState<InterventionMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentFilters, setCurrentFilters] = useState<InterventionFilters>(filters);

  // Computed values
  const hasMore = meta?.pagination?.hasMore ?? false;

  // Generate cache key for current request
  const cacheKey = useMemo(() => {
    if (!studentId) return '';
    return getCacheKey(studentId, currentFilters, currentPage, pageSize);
  }, [studentId, currentFilters, currentPage, pageSize]);

  // Fetch interventions data
  const fetchInterventions = useCallback(async (
    page: number = 1, 
    append: boolean = false,
    forceRefresh: boolean = false
  ) => {
    if (!studentId) {
      setInterventions([]);
      setMeta(null);
      return;
    }

    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = cache.get(cacheKey);
      if (cached && !isExpired(cached, cacheTTL)) {
        if (append) {
          setInterventions(prev => [...prev, ...cached.data]);
        } else {
          setInterventions(cached.data);
        }
        setMeta(cached.meta);
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      // Add filter parameters
      if (currentFilters.type) params.append('type', currentFilters.type);
      if (currentFilters.status) params.append('status', currentFilters.status);
      if (currentFilters.dateRange?.start) params.append('startDate', currentFilters.dateRange.start);
      if (currentFilters.dateRange?.end) params.append('endDate', currentFilters.dateRange.end);

      const response = await fetch(`/api/interventions/timeline/${studentId}?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch interventions: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Unknown error occurred');
      }

      // Apply client-side filters
      let filteredData = result.data;

      // Risk level filter
      if (currentFilters.riskLevel) {
        filteredData = filteredData.filter(
          (item: InterventionTimelineItem) => item.riskLevel === currentFilters.riskLevel
        );
      }

      // Follow-up only filter
      if (currentFilters.followUpOnly) {
        filteredData = filteredData.filter(
          (item: InterventionTimelineItem) => item.followUpRequired
        );
      }

      // Search term filter
      if (currentFilters.searchTerm) {
        const searchLower = currentFilters.searchTerm.toLowerCase();
        filteredData = filteredData.filter(
          (item: InterventionTimelineItem) => 
            item.title.toLowerCase().includes(searchLower) ||
            item.description.toLowerCase().includes(searchLower) ||
            item.createdBy.name.toLowerCase().includes(searchLower)
        );
      }

      // Update state
      if (append && page > 1) {
        setInterventions(prev => [...prev, ...filteredData]);
      } else {
        setInterventions(filteredData);
      }

      setMeta(result.meta);
      setCurrentPage(page);

      // Cache the results
      cache.set(cacheKey, {
        data: filteredData,
        meta: result.meta,
        timestamp: Date.now(),
        key: cacheKey
      });

      // Clean up old cache entries (keep only 20 most recent)
      if (cache.size > 20) {
        const entries = Array.from(cache.entries());
        entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
        cache.clear();
        entries.slice(0, 20).forEach(([key, value]) => cache.set(key, value));
      }

    } catch (err) {
      console.error('Error fetching interventions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load intervention data');
      setInterventions([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [studentId, currentFilters, pageSize, cacheTTL, cacheKey]);

  // Load more interventions (pagination)
  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      fetchInterventions(currentPage + 1, true);
    }
  }, [hasMore, isLoading, currentPage, fetchInterventions]);

  // Refresh current data
  const refresh = useCallback(() => {
    fetchInterventions(1, false, true);
  }, [fetchInterventions]);

  // Update filters
  const setFilters = useCallback((newFilters: InterventionFilters) => {
    setCurrentFilters(newFilters);
    setCurrentPage(1);
    // Clear interventions to show loading state
    setInterventions([]);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Retry fetch after error
  const retryFetch = useCallback(() => {
    fetchInterventions(currentPage);
  }, [fetchInterventions, currentPage]);

  // Effect: Fetch data when dependencies change
  useEffect(() => {
    fetchInterventions(1);
  }, [studentId, currentFilters, pageSize]);

  // Effect: Auto refresh
  useEffect(() => {
    if (autoRefresh && studentId) {
      const interval = setInterval(() => {
        fetchInterventions(1, false, true);
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [autoRefresh, studentId, fetchInterventions]);

  return {
    interventions,
    meta,
    isLoading,
    error,
    currentPage,
    hasMore,
    filters: currentFilters,
    
    // Actions
    loadMore,
    refresh,
    setFilters,
    clearError,
    retryFetch
  };
}

// Helper hook for intervention statistics
export function useInterventionStats(interventions: InterventionTimelineItem[]) {
  return useMemo(() => {
    const stats = {
      totalCount: interventions.length,
      byType: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      followUpCount: 0,
      highRiskCount: 0,
      recentActivity: 0, // Last 7 days
    };

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    interventions.forEach(intervention => {
      // Count by type
      stats.byType[intervention.type] = (stats.byType[intervention.type] || 0) + 1;
      
      // Count by status
      stats.byStatus[intervention.status] = (stats.byStatus[intervention.status] || 0) + 1;
      
      // Count follow-ups
      if (intervention.followUpRequired) {
        stats.followUpCount++;
      }
      
      // Count high risk
      if (intervention.riskLevel === 'HIGH' || intervention.riskLevel === 'CRITICAL') {
        stats.highRiskCount++;
      }
      
      // Count recent activity
      if (new Date(intervention.date) > sevenDaysAgo) {
        stats.recentActivity++;
      }
    });

    return stats;
  }, [interventions]);
}
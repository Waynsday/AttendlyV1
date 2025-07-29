/**
 * @fileoverview Aeries Admin Dashboard
 * 
 * Complete admin interface for managing Aeries SIS integration.
 * Copy-paste ready with all functionality implemented.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Select } from '@/presentation/components/ui/select';
import { 
  Play, 
  Square, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Database,
  Settings,
  Calendar,
  Users
} from 'lucide-react';

// =====================================================
// Types and Interfaces
// =====================================================

interface SyncOperation {
  operationId: string;
  type: 'FULL_SYNC' | 'INCREMENTAL_SYNC' | 'MANUAL_SYNC';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  startTime: string;
  endTime?: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  progress: {
    totalRecords: number;
    processedRecords: number;
    successfulRecords: number;
    failedRecords: number;
    currentBatch: number;
    totalBatches: number;
  };
  errors: Array<{
    errorId: string;
    batchNumber: number;
    errorMessage: string;
    timestamp: string;
  }>;
  metadata: {
    initiatedBy: string;
    userAgent: string;
    ipAddress: string;
  };
}

interface AeriesStatus {
  connectionStatus: {
    isConnected: boolean;
    lastChecked: string;
  };
  syncStatus: {
    isRunning: boolean;
    currentOperation: SyncOperation | null;
    lastSync: string | null;
  };
  configuration: {
    syncEnabled: boolean;
    schedule: string;
    dateRange: {
      startDate: string;
      endDate: string;
    };
    batchSize: number;
    rateLimitPerMinute: number;
  };
  history: SyncOperation[];
}

// =====================================================
// Main Dashboard Component
// =====================================================

export default function AeriesAdminDashboard() {
  const [status, setStatus] = useState<AeriesStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Manual sync form state
  const [syncForm, setSyncForm] = useState({
    syncType: 'MANUAL_SYNC' as const,
    startDate: '2024-08-15',
    endDate: '2025-06-12',
    batchSize: 100,
    forceRefresh: false
  });

  // =====================================================
  // Data Fetching Functions
  // =====================================================

  const fetchStatus = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/aeries');
      const data = await response.json();

      if (data.success) {
        setStatus(data.data);
        setError(null);
      } else {
        setError(data.error?.message || 'Failed to fetch Aeries status');
      }
    } catch (err) {
      setError('Network error: Unable to fetch Aeries status');
      console.error('Failed to fetch Aeries status:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const startSync = async () => {
    try {
      setSyncLoading(true);
      const response = await fetch('/api/aeries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'admin-user'
        },
        body: JSON.stringify(syncForm)
      });

      const data = await response.json();

      if (data.success) {
        // Refresh status to show new operation
        await fetchStatus();
      } else {
        setError(data.error?.message || 'Failed to start sync operation');
      }
    } catch (err) {
      setError('Network error: Unable to start sync operation');
      console.error('Failed to start sync:', err);
    } finally {
      setSyncLoading(false);
    }
  };

  const cancelSync = async () => {
    try {
      setSyncLoading(true);
      const response = await fetch('/api/aeries', {
        method: 'DELETE',
        headers: {
          'X-User-ID': 'admin-user'
        }
      });

      const data = await response.json();

      if (data.success) {
        // Refresh status
        await fetchStatus();
      } else {
        setError(data.error?.message || 'Failed to cancel sync operation');
      }
    } catch (err) {
      setError('Network error: Unable to cancel sync operation');
      console.error('Failed to cancel sync:', err);
    } finally {
      setSyncLoading(false);
    }
  };

  // =====================================================
  // Effects
  // =====================================================

  useEffect(() => {
    fetchStatus();
    
    // Auto-refresh every 30 seconds if sync is running
    const interval = setInterval(() => {
      if (status?.syncStatus.isRunning) {
        fetchStatus();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [status?.syncStatus.isRunning]);

  // =====================================================
  // Render Helper Functions
  // =====================================================

  const renderConnectionStatus = () => {
    if (!status) return null;

    const { isConnected, lastChecked } = status.connectionStatus;
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Aeries Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {isConnected ? (
              <CheckCircle className="h-6 w-6 text-green-500" />
            ) : (
              <AlertCircle className="h-6 w-6 text-red-500" />
            )}
            <div>
              <div className={`font-semibold ${isConnected ? 'text-green-700' : 'text-red-700'}`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </div>
              <div className="text-sm text-gray-500">
                Last checked: {new Date(lastChecked).toLocaleString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderCurrentSync = () => {
    if (!status?.syncStatus.currentOperation) return null;

    const operation = status.syncStatus.currentOperation;
    const progress = operation.progress;
    const progressPercent = progress.totalRecords > 0 
      ? Math.round((progress.processedRecords / progress.totalRecords) * 100) 
      : 0;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className={`h-5 w-5 ${operation.status === 'IN_PROGRESS' ? 'animate-spin' : ''}`} />
            Current Sync Operation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{operation.type.replace('_', ' ')}</div>
              <div className="text-sm text-gray-500">
                {operation.dateRange.startDate} to {operation.dateRange.endDate}
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              operation.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
              operation.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
              operation.status === 'FAILED' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {operation.status.replace('_', ' ')}
            </div>
          </div>

          {operation.status === 'IN_PROGRESS' && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
                <div className="text-sm text-gray-500">
                  {progress.processedRecords.toLocaleString()} / {progress.totalRecords.toLocaleString()} records
                  {progress.currentBatch > 0 && ` (Batch ${progress.currentBatch}/${progress.totalBatches})`}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {progress.successfulRecords.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">Successful</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">
                    {progress.failedRecords.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">Failed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {operation.errors.length}
                  </div>
                  <div className="text-sm text-gray-500">Errors</div>
                </div>
              </div>

              <Button 
                onClick={cancelSync} 
                disabled={syncLoading}
                variant="destructive"
                className="w-full"
              >
                <Square className="h-4 w-4 mr-2" />
                Cancel Sync
              </Button>
            </>
          )}

          {operation.status === 'COMPLETED' && (
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-green-800 font-semibold mb-2">Sync Completed Successfully</div>
              <div className="text-sm text-green-700">
                Processed {progress.successfulRecords.toLocaleString()} records
                {operation.endTime && (
                  <span className="ml-2">
                    Duration: {Math.round((new Date(operation.endTime).getTime() - new Date(operation.startTime).getTime()) / 1000)}s
                  </span>
                )}
              </div>
            </div>
          )}

          {operation.status === 'FAILED' && (
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-red-800 font-semibold mb-2">Sync Failed</div>
              <div className="text-sm text-red-700">
                {operation.errors.length > 0 && (
                  <div>Latest error: {operation.errors[operation.errors.length - 1].errorMessage}</div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderManualSync = () => {
    const canStartSync = status && !status.syncStatus.isRunning && status.connectionStatus.isConnected;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Manual Sync
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <Input
                type="date"
                value={syncForm.startDate}
                onChange={(e) => setSyncForm({ ...syncForm, startDate: e.target.value })}
                min="2024-08-15"
                max="2025-06-12"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <Input
                type="date"
                value={syncForm.endDate}
                onChange={(e) => setSyncForm({ ...syncForm, endDate: e.target.value })}
                min="2024-08-15"
                max="2025-06-12"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Batch Size</label>
            <Input
              type="number"
              min="1"
              max="1000"
              value={syncForm.batchSize}
              onChange={(e) => setSyncForm({ ...syncForm, batchSize: parseInt(e.target.value) || 100 })}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="forceRefresh"
              checked={syncForm.forceRefresh}
              onChange={(e) => setSyncForm({ ...syncForm, forceRefresh: e.target.checked })}
            />
            <label htmlFor="forceRefresh" className="text-sm">Force refresh existing records</label>
          </div>

          <Button 
            onClick={startSync} 
            disabled={!canStartSync || syncLoading}
            className="w-full"
          >
            <Play className="h-4 w-4 mr-2" />
            {syncLoading ? 'Starting...' : 'Start Manual Sync'}
          </Button>

          {!status?.connectionStatus.isConnected && (
            <div className="text-sm text-red-600">
              Cannot start sync: Aeries connection not available
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderConfiguration = () => {
    if (!status) return null;

    const config = status.configuration;
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium">Scheduled Sync</div>
              <div className={config.syncEnabled ? 'text-green-600' : 'text-red-600'}>
                {config.syncEnabled ? 'Enabled' : 'Disabled'}
              </div>
            </div>
            <div>
              <div className="font-medium">Schedule</div>
              <div className="text-gray-600">{config.schedule}</div>
            </div>
            <div>
              <div className="font-medium">Date Range</div>
              <div className="text-gray-600">
                {config.dateRange.startDate} to {config.dateRange.endDate}
              </div>
            </div>
            <div>
              <div className="font-medium">Batch Size</div>
              <div className="text-gray-600">{config.batchSize} records</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderSyncHistory = () => {
    if (!status?.history.length) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Sync History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {status.history.slice(0, 5).map((operation) => (
              <div key={operation.operationId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">{operation.type.replace('_', ' ')}</div>
                  <div className="text-sm text-gray-500">
                    {new Date(operation.startTime).toLocaleString()}
                    {operation.endTime && ` - ${new Date(operation.endTime).toLocaleString()}`}
                  </div>
                  {operation.progress.totalRecords > 0 && (
                    <div className="text-sm text-gray-500">
                      {operation.progress.successfulRecords.toLocaleString()} / {operation.progress.totalRecords.toLocaleString()} records
                    </div>
                  )}
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  operation.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                  operation.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                  operation.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {operation.status.replace('_', ' ')}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  // =====================================================
  // Main Render
  // =====================================================

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Aeries Administration</h1>
          <p className="text-gray-600">Loading Aeries SIS integration status...</p>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 rounded-lg"></div>
          <div className="h-32 bg-gray-200 rounded-lg"></div>
          <div className="h-32 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-romoland-primary">Aeries Administration</h1>
          <p className="text-romoland-text">Manage Aeries SIS integration for Romoland School District</p>
        </div>
        <Button 
          onClick={fetchStatus} 
          disabled={refreshing}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <div className="text-red-800 font-semibold">Error</div>
          </div>
          <div className="text-red-700 mt-1">{error}</div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {renderConnectionStatus()}
          {renderManualSync()}
          {renderConfiguration()}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {renderCurrentSync()}
          {renderSyncHistory()}
        </div>
      </div>
    </div>
  );
}
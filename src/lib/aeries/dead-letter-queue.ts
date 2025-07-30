/**
 * @fileoverview Dead Letter Queue Implementation
 * 
 * Handles failed Aeries sync operations with retry logic, persistence,
 * and monitoring capabilities for enhanced reliability.
 * 
 * Features:
 * - Persistent storage of failed operations
 * - Exponential backoff retry scheduling
 * - Priority queuing (fewer retries = higher priority)
 * - Automatic cleanup of old items
 * - Comprehensive statistics and monitoring
 */

import fs from 'fs/promises';
import path from 'path';

export interface FailedOperation {
  operationId: string;
  type: 'ATTENDANCE_SYNC' | 'STUDENT_SYNC' | 'TEACHER_SYNC' | 'MANUAL_SYNC';
  error: Error;
  timestamp: string;
  retryCount: number;
  payload: any;
  nextRetryAt?: string;
  processedAt?: string;
}

export interface QueueStats {
  totalItems: number;
  pendingItems: number;
  processedItems: number;
  permanentlyFailedItems: number;
  averageRetryCount: number;
  oldestItem: string;
  queueUtilization: number;
}

export interface DeadLetterQueueConfig {
  maxRetries?: number;
  retryDelayMs?: number;
  maxQueueSize?: number;
  persistencePath?: string;
  autoCleanupMs?: number;
}

/**
 * Dead Letter Queue for handling failed operations
 */
export class DeadLetterQueue {
  private config: Required<DeadLetterQueueConfig>;
  private queue: Map<string, FailedOperation> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: DeadLetterQueueConfig = {}) {
    this.config = {
      maxRetries: config.maxRetries || 3,
      retryDelayMs: config.retryDelayMs || 5000,
      maxQueueSize: config.maxQueueSize || 1000,
      persistencePath: config.persistencePath || './dlq-storage.json',
      autoCleanupMs: config.autoCleanupMs || 3600000 // 1 hour
    };

    // Start auto-cleanup if enabled
    if (this.config.autoCleanupMs > 0) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup(86400000); // Clean items older than 24 hours
      }, this.config.autoCleanupMs);
    }
  }

  /**
   * Add a failed operation to the queue
   */
  async add(operation: FailedOperation): Promise<void> {
    // Check if queue is full
    if (this.queue.size >= this.config.maxQueueSize) {
      throw new Error('Queue is full');
    }

    // Check if operation has exceeded max retries
    if (operation.retryCount >= this.config.maxRetries) {
      // Mark as permanently failed
      operation.processedAt = new Date().toISOString();
    } else {
      // Calculate next retry time
      if (!operation.nextRetryAt) {
        const delay = await this.calculateRetryDelay(operation);
        operation.nextRetryAt = new Date(Date.now() + delay).toISOString();
      }
    }

    this.queue.set(operation.operationId, operation);
    
    console.log(`[DLQ] Added operation ${operation.operationId} (retry ${operation.retryCount}/${this.config.maxRetries})`);
  }

  /**
   * Get the next item ready for processing
   */
  async getNextItem(): Promise<FailedOperation | null> {
    const now = new Date();
    const candidates: FailedOperation[] = [];

    // Find items ready for retry
    for (const operation of this.queue.values()) {
      // Skip processed items and permanently failed items
      if (operation.processedAt || operation.retryCount >= this.config.maxRetries) {
        continue;
      }

      // Check if retry time has passed
      if (!operation.nextRetryAt || new Date(operation.nextRetryAt) <= now) {
        candidates.push(operation);
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    // Sort by retry count (lower retry count = higher priority)
    candidates.sort((a, b) => a.retryCount - b.retryCount);

    return candidates[0];
  }

  /**
   * Mark an operation as successfully processed
   */
  async markAsProcessed(operationId: string): Promise<void> {
    const operation = this.queue.get(operationId);
    if (operation) {
      operation.processedAt = new Date().toISOString();
      console.log(`[DLQ] Marked operation ${operationId} as processed`);
    }
  }

  /**
   * Increment retry count for a failed operation
   */
  async incrementRetryCount(operation: FailedOperation): Promise<FailedOperation> {
    const updatedOperation = {
      ...operation,
      retryCount: operation.retryCount + 1,
      timestamp: new Date().toISOString()
    };

    // Calculate next retry time
    const delay = await this.calculateRetryDelay(updatedOperation);
    updatedOperation.nextRetryAt = new Date(Date.now() + delay).toISOString();

    return updatedOperation;
  }

  /**
   * Calculate exponential backoff delay
   */
  async calculateRetryDelay(operation: FailedOperation): Promise<number> {
    // Exponential backoff: baseDelay * (2 ^ retryCount)
    const delay = this.config.retryDelayMs * Math.pow(2, operation.retryCount);
    
    // Cap at maximum reasonable delay (30 minutes)
    return Math.min(delay, 1800000);
  }

  /**
   * Get comprehensive queue statistics
   */
  async getStats(): Promise<QueueStats> {
    const operations = Array.from(this.queue.values());
    const totalItems = operations.length;
    
    const pendingItems = operations.filter(op => 
      !op.processedAt && op.retryCount < this.config.maxRetries
    ).length;
    
    const processedItems = operations.filter(op => op.processedAt).length;
    
    const permanentlyFailedItems = operations.filter(op => 
      !op.processedAt && op.retryCount >= this.config.maxRetries
    ).length;

    const totalRetries = operations.reduce((sum, op) => sum + op.retryCount, 0);
    const averageRetryCount = totalItems > 0 ? totalRetries / totalItems : 0;

    const oldestItem = operations.length > 0 
      ? operations.reduce((oldest, current) => 
          new Date(current.timestamp) < new Date(oldest.timestamp) ? current : oldest
        ).timestamp
      : new Date().toISOString();

    const queueUtilization = (totalItems / this.config.maxQueueSize) * 100;

    return {
      totalItems,
      pendingItems,
      processedItems,
      permanentlyFailedItems,
      averageRetryCount: Math.round(averageRetryCount * 100) / 100,
      oldestItem,
      queueUtilization: Math.round(queueUtilization * 100) / 100
    };
  }

  /**
   * Clean up old items from the queue
   */
  async cleanup(maxAgeMs: number): Promise<number> {
    const cutoffTime = new Date(Date.now() - maxAgeMs);
    let cleanedCount = 0;

    for (const [operationId, operation] of this.queue.entries()) {
      // Remove old processed items
      if (operation.processedAt && new Date(operation.processedAt) < cutoffTime) {
        this.queue.delete(operationId);
        cleanedCount++;
      }
      // Remove old permanently failed items
      else if (operation.retryCount >= this.config.maxRetries && 
               new Date(operation.timestamp) < cutoffTime) {
        this.queue.delete(operationId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[DLQ] Cleaned up ${cleanedCount} old items`);
    }

    return cleanedCount;
  }

  /**
   * Persist queue state to disk
   */
  async persist(): Promise<void> {
    try {
      const queueData = Array.from(this.queue.entries()).map(([id, operation]) => ({
        id,
        operation: {
          ...operation,
          error: {
            message: operation.error.message,
            stack: operation.error.stack,
            name: operation.error.name
          }
        }
      }));

      const persistenceDir = path.dirname(this.config.persistencePath);
      await fs.mkdir(persistenceDir, { recursive: true });
      
      await fs.writeFile(
        this.config.persistencePath,
        JSON.stringify(queueData, null, 2),
        'utf8'
      );

      console.log(`[DLQ] Persisted ${queueData.length} items to ${this.config.persistencePath}`);
    } catch (error) {
      console.error('[DLQ] Failed to persist queue:', error);
      throw error;
    }
  }

  /**
   * Restore queue state from disk
   */
  async restore(): Promise<void> {
    try {
      const data = await fs.readFile(this.config.persistencePath, 'utf8');
      const queueData = JSON.parse(data);

      this.queue.clear();
      
      for (const item of queueData) {
        // Reconstruct Error object
        const error = new Error(item.operation.error.message);
        error.stack = item.operation.error.stack;
        error.name = item.operation.error.name;

        const operation: FailedOperation = {
          ...item.operation,
          error
        };

        this.queue.set(item.id, operation);
      }

      console.log(`[DLQ] Restored ${queueData.length} items from ${this.config.persistencePath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist yet - this is fine for first run
        console.log('[DLQ] No persistence file found - starting with empty queue');
      } else {
        console.error('[DLQ] Failed to restore queue:', error);
        throw error;
      }
    }
  }

  /**
   * Get all operations (for debugging/monitoring)
   */
  getAllOperations(): FailedOperation[] {
    return Array.from(this.queue.values());
  }

  /**
   * Get operation by ID
   */
  getOperation(operationId: string): FailedOperation | undefined {
    return this.queue.get(operationId);
  }

  /**
   * Remove operation from queue
   */
  removeOperation(operationId: string): boolean {
    return this.queue.delete(operationId);
  }

  /**
   * Clear all operations (use with caution)
   */
  clear(): void {
    this.queue.clear();
    console.log('[DLQ] Queue cleared');
  }

  /**
   * Get operations by type
   */
  getOperationsByType(type: FailedOperation['type']): FailedOperation[] {
    return Array.from(this.queue.values()).filter(op => op.type === type);
  }

  /**
   * Get operations by retry count
   */
  getOperationsByRetryCount(retryCount: number): FailedOperation[] {
    return Array.from(this.queue.values()).filter(op => op.retryCount === retryCount);
  }

  /**
   * Check if queue has capacity for new items
   */
  hasCapacity(): boolean {
    return this.queue.size < this.config.maxQueueSize;
  }

  /**
   * Get remaining capacity
   */
  getRemainingCapacity(): number {
    return this.config.maxQueueSize - this.queue.size;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
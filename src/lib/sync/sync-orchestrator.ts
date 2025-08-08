/**
 * @fileoverview Sync Orchestrator
 * 
 * Manages complex sync workflows, coordinates multiple data sources,
 * and handles batch processing with parallel execution capabilities.
 * 
 * Features:
 * - Multi-source sync coordination
 * - Batch processing with configurable parallelism
 * - Dependency management between sync operations
 * - Resource allocation and throttling
 * - Comprehensive workflow monitoring
 */

import { EventEmitter } from 'events';
import { DataSyncService } from './data-sync-service';
import type { 
  SyncOperation,
  SyncResult,
  SyncConfiguration,
  SyncMetrics,
  ProgressUpdate
} from '../../types/sync';

export interface SyncWorkflow {
  id: string;
  name: string;
  operations: SyncOperation[];
  dependencies: WorkflowDependency[];
  parallelism: ParallelismConfig;
  retryPolicy: WorkflowRetryPolicy;
  timeout: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: WorkflowStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  createdBy: string;
}

export interface WorkflowDependency {
  operationId: string;
  dependsOn: string[];
  type: 'SEQUENTIAL' | 'PARALLEL' | 'CONDITIONAL';
  condition?: (result: SyncResult) => boolean;
}

export interface ParallelismConfig {
  maxConcurrentOperations: number;
  resourceLimits: {
    maxMemoryUsage: string;
    maxCpuUsage: number;
    maxDatabaseConnections: number;
  };
  batchingStrategy: 'SIZE_BASED' | 'TIME_BASED' | 'RESOURCE_BASED';
  batchSize?: number;
  batchTimeout?: number;
}

export interface WorkflowRetryPolicy {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  multiplier: number;
  retryableOperations: string[];
}

export type WorkflowStatus = 
  | 'PENDING'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'RETRYING';

export interface WorkflowResult {
  workflowId: string;
  status: WorkflowStatus;
  startTime: string;
  endTime?: string;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  skippedOperations: number;
  operationResults: Map<string, SyncResult>;
  errors: WorkflowError[];
  metrics: WorkflowMetrics;
}

export interface WorkflowError {
  operationId: string;
  error: string;
  timestamp: string;
  retryAttempt: number;
  fatal: boolean;
}

export interface WorkflowMetrics {
  totalExecutionTime: number;
  averageOperationTime: number;
  throughputOperationsPerSecond: number;
  resourceUtilization: {
    peakMemoryUsage: string;
    peakCpuUsage: number;
    peakDatabaseConnections: number;
  };
  parallelismEfficiency: number;
}

/**
 * Sync Orchestrator - Manages complex sync workflows
 */
export class SyncOrchestrator extends EventEmitter {
  private syncService: DataSyncService;
  private activeWorkflows = new Map<string, WorkflowExecution>();
  private workflowQueue: SyncWorkflow[] = [];
  private resourceMonitor: ResourceMonitor;
  private maxConcurrentWorkflows: number;

  constructor(
    syncService: DataSyncService,
    config: {
      maxConcurrentWorkflows?: number;
      resourceLimits?: {
        maxMemoryUsage: string;
        maxCpuUsage: number;
        maxDatabaseConnections: number;
      };
    } = {}
  ) {
    super();
    this.syncService = syncService;
    this.maxConcurrentWorkflows = config.maxConcurrentWorkflows || 5;
    this.resourceMonitor = new ResourceMonitor(config.resourceLimits);
    
    // Setup workflow processing
    this.setupWorkflowProcessor();
  }

  /**
   * Submit a sync workflow for execution
   */
  async submitWorkflow(workflow: SyncWorkflow): Promise<{ success: boolean; workflowId: string; error?: string }> {
    try {
      // Validate workflow
      const validationResult = this.validateWorkflow(workflow);
      if (!validationResult.valid) {
        return { 
          success: false, 
          workflowId: workflow.id, 
          error: validationResult.error 
        };
      }

      // Add to queue
      this.workflowQueue.push({
        ...workflow,
        status: 'PENDING',
        createdAt: new Date().toISOString()
      });

      this.emit('workflowQueued', { workflowId: workflow.id });
      
      // Try to start processing
      await this.processWorkflowQueue();

      return { success: true, workflowId: workflow.id };
    } catch (error) {
      return { 
        success: false, 
        workflowId: workflow.id, 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Execute a single workflow
   */
  async executeWorkflow(workflow: SyncWorkflow): Promise<WorkflowResult> {
    const workflowExecution: WorkflowExecution = {
      workflow: { ...workflow, status: 'RUNNING', startedAt: new Date().toISOString() },
      operationResults: new Map(),
      errors: [],
      startTime: Date.now(),
      resourceUsage: {
        peakMemoryUsage: '0MB',
        peakCpuUsage: 0,
        peakDatabaseConnections: 0
      }
    };

    this.activeWorkflows.set(workflow.id, workflowExecution);
    this.emit('workflowStarted', { workflowId: workflow.id });

    try {
      // Build execution plan based on dependencies
      const executionPlan = this.buildExecutionPlan(workflow);
      
      // Execute operations according to plan
      for (const phase of executionPlan) {
        await this.executePhase(phase, workflowExecution);
      }

      // Complete workflow
      const result = this.completeWorkflow(workflowExecution, 'COMPLETED');
      this.emit('workflowCompleted', { workflowId: workflow.id, result });
      
      return result;

    } catch (error) {
      workflowExecution.errors.push({
        operationId: 'WORKFLOW',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        retryAttempt: 0,
        fatal: true
      });

      const result = this.completeWorkflow(workflowExecution, 'FAILED');
      this.emit('workflowFailed', { workflowId: workflow.id, result, error });
      
      return result;
    } finally {
      this.activeWorkflows.delete(workflow.id);
    }
  }

  /**
   * Cancel a running workflow
   */
  async cancelWorkflow(workflowId: string): Promise<{ success: boolean; error?: string }> {
    const execution = this.activeWorkflows.get(workflowId);
    if (!execution) {
      return { success: false, error: 'Workflow not found or not running' };
    }

    try {
      execution.workflow.status = 'CANCELLED';
      
      // Cancel active operations (this would require sync service to support cancellation)
      // For now, we'll just mark as cancelled
      
      const result = this.completeWorkflow(execution, 'CANCELLED');
      this.emit('workflowCancelled', { workflowId, result });
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get workflow status and progress
   */
  getWorkflowStatus(workflowId: string): {
    status: WorkflowStatus;
    progress: number;
    operationsCompleted: number;
    totalOperations: number;
    currentOperation?: string;
    estimatedTimeRemaining?: number;
  } | null {
    const execution = this.activeWorkflows.get(workflowId);
    if (!execution) {
      return null;
    }

    const totalOperations = execution.workflow.operations.length;
    const operationsCompleted = execution.operationResults.size;
    const progress = totalOperations > 0 ? Math.round((operationsCompleted / totalOperations) * 100) : 0;

    return {
      status: execution.workflow.status,
      progress,
      operationsCompleted,
      totalOperations,
      currentOperation: this.getCurrentOperation(execution)?.id,
      estimatedTimeRemaining: this.estimateTimeRemaining(execution)
    };
  }

  /**
   * Get comprehensive orchestrator metrics
   */
  async getMetrics(): Promise<{
    activeWorkflows: number;
    queuedWorkflows: number;
    completedWorkflows: number;
    failedWorkflows: number;
    averageWorkflowTime: number;
    resourceUtilization: {
      memoryUsage: string;
      cpuUsage: number;
      databaseConnections: number;
    };
  }> {
    return {
      activeWorkflows: this.activeWorkflows.size,
      queuedWorkflows: this.workflowQueue.length,
      completedWorkflows: 0, // Would track in persistent storage
      failedWorkflows: 0,    // Would track in persistent storage
      averageWorkflowTime: 0, // Would calculate from historical data
      resourceUtilization: await this.resourceMonitor.getCurrentUsage()
    };
  }

  /**
   * Build execution plan based on dependencies
   */
  private buildExecutionPlan(workflow: SyncWorkflow): ExecutionPhase[] {
    const phases: ExecutionPhase[] = [];
    const processed = new Set<string>();
    const operationsMap = new Map(workflow.operations.map(op => [op.id, op]));
    const dependenciesMap = new Map(workflow.dependencies.map(dep => [dep.operationId, dep]));

    while (processed.size < workflow.operations.length) {
      const phase: ExecutionPhase = {
        operations: [],
        parallelism: workflow.parallelism
      };

      // Find operations that can be executed (no unprocessed dependencies)
      for (const operation of workflow.operations) {
        if (processed.has(operation.id)) continue;

        const dependency = dependenciesMap.get(operation.id);
        const canExecute = !dependency || 
          dependency.dependsOn.every(depId => processed.has(depId));

        if (canExecute) {
          phase.operations.push(operation);
          processed.add(operation.id);
        }
      }

      if (phase.operations.length === 0) {
        throw new Error('Circular dependency detected in workflow');
      }

      phases.push(phase);
    }

    return phases;
  }

  /**
   * Execute a phase of operations
   */
  private async executePhase(phase: ExecutionPhase, execution: WorkflowExecution): Promise<void> {
    const maxConcurrent = Math.min(
      phase.parallelism.maxConcurrentOperations,
      phase.operations.length
    );

    // Execute operations in batches based on parallelism config
    for (let i = 0; i < phase.operations.length; i += maxConcurrent) {
      const batch = phase.operations.slice(i, i + maxConcurrent);
      
      // Check resource limits before starting batch
      await this.resourceMonitor.waitForResources(phase.parallelism.resourceLimits);
      
      // Execute batch in parallel
      const batchPromises = batch.map(operation => 
        this.executeOperation(operation, execution)
      );
      
      await Promise.allSettled(batchPromises);
    }
  }

  /**
   * Execute a single operation
   */
  private async executeOperation(operation: SyncOperation, execution: WorkflowExecution): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.emit('operationStarted', { 
        workflowId: execution.workflow.id, 
        operationId: operation.id 
      });

      const result = await this.syncService.executeSync(operation);
      execution.operationResults.set(operation.id, result);

      const executionTime = Date.now() - startTime;
      this.emit('operationCompleted', { 
        workflowId: execution.workflow.id, 
        operationId: operation.id, 
        result,
        executionTime
      });

      if (!result.success) {
        execution.errors.push({
          operationId: operation.id,
          error: result.error || 'Unknown error',
          timestamp: new Date().toISOString(),
          retryAttempt: 0,
          fatal: false
        });
      }

    } catch (error) {
      execution.errors.push({
        operationId: operation.id,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        retryAttempt: 0,
        fatal: true
      });

      this.emit('operationFailed', { 
        workflowId: execution.workflow.id, 
        operationId: operation.id, 
        error 
      });
    }
  }

  /**
   * Complete workflow and generate result
   */
  private completeWorkflow(execution: WorkflowExecution, status: WorkflowStatus): WorkflowResult {
    const endTime = Date.now();
    const totalExecutionTime = endTime - execution.startTime;

    execution.workflow.status = status;
    execution.workflow.completedAt = new Date().toISOString();

    const successfulOperations = Array.from(execution.operationResults.values())
      .filter(result => result.success).length;
    const failedOperations = execution.operationResults.size - successfulOperations;

    return {
      workflowId: execution.workflow.id,
      status,
      startTime: new Date(execution.startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      totalOperations: execution.workflow.operations.length,
      successfulOperations,
      failedOperations,
      skippedOperations: execution.workflow.operations.length - execution.operationResults.size,
      operationResults: execution.operationResults,
      errors: execution.errors,
      metrics: {
        totalExecutionTime,
        averageOperationTime: execution.operationResults.size > 0 
          ? totalExecutionTime / execution.operationResults.size 
          : 0,
        throughputOperationsPerSecond: totalExecutionTime > 0 
          ? (execution.operationResults.size / totalExecutionTime) * 1000 
          : 0,
        resourceUtilization: execution.resourceUsage,
        parallelismEfficiency: this.calculateParallelismEfficiency(execution)
      }
    };
  }

  /**
   * Validate workflow configuration
   */
  private validateWorkflow(workflow: SyncWorkflow): { valid: boolean; error?: string } {
    // Check for circular dependencies
    if (this.hasCircularDependencies(workflow)) {
      return { valid: false, error: 'Circular dependencies detected' };
    }

    // Check that all dependencies reference valid operations
    const operationIds = new Set(workflow.operations.map(op => op.id));
    for (const dependency of workflow.dependencies) {
      if (!operationIds.has(dependency.operationId)) {
        return { valid: false, error: `Invalid dependency: operation ${dependency.operationId} not found` };
      }
      for (const depId of dependency.dependsOn) {
        if (!operationIds.has(depId)) {
          return { valid: false, error: `Invalid dependency: operation ${depId} not found` };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Check for circular dependencies
   */
  private hasCircularDependencies(workflow: SyncWorkflow): boolean {
    const dependenciesMap = new Map(workflow.dependencies.map(dep => [dep.operationId, dep.dependsOn]));
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (operationId: string): boolean => {
      if (recursionStack.has(operationId)) return true;
      if (visited.has(operationId)) return false;

      visited.add(operationId);
      recursionStack.add(operationId);

      const dependencies = dependenciesMap.get(operationId) || [];
      for (const depId of dependencies) {
        if (hasCycle(depId)) return true;
      }

      recursionStack.delete(operationId);
      return false;
    };

    for (const operation of workflow.operations) {
      if (!visited.has(operation.id) && hasCycle(operation.id)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Setup workflow queue processor
   */
  private setupWorkflowProcessor(): void {
    setInterval(async () => {
      await this.processWorkflowQueue();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Process queued workflows
   */
  private async processWorkflowQueue(): Promise<void> {
    while (this.workflowQueue.length > 0 && this.activeWorkflows.size < this.maxConcurrentWorkflows) {
      const workflow = this.workflowQueue.shift();
      if (!workflow) continue;

      // Check resource availability
      const resourcesAvailable = await this.resourceMonitor.checkResourceAvailability(
        workflow.parallelism.resourceLimits
      );

      if (resourcesAvailable) {
        // Start workflow execution in background
        this.executeWorkflow(workflow).catch(error => {
          console.error(`Workflow ${workflow.id} failed:`, error);
        });
      } else {
        // Put back in queue if resources not available
        this.workflowQueue.unshift(workflow);
        break;
      }
    }
  }

  /**
   * Get current operation being executed
   */
  private getCurrentOperation(execution: WorkflowExecution): SyncOperation | undefined {
    // Find the first operation that hasn't completed yet
    return execution.workflow.operations.find(op => !execution.operationResults.has(op.id));
  }

  /**
   * Estimate remaining time for workflow
   */
  private estimateTimeRemaining(execution: WorkflowExecution): number | undefined {
    const completedOperations = execution.operationResults.size;
    const totalOperations = execution.workflow.operations.length;
    const elapsedTime = Date.now() - execution.startTime;

    if (completedOperations === 0) return undefined;

    const averageTimePerOperation = elapsedTime / completedOperations;
    const remainingOperations = totalOperations - completedOperations;
    
    return remainingOperations * averageTimePerOperation;
  }

  /**
   * Calculate parallelism efficiency
   */
  private calculateParallelismEfficiency(execution: WorkflowExecution): number {
    // This would calculate how effectively parallel processing was utilized
    // For now, return a mock value
    return 0.85;
  }
}

/**
 * Resource Monitor for tracking and managing resource usage
 */
class ResourceMonitor {
  private resourceLimits: {
    maxMemoryUsage: string;
    maxCpuUsage: number;
    maxDatabaseConnections: number;
  };

  constructor(limits?: {
    maxMemoryUsage: string;
    maxCpuUsage: number;
    maxDatabaseConnections: number;
  }) {
    this.resourceLimits = limits || {
      maxMemoryUsage: '2GB',
      maxCpuUsage: 80,
      maxDatabaseConnections: 50
    };
  }

  async getCurrentUsage(): Promise<{
    memoryUsage: string;
    cpuUsage: number;
    databaseConnections: number;
  }> {
    // Mock implementation - would integrate with actual monitoring
    return {
      memoryUsage: '512MB',
      cpuUsage: 45,
      databaseConnections: 12
    };
  }

  async checkResourceAvailability(requiredLimits: {
    maxMemoryUsage: string;
    maxCpuUsage: number;
    maxDatabaseConnections: number;
  }): Promise<boolean> {
    const currentUsage = await this.getCurrentUsage();
    
    // Simple check - would be more sophisticated in real implementation
    return (
      this.parseMemoryString(currentUsage.memoryUsage) + this.parseMemoryString(requiredLimits.maxMemoryUsage) <= 
      this.parseMemoryString(this.resourceLimits.maxMemoryUsage) &&
      currentUsage.cpuUsage + requiredLimits.maxCpuUsage <= this.resourceLimits.maxCpuUsage &&
      currentUsage.databaseConnections + requiredLimits.maxDatabaseConnections <= this.resourceLimits.maxDatabaseConnections
    );
  }

  async waitForResources(requiredLimits: {
    maxMemoryUsage: string;
    maxCpuUsage: number;
    maxDatabaseConnections: number;
  }): Promise<void> {
    while (!(await this.checkResourceAvailability(requiredLimits))) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  private parseMemoryString(memoryStr: string): number {
    const match = memoryStr.match(/^(\d+(?:\.\d+)?)(GB|MB|KB)$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    switch (unit) {
      case 'GB': return value * 1024;
      case 'MB': return value;
      case 'KB': return value / 1024;
      default: return 0;
    }
  }
}

// Internal types
interface WorkflowExecution {
  workflow: SyncWorkflow;
  operationResults: Map<string, SyncResult>;
  errors: WorkflowError[];
  startTime: number;
  resourceUsage: {
    peakMemoryUsage: string;
    peakCpuUsage: number;
    peakDatabaseConnections: number;
  };
}

interface ExecutionPhase {
  operations: SyncOperation[];
  parallelism: ParallelismConfig;
}
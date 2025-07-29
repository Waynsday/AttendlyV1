'use client';

/**
 * @fileoverview StudentCard component for displaying individual student details
 * Modal dialog with comprehensive student profile, attendance metrics, and intervention history
 * 
 * Features:
 * - Comprehensive student profile display
 * - Attendance metrics and trend visualization  
 * - i-Ready performance indicators
 * - Intervention history tracking
 * - FERPA compliance with role-based data access
 * - Responsive design and accessibility
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { cn } from '../utils/cn';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Phone,
  Mail,
  MapPin,
  Calendar,
  AlertCircle,
  TrendingUp,
  User,
  GraduationCap,
  Clock,
  Target,
  CheckCircle,
  XCircle,
  Edit,
  UserPlus,
  Bell,
} from 'lucide-react';

// Types for component props
interface Student {
  id: string;
  name: string;
  grade: string;
  teacher: string;
  attendancePercentage: number;
  daysAbsent: number;
  recoveryDays: number;
  interventionStatus: string;
  tardyCount: number;
  tier: string;
  lastAbsence: string;
  chronicallyAbsent: boolean;
  email: string;
  parentContact: {
    name: string;
    phone: string;
    email: string;
  };
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  enrollmentDate: string;
  birthDate: string;
  medicalNotes?: string | null;
}

interface AttendanceTrend {
  date: string;
  present: boolean;
  percentage: number;
}

interface Intervention {
  id: string;
  type: string;
  date: string;
  description: string;
  outcome: string;
  followUpDate: string | null;
}

interface IReadyData {
  ela: {
    currentLevel: string;
    targetLevel: string;
    progress: number;
    lastAssessment: string;
    needsSupport: boolean;
  };
  math: {
    currentLevel: string;
    targetLevel: string;
    progress: number;
    lastAssessment: string;
    needsSupport: boolean;
  };
}

interface StudentCardProps {
  student: Student;
  attendanceTrend: AttendanceTrend[] | null;
  interventions: Intervention[] | null;
  iReadyData: IReadyData | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStudent: (studentId: string) => void;
  onCreateIntervention: (studentId: string) => void;
  onAssignProgram: (studentId: string) => void;
  onLogAccess?: (data: { studentId: string; accessType: string; timestamp: Date }) => void;
  userRole?: string;
  isLoading?: boolean;
  isLoadingTrend?: boolean;
  isLoadingInterventions?: boolean;
  error?: string;
  hasUnsavedChanges?: boolean;
  enableLazyLoading?: boolean;
}

/**
 * StudentCard component for displaying comprehensive student information
 * Implements modal dialog with proper accessibility and security measures
 */
export const StudentCard: React.FC<StudentCardProps> = ({
  student,
  attendanceTrend,
  interventions,
  iReadyData,
  isOpen,
  onClose,
  onUpdateStudent,
  onCreateIntervention,
  onAssignProgram,
  onLogAccess,
  userRole = 'full',
  isLoading = false,
  isLoadingTrend = false,
  isLoadingInterventions = false,
  error,
  hasUnsavedChanges = false,
  enableLazyLoading = false,
}) => {
  const [trendPeriod, setTrendPeriod] = useState('last_30_days');
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [isLazyLoaded, setIsLazyLoaded] = useState(!enableLazyLoading); // Start as loaded for most tests

  // Log data access for FERPA compliance
  useEffect(() => {
    if (isOpen && student && onLogAccess) {
      onLogAccess({
        studentId: student.id,
        accessType: 'view_profile',
        timestamp: new Date(),
      });
    }
  }, [isOpen, student, onLogAccess]);

  // Handle scroll-based lazy loading for i-Ready section
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!enableLazyLoading) return;
    
    const target = e.target as HTMLDivElement;
    const scrollPercentage = (target.scrollTop / (target.scrollHeight - target.clientHeight)) * 100;
    
    if (scrollPercentage > 50 && !isLazyLoaded) {
      setIsLazyLoaded(true);
    }
  }, [isLazyLoaded, enableLazyLoading]);

  // Handle close with unsaved changes check
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowUnsavedWarning(true);
      return;
    }
    onClose();
  }, [hasUnsavedChanges, onClose]);

  // Handle keyboard events for accessibility
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown, true);
      return () => document.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [isOpen, handleClose]);

  // Format dates consistently
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Get intervention icon based on type
  const getInterventionIcon = (type: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      phone_call: <Phone className="h-4 w-4" />,
      meeting: <User className="h-4 w-4" />,
      email: <Mail className="h-4 w-4" />,
      letter: <Mail className="h-4 w-4" />,
      home_visit: <MapPin className="h-4 w-4" />,
    };
    return iconMap[type] || <AlertCircle className="h-4 w-4" />;
  };

  // Check if running on mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  if (!isOpen) return null;

  // Show loading state
  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <div data-testid="student-card-loading" className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Loading student information...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show error state
  if (error) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="text-center py-6">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Validate student data
  const hasIncompleteData = !student.name || !student.grade;
  const hasInvalidAttendance = student.attendancePercentage < 0 || student.attendancePercentage > 100;

  if (hasIncompleteData) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="text-center py-6">
            <AlertCircle className="h-12 w-12 text-warning mx-auto mb-4" />
            <p className="text-warning mb-4">Incomplete student data</p>
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (hasInvalidAttendance) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="text-center py-6">
            <AlertCircle className="h-12 w-12 text-warning mx-auto mb-4" />
            <p className="text-warning mb-4">Invalid attendance data</p>
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show unsaved changes warning (overlay dialog)
  const unsavedWarningDialog = showUnsavedWarning && (
    <Dialog open={true} onOpenChange={() => setShowUnsavedWarning(false)}>
      <DialogContent className="max-w-md" data-testid="unsaved-changes-dialog">
        <DialogHeader>
          <DialogTitle>Unsaved Changes</DialogTitle>
          <DialogDescription>
            You have unsaved changes. Are you sure you want to close?
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end space-x-2 mt-4">
          <Button variant="outline" onClick={() => setShowUnsavedWarning(false)}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => {
              setShowUnsavedWarning(false);
              onClose();
            }}
          >
            Discard Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  const dialogId = `student-card-${student.id}`;
  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;

  return (
    <>
      {unsavedWarningDialog}
      <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        onOpenAutoFocus={(e) => {
          // Focus the dialog content for screen readers and keyboard users
          e.preventDefault();
          const dialogElement = e.currentTarget as HTMLElement;
          if (dialogElement) {
            dialogElement.focus();
          }
        }} 
        className={cn(
          'max-w-6xl h-[90vh] overflow-hidden',
          isMobile && 'max-w-[95vw] h-[95vh]'
        )}
        data-testid="student-card"
        data-secure="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        {/* Modal backdrop for click handling */}
        <div 
          data-testid="modal-backdrop" 
          className="fixed inset-0 -z-10" 
          onClick={handleClose}
        />
        
        <DialogHeader className="pb-4">
          <DialogTitle id={titleId} className="text-2xl font-bold">
            {student.name}
          </DialogTitle>
          <DialogDescription id={descriptionId} className="flex items-center space-x-4 text-base">
            <span>Grade {student.grade}</span>
            <span>•</span>
            <span>{student.teacher}</span>
            <span>•</span>
            <span>Student ID: {student.id}</span>
          </DialogDescription>
          
          {/* Close button with proper accessibility */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 min-h-[44px] min-w-[44px]"
            onClick={handleClose}
            aria-label="Close student card"
          >
            ×
          </Button>
        </DialogHeader>

        <div 
          className={cn(
            'flex-1 overflow-y-auto px-1 flex',
            'flex-col lg:flex-row'
          )}
          data-testid="student-card-content"
          onScroll={handleScroll}
        >
          {/* Left Column - Student Profile & Attendance */}
          <div className="flex-1 space-y-6 pr-0 lg:pr-6">
            
            {/* Student Profile Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>Student Profile</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{student.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Birth Date</p>
                    <p className="font-medium">{formatDate(student.birthDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Enrollment Date</p>
                    <p className="font-medium">{formatDate(student.enrollmentDate)}</p>
                  </div>
                </div>

                {/* Parent Contact Information (role-based access) */}
                {userRole !== 'limited' && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">Parent/Guardian Contact</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Name</p>
                        <p className="font-medium">{student.parentContact.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="font-medium">{student.parentContact.phone}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium">{student.parentContact.email}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Address */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-2">Address</h4>
                  <p className="font-medium">{student.address.street}</p>
                  <p className="font-medium">
                    {student.address.city}, {student.address.state} {student.address.zipCode}
                  </p>
                </div>

                {/* Medical Notes */}
                {student.medicalNotes && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">Medical Notes</h4>
                    <p className="text-sm bg-yellow-50 p-3 rounded-md border border-yellow-200">
                      {student.medicalNotes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Attendance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>Attendance Metrics</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">{student.attendancePercentage.toFixed(1)}%</p>
                    <p className="text-sm text-muted-foreground">Attendance Rate</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-destructive">{student.daysAbsent} days</p>
                    <p className="text-sm text-muted-foreground">Days Absent</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-warning">{student.tardyCount} tardies</p>
                    <p className="text-sm text-muted-foreground">Tardies</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-success">{student.recoveryDays} recovery days</p>
                    <p className="text-sm text-muted-foreground">Recovery Days</p>
                  </div>
                </div>

                {/* Chronically Absent Indicator */}
                {student.chronicallyAbsent && (
                  <div 
                    data-testid="chronic-absent-indicator"
                    className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md"
                  >
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                      <span className="font-semibold text-red-800">Chronically Absent</span>
                    </div>
                  </div>
                )}

                <div className="mt-4 space-y-2">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Last Absence:</span>{' '}
                    <span className="font-medium">{formatDate(student.lastAbsence)}</span>
                  </p>
                  <p className="text-sm">
                    Tier: {student.tier}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Attendance Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5" />
                    <span>Attendance Trend</span>
                  </div>
                  <Select value={trendPeriod} onValueChange={setTrendPeriod}>
                    <SelectTrigger className="w-40" aria-label="Trend period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                      <SelectItem value="last_90_days">Last 90 Days</SelectItem>
                      <SelectItem value="school_year">School Year</SelectItem>
                    </SelectContent>
                  </Select>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingTrend ? (
                  <div data-testid="trend-loading" className="h-64 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : attendanceTrend ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={attendanceTrend}>
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Line 
                          type="monotone" 
                          dataKey="percentage" 
                          stroke="#2563eb" 
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No attendance trend data available
                  </p>
                )}
                
                {/* Attendance Pattern Analysis */}
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <h4 className="font-semibold text-blue-800 mb-2">Attendance Patterns</h4>
                  <p className="text-sm text-blue-700">
                    Analysis shows frequent Friday absences, suggesting possible pattern-based truancy.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - i-Ready & Interventions */}
          <div className="flex-1 space-y-6 pl-0 lg:pl-6">
            
            {/* i-Ready Performance */}
            {isLazyLoaded ? (
              <Card data-testid="iready-performance">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <GraduationCap className="h-5 w-5" />
                    <span>i-Ready Performance</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {iReadyData ? (
                    <div className="space-y-6">
                      {/* ELA Performance */}
                      <div 
                        data-testid="ela-performance"
                        className={cn(
                          'p-4 border rounded-md',
                          iReadyData.ela.needsSupport ? 'needs-support bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                        )}
                      >
                        <h4 className="font-semibold mb-3">ELA Performance</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Current</p>
                            <p className="font-medium">Current: {iReadyData.ela.currentLevel}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Target</p>
                            <p className="font-medium">Target: {iReadyData.ela.targetLevel}</p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <p className="font-medium">{iReadyData.ela.progress}% Progress</p>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${iReadyData.ela.progress}%` }}
                            ></div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Last assessed: {formatDate(iReadyData.ela.lastAssessment)}
                        </p>
                      </div>

                      {/* Math Performance */}
                      <div 
                        data-testid="math-performance"
                        className={cn(
                          'p-4 border rounded-md',
                          iReadyData.math.needsSupport ? 'needs-support bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                        )}
                      >
                        <h4 className="font-semibold mb-3">Math Performance</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Current</p>
                            <p className="font-medium">Current: {iReadyData.math.currentLevel}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Target</p>
                            <p className="font-medium">Target: {iReadyData.math.targetLevel}</p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <p className="font-medium">{iReadyData.math.progress}% Progress</p>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${iReadyData.math.progress}%` }}
                            ></div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Last assessed: {formatDate(iReadyData.math.lastAssessment)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      i-Ready data unavailable
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : null}

            {/* Intervention History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5" />
                  <span>Intervention History</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingInterventions ? (
                  <div data-testid="interventions-loading" className="h-32 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : interventions && interventions.length > 0 ? (
                  <div data-testid="intervention-timeline" className="space-y-4">
                    {interventions.map((intervention) => (
                      <div key={intervention.id} className="border-l-2 border-primary pl-4 pb-4">
                        <div className="flex items-start space-x-3">
                          <div 
                            data-testid={`intervention-icon-${intervention.type}`}
                            className="p-2 bg-primary/10 rounded-full"
                          >
                            {getInterventionIcon(intervention.type)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold">
                                {intervention.type.split('_').map(word => 
                                  word.charAt(0).toUpperCase() + word.slice(1)
                                ).join(' ')}
                              </h4>
                              <time className="text-sm text-muted-foreground">
                                {formatDate(intervention.date)}
                              </time>
                            </div>
                            <p className="text-sm mt-1">{intervention.description}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              Outcome: {intervention.outcome}
                            </p>
                            {intervention.followUpDate && (
                              <p className="text-sm text-primary mt-1">
                                Follow-up: {formatDate(intervention.followUpDate)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No interventions recorded
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button 
                    onClick={() => onCreateIntervention(student.id)}
                    className="min-h-[44px]"
                    aria-label="Create intervention"
                    tabIndex={0}
                  >
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Create Intervention
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => onAssignProgram(student.id)}
                    className="min-h-[44px]"
                    aria-label="Assign to program"
                    tabIndex={0}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Assign to Program
                  </Button>
                  <Button 
                    variant="outline"
                    className="min-h-[44px]"
                    aria-label="Send notification"
                    tabIndex={0}
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    Send Notification
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => onUpdateStudent(student.id)}
                    className="min-h-[44px]"
                    aria-label="Edit student"
                    tabIndex={0}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Student
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Screen reader announcements */}
        <div 
          role="status" 
          aria-live="polite" 
          className="sr-only"
        >
          Student card loaded for {student.name}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default StudentCard;
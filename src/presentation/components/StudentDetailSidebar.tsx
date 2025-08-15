'use client';

/**
 * @fileoverview StudentDetailSidebar component for displaying detailed student information
 * Shows attendance history, iReady scores, and intervention history in a sliding panel
 */

import * as React from 'react';
import { X, Calendar, BookOpen, AlertTriangle, TrendingUp, TrendingDown, CalendarX } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { cn } from '../utils/cn';
import { useStudentAttendanceDetails } from '../hooks/useStudentAttendanceDetails';
import { IReadyHistoryCard } from './IReadyHistoryCard';
import { InterventionsTimelineCard } from './InterventionsTimelineCard';

// Student detailed data interface - made fields optional to handle basic StudentData
interface StudentDetail {
  id: string;
  name: string;
  grade: string;
  teacher: string;
  studentId: string;
  attendanceRate: number;
  enrolled: number;
  absences: number;
  present: number;
  tardies: number;
  tier: string;
  riskLevel?: 'low' | 'medium' | 'high';
  
  // Attendance history (dates from CSV) - optional
  attendanceHistory?: Array<{
    date: string;
    status: 'present' | 'absent' | 'tardy';
    percentage: number;
  }>;
  
  // iReady scores - optional
  iReadyScores?: Array<{
    subject: 'ELA' | 'Math';
    testDate: string;
    overallScore: number;
    placement: string;
    lexileLevel?: string;
    percentile: number;
    gain: number;
  }>;
  
  // Intervention history - optional
  interventions?: Array<{
    date: string;
    type: 'Letter 1' | 'Letter 2' | 'SART' | 'SARB' | 'Mediation' | 'Parent Contact';
    status: 'Completed' | 'Pending' | 'No Show';
    notes: string;
  }>;
  
  // Comments from staff - optional
  comments?: Array<{
    date: string;
    staff: string;
    comment: string;
  }>;
}

interface StudentDetailSidebarProps {
  student: StudentDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

export function StudentDetailSidebar({ student, isOpen, onClose }: StudentDetailSidebarProps) {
  // DEBUG: Log when component is called
  console.log('🔍 StudentDetailSidebar called:', { 
    studentExists: !!student, 
    isOpen, 
    studentName: student?.name,
    studentId: student?.id 
  });

  // Fetch detailed attendance data when sidebar opens
  const attendanceDetails = useStudentAttendanceDetails(
    isOpen && student ? student.studentId : null,
    '2024' // Current school year
  );

  if (!student) {
    console.log('❌ StudentDetailSidebar: No student provided, returning null');
    return null;
  }

  console.log('✅ StudentDetailSidebar: Rendering for student:', student.name);

  const getTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'tier 1':
      case 'low risk':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'tier 2':
      case 'medium risk':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'tier 3':
      case 'high risk':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'low':
        return 'text-green-600';
      case 'medium':
        return 'text-yellow-600';
      case 'high':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getInterventionIcon = (type: string) => {
    switch (type) {
      case 'SART':
      case 'SARB':
        return <AlertTriangle className="h-4 w-4" />;
      case 'Parent Contact':
        return <Calendar className="h-4 w-4" />;
      default:
        return <BookOpen className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
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

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 40
          }}
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div 
        className={cn(
          'fixed right-0 top-0 h-full w-96 bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50 overflow-y-auto',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          height: '100vh',
          width: '420px',
          backgroundColor: '#ffffff',
          zIndex: 50,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.12)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid #e5e7eb'
        }}
      >
        {/* Header */}
        <div 
          className="sticky top-0 bg-white border-b px-8 py-6 flex items-center justify-between" 
          style={{ 
            flexShrink: 0, 
            zIndex: 10,
            borderBottomColor: '#e5e7eb',
            backgroundColor: '#fafbfc'
          }}
        >
          <div>
            <h2 
              className="text-2xl font-semibold text-gray-900 mb-1"
              style={{ color: '#1f2937', fontWeight: 600 }}
            >
              {student.name}
            </h2>
            <p 
              className="text-sm text-gray-500"
              style={{ color: '#6b7280' }}
            >
              Student ID: {student.studentId} • Grade {student.grade}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close student details"
            className="hover:bg-gray-100 rounded-full"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%'
            }}
          >
            <X className="h-5 w-5 text-gray-500" />
          </Button>
        </div>

        <div className="px-8 py-6 space-y-8" style={{ flex: 1, overflowY: 'auto' }}>

          {/* Overview Stats */}
          <div 
            className="bg-white rounded-xl border p-6"
            style={{
              borderColor: '#e5e7eb',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              backgroundColor: '#ffffff'
            }}
          >
            <h3 
              className="text-lg font-semibold text-gray-900 mb-4"
              style={{ color: '#1f2937', fontWeight: 600 }}
            >
              Overview
            </h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <div 
                  className="text-3xl font-bold mb-1"
                  style={{ 
                    color: '#3481a3',
                    fontWeight: 700,
                    fontSize: '2rem'
                  }}
                >
                  {student.attendanceRate.toFixed(1)}%
                </div>
                <div 
                  className="text-sm"
                  style={{ color: '#6b7280' }}
                >
                  Attendance Rate
                </div>
              </div>
              <div className="text-center">
                <div 
                  className="text-3xl font-bold mb-1"
                  style={{ 
                    color: student.absences > 10 ? '#ef4444' : '#3481a3',
                    fontWeight: 700,
                    fontSize: '2rem'
                  }}
                >
                  {student.absences}
                </div>
                <div 
                  className="text-sm"
                  style={{ color: '#6b7280' }}
                >
                  Total Absences
                </div>
              </div>
              <div className="text-center">
                <div 
                  className="text-3xl font-bold mb-1"
                  style={{ 
                    color: student.tardies > 5 ? '#f59e0b' : '#3481a3',
                    fontWeight: 700,
                    fontSize: '2rem'
                  }}
                >
                  {student.tardies || 0}
                </div>
                <div 
                  className="text-sm"
                  style={{ color: '#6b7280' }}
                >
                  Total Tardies
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t" style={{ borderTopColor: '#f3f4f6' }}>
              <span className="text-sm font-medium" style={{ color: '#374151' }}>Risk Level:</span>
              <span 
                className="px-3 py-1 rounded-full text-sm font-medium"
                style={{
                  backgroundColor: student.tier.toLowerCase().includes('1') ? '#dcfce7' : 
                                   student.tier.toLowerCase().includes('2') ? '#fef3c7' : '#fee2e2',
                  color: student.tier.toLowerCase().includes('1') ? '#166534' : 
                         student.tier.toLowerCase().includes('2') ? '#92400e' : '#991b1b',
                  fontSize: '0.875rem',
                  fontWeight: 500
                }}
              >
                {student.tier.replace('Tier 1', 'Low Risk').replace('Tier 2', 'Medium Risk').replace('Tier 3', 'High Risk')}
              </span>
            </div>
            
            <div className="pt-4">
              <span className="text-sm" style={{ color: '#6b7280' }}>
                <span className="font-medium" style={{ color: '#374151' }}>Teacher:</span> {student.teacher}
              </span>
            </div>
          </div>

          {/* Attendance Details */}
          <div 
            className="bg-white rounded-xl border p-6"
            style={{
              borderColor: '#e5e7eb',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              backgroundColor: '#ffffff'
            }}
          >
            <h3 
              className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"
              style={{ color: '#1f2937', fontWeight: 600 }}
            >
              <CalendarX className="h-5 w-5" style={{ color: '#3481a3' }} />
              Attendance Details
            </h3>
            <div>
              {attendanceDetails.loading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span className="ml-2 text-sm text-muted-foreground">Loading attendance details...</span>
                </div>
              ) : attendanceDetails.error ? (
                <div className="text-center py-4">
                  <div className="text-sm text-red-600 mb-2">Error loading attendance details</div>
                  <div className="text-xs text-muted-foreground">{attendanceDetails.error}</div>
                </div>
              ) : attendanceDetails.data ? (
                <div className="space-y-4">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 gap-4 text-center border-b pb-3">
                    <div>
                      <div className="text-lg font-bold text-primary">{attendanceDetails.data.presentDays}</div>
                      <div className="text-xs text-muted-foreground">Present Days</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-primary">{attendanceDetails.data.absentDays}</div>
                      <div className="text-xs text-muted-foreground">Absent Days</div>
                    </div>
                  </div>

                  {/* Absent Dates */}
                  {attendanceDetails.data.absentDates && attendanceDetails.data.absentDates.length > 0 ? (
                    <div>
                      <h4 className="text-sm font-medium text-primary mb-2">Absent Dates ({attendanceDetails.data.absentDates.length})</h4>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {attendanceDetails.data.absentDates.map((record, index) => (
                          <div key={index} className="flex items-center justify-between py-1 px-2 bg-red-50 rounded text-sm">
                            <span className="text-muted-foreground">{record.date}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-red-500" />
                              <span className="text-red-700 font-medium">Absent</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 bg-green-50 rounded">
                      <div className="text-sm font-medium text-green-800">Perfect Attendance!</div>
                      <div className="text-xs text-green-600 mt-1">No absences recorded this year</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="text-sm text-muted-foreground mb-2">Current Year Totals</div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-lg font-bold text-primary">{student.present}</div>
                      <div className="text-xs text-muted-foreground">Present Days</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-primary">{student.absences}</div>
                      <div className="text-xs text-muted-foreground">Absent Days</div>
                    </div>
                    <div>
                      <div className={`text-lg font-bold ${student.tardies > 5 ? 'text-yellow-600' : 'text-primary'}`}>
                        {student.tardies || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Tardies</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* iReady Scores */}
          {student.iReadyScores && student.iReadyScores.length > 0 && (
            <div 
              className="bg-white rounded-xl border p-6"
              style={{
                borderColor: '#e5e7eb',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                backgroundColor: '#ffffff'
              }}
            >
              <h3 
                className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"
                style={{ color: '#1f2937', fontWeight: 600 }}
              >
                <BookOpen className="h-5 w-5" style={{ color: '#3481a3' }} />
                iReady Scores
              </h3>
              <div className="space-y-4">
                {student.iReadyScores.map((score, index) => (
                  <div key={index} className="border border-primary/20 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-primary">{score.subject}</span>
                      <span className="text-sm text-muted-foreground">{formatDate(score.testDate)}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Score:</span>
                        <span className="ml-1 font-medium text-primary">{score.overallScore}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Percentile:</span>
                        <span className="ml-1 font-medium text-primary">{score.percentile}%</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Placement:</span>
                        <span className="ml-1 font-medium text-primary">{score.placement}</span>
                      </div>
                      {score.lexileLevel && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Lexile:</span>
                          <span className="ml-1 font-medium text-primary">{score.lexileLevel}</span>
                        </div>
                      )}
                      <div className="col-span-2 flex items-center gap-1">
                        <span className="text-muted-foreground">Gain:</span>
                        <span className={cn('ml-1 font-medium flex items-center gap-1', 
                          score.gain > 0 ? 'text-tier-1' : score.gain < 0 ? 'text-tier-3' : 'text-muted-foreground'
                        )}>
                          {score.gain > 0 ? <TrendingUp className="h-3 w-3" /> : 
                           score.gain < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                          {score.gain}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* iReady Assessment History */}
          <IReadyHistoryCard 
            studentId={student.id}
            className="bg-white rounded-xl border shadow-sm"
            style={{
              borderColor: '#e5e7eb',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}
          />


          {/* Interventions & Comments Timeline */}
          <div 
            className="bg-white rounded-xl border p-6"
            style={{
              borderColor: '#e5e7eb',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              backgroundColor: '#ffffff'
            }}
          >
            <h3 
              className="text-lg font-semibold text-gray-900 mb-4"
              style={{ color: '#1f2937', fontWeight: 600 }}
            >
              Interventions & Timeline
            </h3>
            <div className="text-sm" style={{ color: '#6b7280' }}>
              <p className="mb-2">Student ID: {student.id}</p>
              <p className="mb-2">Aeries ID: {student.studentId}</p>
              <p>Intervention history and timeline data will appear here.</p>
            </div>
          </div>
          

          {/* Legacy Intervention History (fallback) */}
          {student.interventions && student.interventions.length > 0 && (
            <div 
              className="bg-white rounded-xl border p-6"
              style={{
                borderColor: '#e5e7eb',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                backgroundColor: '#ffffff'
              }}
            >
              <h3 
                className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"
                style={{ color: '#1f2937', fontWeight: 600 }}
              >
                <AlertTriangle className="h-5 w-5" style={{ color: '#3481a3' }} />
                Intervention History
              </h3>
              <div className="space-y-3">
                {student.interventions.map((intervention, index) => (
                  <div key={index} className="border-l-4 border-primary/30 pl-3 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      {getInterventionIcon(intervention.type)}
                      <span className="font-medium text-sm text-primary">{intervention.type}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(intervention.date)}</span>
                    </div>
                    <div className={cn('text-xs px-2 py-1 rounded inline-block mb-2',
                      intervention.status === 'Completed' ? 'bg-tier-1/20 text-tier-1 border border-tier-1/30' :
                      intervention.status === 'Pending' ? 'bg-tier-2/20 text-tier-2 border border-tier-2/30' :
                      'bg-tier-3/20 text-tier-3 border border-tier-3/30'
                    )}>
                      {intervention.status}
                    </div>
                    {intervention.notes && (
                      <p className="text-sm text-muted-foreground mt-1">{intervention.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Staff Comments */}
          {student.comments && student.comments.length > 0 && (
            <div 
              className="bg-white rounded-xl border p-6"
              style={{
                borderColor: '#e5e7eb',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                backgroundColor: '#ffffff'
              }}
            >
              <h3 
                className="text-lg font-semibold text-gray-900 mb-4"
                style={{ color: '#1f2937', fontWeight: 600 }}
              >
                Staff Comments
              </h3>
              <div className="space-y-3">
                {student.comments.map((comment, index) => (
                  <div 
                    key={index} 
                    className="rounded-lg p-4 border"
                    style={{
                      backgroundColor: '#f9fafb',
                      borderColor: '#e5e7eb'
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm" style={{ color: '#374151' }}>{comment.staff}</span>
                      <span className="text-xs" style={{ color: '#6b7280' }}>{formatDate(comment.date)}</span>
                    </div>
                    <p className="text-sm" style={{ color: '#6b7280' }}>{comment.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
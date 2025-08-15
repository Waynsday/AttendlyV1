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
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div 
        className={cn(
          'fixed right-0 top-0 h-full w-96 bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50 overflow-y-auto',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b-2 border-primary px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-primary">{student.name}</h2>
            <p className="text-sm text-muted-foreground">ID: {student.studentId} • Grade {student.grade}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close student details"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* EARLY DEBUG TEST */}
          <div style={{
            backgroundColor: 'purple',
            color: 'white',
            padding: '10px',
            border: '2px solid yellow'
          }}>
            🟣 EARLY DEBUG: If you see this, sidebar is rendering
          </div>

          {/* Overview Stats */}
          <Card className="bg-white border-2 border-primary shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg text-primary">Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {student.attendanceRate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Attendance Rate</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {student.absences}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Absences</div>
                </div>
                <div>
                  <div className={`text-2xl font-bold ${student.tardies > 5 ? 'text-yellow-600' : 'text-primary'}`}>
                    {student.tardies || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Tardies</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-primary">Risk Level:</span>
                <span className={cn('px-2 py-1 rounded-full text-xs font-medium border', getTierColor(student.tier))}>
                  {student.tier.replace('Tier 1', 'Low Risk').replace('Tier 2', 'Medium Risk').replace('Tier 3', 'High Risk')}
                </span>
              </div>
              
              {student.riskLevel && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-primary">Risk Level:</span>
                  <span className={cn('font-medium capitalize', getRiskColor(student.riskLevel))}>
                    {student.riskLevel}
                  </span>
                </div>
              )}
              
              <div className="text-sm text-muted-foreground">
                <strong className="text-primary">Teacher:</strong> {student.teacher}
              </div>
            </CardContent>
          </Card>

          {/* Attendance Details */}
          <Card className="bg-white border-2 border-primary shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-primary">
                <CalendarX className="h-5 w-5" />
                Attendance Details
              </CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          {/* iReady Scores */}
          {student.iReadyScores && student.iReadyScores.length > 0 && (
            <Card className="bg-white border-2 border-primary shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-primary">
                  <BookOpen className="h-5 w-5" />
                  iReady Scores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>
          )}

          {/* iReady Assessment History */}
          <IReadyHistoryCard 
            studentId={student.id}
            className="border-2 border-primary shadow-lg"
          />

          {/* DEBUG: Right after IReadyHistoryCard */}
          <div style={{
            backgroundColor: 'orange',
            color: 'black',
            padding: '15px',
            border: '3px solid red',
            fontSize: '16px',
            fontWeight: 'bold'
          }}>
            🟠 DEBUG: After IReadyHistoryCard - should be visible!
          </div>

          {/* DEBUG: Simple test element */}
          <div style={{
            backgroundColor: 'red', 
            color: 'white', 
            padding: '20px', 
            margin: '10px',
            border: '3px solid blue'
          }}>
            <h3>🚨 DEBUG: This should be visible after iReady section</h3>
            <p>Student ID: {student.id}</p>
            <p>Aeries ID: {student.studentId}</p>
            <p>If you see this, the location is working!</p>
          </div>

          {/* Interventions & Comments Timeline */}
          <Card className="bg-white border-2 border-primary shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg text-primary">Interventions & Comments (Test)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600">
                <p>Student ID: {student.id}</p>
                <p>Aeries ID: {student.studentId}</p>
                <p>This is a test to verify the component renders in this location.</p>
              </div>
            </CardContent>
          </Card>
          
          {/* Interventions Timeline Component with Error Boundary */}
          <div className="intervention-timeline-wrapper" style={{
            backgroundColor: 'green',
            color: 'white',
            padding: '20px',
            margin: '10px'
          }}>
            <h3>🟢 InterventionsTimelineCard should render here</h3>
            <p>Student UUID: {student.id}</p>
            <p>This green box shows where the InterventionsTimelineCard should appear</p>
            
            {/* Temporarily comment out the component to test */}
            {/* <InterventionsTimelineCard 
              studentId={student.id}
              className="border-2 border-primary shadow-lg"
              maxInitialItems={5}
              showFilters={true}
              autoRefresh={false}
            /> */}
          </div>

          {/* Legacy Intervention History (fallback) */}
          {student.interventions && student.interventions.length > 0 && (
            <Card className="bg-white border-2 border-primary shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-primary">
                  <AlertTriangle className="h-5 w-5" />
                  Intervention History
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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
              </CardContent>
            </Card>
          )}

          {/* Staff Comments */}
          {student.comments && student.comments.length > 0 && (
            <Card className="bg-white border-2 border-primary shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg text-primary">Staff Comments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {student.comments.map((comment, index) => (
                  <div key={index} className="bg-muted rounded-lg p-3 border border-primary/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm text-primary">{comment.staff}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(comment.date)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{comment.comment}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
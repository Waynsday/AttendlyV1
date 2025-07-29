'use client';

/**
 * @fileoverview StudentDetailSidebar component for displaying detailed student information
 * Shows attendance history, iReady scores, and intervention history in a sliding panel
 */

import * as React from 'react';
import { X, Calendar, BookOpen, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { cn } from '../utils/cn';

// Student detailed data interface
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
  tier: string;
  riskLevel: 'low' | 'medium' | 'high';
  
  // Attendance history (dates from CSV)
  attendanceHistory: Array<{
    date: string;
    status: 'present' | 'absent' | 'tardy';
    percentage: number;
  }>;
  
  // iReady scores
  iReadyScores: Array<{
    subject: 'ELA' | 'Math';
    testDate: string;
    overallScore: number;
    placement: string;
    lexileLevel?: string;
    percentile: number;
    gain: number;
  }>;
  
  // Intervention history
  interventions: Array<{
    date: string;
    type: 'Letter 1' | 'Letter 2' | 'SART' | 'SARB' | 'Mediation' | 'Parent Contact';
    status: 'Completed' | 'Pending' | 'No Show';
    notes: string;
  }>;
  
  // Comments from staff
  comments: Array<{
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
  if (!student) return null;

  const getTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'tier 1':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'tier 2':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'tier 3':
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
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{student.name}</h2>
            <p className="text-sm text-gray-500">ID: {student.studentId} • Grade {student.grade}</p>
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
          {/* Overview Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold text-romoland-primary">
                    {student.attendanceRate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-500">Attendance Rate</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-romoland-primary">
                    {student.absences}
                  </div>
                  <div className="text-sm text-gray-500">Total Absences</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Risk Tier:</span>
                <span className={cn('px-2 py-1 rounded-full text-xs font-medium border', getTierColor(student.tier))}>
                  {student.tier}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Risk Level:</span>
                <span className={cn('font-medium capitalize', getRiskColor(student.riskLevel))}>
                  {student.riskLevel}
                </span>
              </div>
              
              <div className="text-sm text-gray-600">
                <strong>Teacher:</strong> {student.teacher}
              </div>
            </CardContent>
          </Card>

          {/* Attendance History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Attendance Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {student.attendanceHistory.slice(-10).map((record, index) => (
                  <div key={index} className="flex items-center justify-between py-1">
                    <span className="text-sm text-gray-600">{record.date}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {record.percentage.toFixed(1)}%
                      </span>
                      <div className={cn(
                        'w-2 h-2 rounded-full',
                        record.status === 'present' ? 'bg-green-500' :
                        record.status === 'tardy' ? 'bg-yellow-500' : 'bg-red-500'
                      )} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* iReady Scores */}
          {student.iReadyScores.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  iReady Scores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {student.iReadyScores.map((score, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{score.subject}</span>
                      <span className="text-sm text-gray-500">{formatDate(score.testDate)}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Score:</span>
                        <span className="ml-1 font-medium">{score.overallScore}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Percentile:</span>
                        <span className="ml-1 font-medium">{score.percentile}%</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-600">Placement:</span>
                        <span className="ml-1 font-medium">{score.placement}</span>
                      </div>
                      {score.lexileLevel && (
                        <div className="col-span-2">
                          <span className="text-gray-600">Lexile:</span>
                          <span className="ml-1 font-medium">{score.lexileLevel}</span>
                        </div>
                      )}
                      <div className="col-span-2 flex items-center gap-1">
                        <span className="text-gray-600">Gain:</span>
                        <span className={cn('ml-1 font-medium flex items-center gap-1', 
                          score.gain > 0 ? 'text-green-600' : score.gain < 0 ? 'text-red-600' : 'text-gray-600'
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

          {/* Intervention History */}
          {student.interventions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Intervention History
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {student.interventions.map((intervention, index) => (
                  <div key={index} className="border-l-4 border-gray-200 pl-3 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      {getInterventionIcon(intervention.type)}
                      <span className="font-medium text-sm">{intervention.type}</span>
                      <span className="text-xs text-gray-500">{formatDate(intervention.date)}</span>
                    </div>
                    <div className={cn('text-xs px-2 py-1 rounded inline-block mb-2',
                      intervention.status === 'Completed' ? 'bg-green-100 text-green-800' :
                      intervention.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    )}>
                      {intervention.status}
                    </div>
                    {intervention.notes && (
                      <p className="text-sm text-gray-600 mt-1">{intervention.notes}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Staff Comments */}
          {student.comments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Staff Comments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {student.comments.map((comment, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{comment.staff}</span>
                      <span className="text-xs text-gray-500">{formatDate(comment.date)}</span>
                    </div>
                    <p className="text-sm text-gray-700">{comment.comment}</p>
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
import { DashboardLayout } from '@/presentation/components/dashboard-layout';
import { MetricsOverview } from '@/presentation/components/metrics-overview';
import { StudentList } from '@/presentation/components/student-list';

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            AP Attendance Recovery Dashboard
          </h1>
          <div className="text-sm text-gray-500">
            Romoland School District
          </div>
        </div>
        
        <MetricsOverview />
        
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Student Attendance Overview
            </h2>
            <p className="text-sm text-gray-500">
              Chronic absentees requiring intervention
            </p>
          </div>
          <StudentList />
        </div>
      </div>
    </DashboardLayout>
  );
}
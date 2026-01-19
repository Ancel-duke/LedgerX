'use client';

import { useQuery } from '@tanstack/react-query';
import { activityLogService } from '@/services/api/activity-log.service';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { ActivityTimeline } from '@/components/dashboard/activity-timeline';

export default function ActivityPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['activity-log', 'all'],
    queryFn: () => activityLogService.getAll({ page: 1, limit: 50 }),
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <ErrorState
          message="Failed to load activity log. Please try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const activities = data?.data || [];

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-neutral-900 mb-6">Activity Log</h1>

      {activities.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="No activity yet"
            description="Activity will appear here as you use the system."
          />
        </Card>
      ) : (
        <Card className="p-4 sm:p-6">
          <ActivityTimeline activities={activities} />
        </Card>
      )}
    </div>
  );
}
